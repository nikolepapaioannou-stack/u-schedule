import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage, initializeDefaultData } from "./storage";
import { insertUserSchema, loginSchema, searchSlotsSchema, insertBookingSchema, insertClosedDateSchema } from "@shared/schema";
import { createHash, randomBytes } from "crypto";

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

const sessions = new Map<string, { userId: string; expiresAt: Date }>();

function createSession(userId: string): string {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  sessions.set(token, { userId, expiresAt });
  return token;
}

function validateSession(token: string): string | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    sessions.delete(token);
    return null;
  }
  return session.userId;
}

function getAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

async function requireAuth(req: Request, res: Response): Promise<string | null> {
  const token = getAuthToken(req);
  if (!token) {
    res.status(401).json({ error: "Απαιτείται σύνδεση" });
    return null;
  }
  const userId = validateSession(token);
  if (!userId) {
    res.status(401).json({ error: "Μη έγκυρη συνεδρία" });
    return null;
  }
  return userId;
}

async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const userId = await requireAuth(req, res);
  if (!userId) return null;
  
  const user = await storage.getUser(userId);
  if (!user?.isAdmin) {
    res.status(403).json({ error: "Απαιτούνται δικαιώματα διαχειριστή" });
    return null;
  }
  return userId;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function addWorkingDays(startDate: Date, days: number, closedDates: Set<string>): Date {
  let current = new Date(startDate);
  let added = 0;
  
  while (added < days) {
    current.setDate(current.getDate() + 1);
    const dateStr = current.toISOString().split("T")[0];
    if (!isWeekend(current) && !closedDates.has(dateStr)) {
      added++;
    }
  }
  
  return current;
}

async function getAvailableSlots(
  startDate: Date,
  endDate: Date,
  candidateCount: number,
  preferredShift: string
) {
  const allShifts = await storage.getShifts();
  const closedDatesData = await storage.getClosedDates();
  const closedDatesSet = new Set(closedDatesData.map(cd => cd.date));
  const settings = await storage.getSettings();
  
  const slots: Array<{
    date: string;
    shiftId: string;
    shiftName: string;
    startTime: string;
    endTime: string;
    availableCapacity: number;
    priority: number;
    isSplit: boolean;
    splitInfo?: { dates: string[]; candidatesPerSlot: number[] };
  }> = [];
  
  const current = new Date(startDate);
  const end = new Date(endDate);
  end.setMonth(end.getMonth() + 2);
  
  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    
    if (!isWeekend(current) && !closedDatesSet.has(dateStr)) {
      for (const shift of allShifts) {
        const existingBookings = await storage.getBookingsByDateAndShift(dateStr, shift.id);
        const bookedCandidates = existingBookings.reduce((sum, b) => sum + b.candidateCount, 0);
        const availableCapacity = shift.maxCandidates - bookedCandidates;
        
        if (availableCapacity > 0) {
          let priority = 3;
          
          if (availableCapacity >= candidateCount && shift.name === preferredShift) {
            priority = 1;
          } else if (availableCapacity >= candidateCount) {
            priority = 2;
          }
          
          slots.push({
            date: dateStr,
            shiftId: shift.id,
            shiftName: shift.name,
            startTime: shift.startTime,
            endTime: shift.endTime,
            availableCapacity,
            priority,
            isSplit: availableCapacity < candidateCount,
          });
        }
      }
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return slots.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  await initializeDefaultData();
  
  setInterval(async () => {
    const released = await storage.releaseExpiredHolds();
    if (released > 0) {
      console.log(`Released ${released} expired holds`);
    }
  }, 60000);

  app.post("/api/auth/register", async (req, res) => {
    try {
      const parsed = insertUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Μη έγκυρα δεδομένα εγγραφής" });
      }
      
      const { email, password, ugrId } = parsed.data;
      
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(400).json({ error: "Το email χρησιμοποιείται ήδη" });
      }
      
      const existingUgr = await storage.getUserByUgrId(ugrId);
      if (existingUgr) {
        return res.status(400).json({ error: "Το UGR ID χρησιμοποιείται ήδη" });
      }
      
      const hashedPassword = hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        ugrId,
      });
      
      const token = createSession(user.id);
      
      res.json({
        user: { id: user.id, email: user.email, ugrId: user.ugrId, isAdmin: user.isAdmin },
        token,
      });
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ error: "Σφάλμα εγγραφής" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Μη έγκυρα στοιχεία σύνδεσης" });
      }
      
      const { email, password } = parsed.data;
      const user = await storage.getUserByEmail(email);
      
      if (!user || user.password !== hashPassword(password)) {
        return res.status(401).json({ error: "Λάθος email ή κωδικός" });
      }
      
      const token = createSession(user.id);
      
      res.json({
        user: { id: user.id, email: user.email, ugrId: user.ugrId, isAdmin: user.isAdmin },
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Σφάλμα σύνδεσης" });
    }
  });

  app.get("/api/auth/me", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: "Ο χρήστης δεν βρέθηκε" });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      ugrId: user.ugrId,
      isAdmin: user.isAdmin,
      biometricEnabled: user.biometricEnabled,
    });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = getAuthToken(req);
    if (token) {
      sessions.delete(token);
    }
    res.json({ success: true });
  });

  app.put("/api/auth/biometric", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const { enabled } = req.body;
    await storage.updateUserBiometric(userId, enabled);
    res.json({ success: true });
  });

  app.get("/api/shifts", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const shiftsData = await storage.getShifts();
    res.json(shiftsData);
  });

  app.put("/api/shifts/:id", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const { id } = req.params;
    const updated = await storage.updateShift(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Η βάρδια δεν βρέθηκε" });
    }
    res.json(updated);
  });

  app.get("/api/settings", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const settingsData = await storage.getSettings();
    res.json(settingsData);
  });

  app.put("/api/settings", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const updated = await storage.updateSettings(req.body);
    res.json(updated);
  });

  app.get("/api/closed-dates", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const closedDatesData = await storage.getClosedDates();
    res.json(closedDatesData);
  });

  app.post("/api/closed-dates", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const parsed = insertClosedDateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Μη έγκυρα δεδομένα" });
    }
    
    const closedDate = await storage.createClosedDate({
      ...parsed.data,
      createdBy: adminId,
    });
    res.json(closedDate);
  });

  app.delete("/api/closed-dates/:id", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    await storage.deleteClosedDate(req.params.id);
    res.json({ success: true });
  });

  app.post("/api/slots/search", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    try {
      const parsed = searchSlotsSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Μη έγκυρα δεδομένα αναζήτησης" });
      }
      
      const { departmentId, candidateCount, courseEndDate, preferredShift } = parsed.data;
      
      const existingBooking = await storage.getBookingByDepartmentId(departmentId);
      if (existingBooking) {
        return res.status(400).json({ 
          error: "Το τμήμα έχει ήδη δηλωθεί για εξέταση",
          existingBooking: {
            date: existingBooking.bookingDate,
            status: existingBooking.status,
          }
        });
      }
      
      const closedDatesData = await storage.getClosedDates();
      const closedDatesSet = new Set(closedDatesData.map(cd => cd.date));
      const settings = await storage.getSettings();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const courseEnd = new Date(courseEndDate);
      const referenceDate = courseEnd >= today ? courseEnd : today;
      
      const minDate = addWorkingDays(referenceDate, settings.workingDaysRule, closedDatesSet);
      
      const slots = await getAvailableSlots(minDate, minDate, candidateCount, preferredShift);
      
      res.json({
        minDate: minDate.toISOString().split("T")[0],
        slots,
      });
    } catch (error) {
      console.error("Search slots error:", error);
      res.status(500).json({ error: "Σφάλμα αναζήτησης" });
    }
  });

  app.get("/api/bookings", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const user = await storage.getUser(userId);
    if (user?.isAdmin) {
      const allBookings = await storage.getBookings();
      return res.json(allBookings);
    }
    
    const userBookings = await storage.getBookingsByUserId(userId);
    res.json(userBookings);
  });

  app.get("/api/bookings/pending", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const pending = await storage.getPendingBookings();
    res.json(pending);
  });

  app.post("/api/bookings", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    try {
      const parsed = insertBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Μη έγκυρα δεδομένα κράτησης" });
      }
      
      const existingBooking = await storage.getBookingByDepartmentId(parsed.data.departmentId);
      if (existingBooking) {
        return res.status(400).json({ error: "Το τμήμα έχει ήδη δηλωθεί" });
      }
      
      const booking = await storage.createBooking({
        ...parsed.data,
        userId,
      });
      
      res.json(booking);
    } catch (error) {
      console.error("Create booking error:", error);
      res.status(500).json({ error: "Σφάλμα δημιουργίας κράτησης" });
    }
  });

  app.put("/api/bookings/:id/submit", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const { id } = req.params;
    const bookings = await storage.getBookingsByUserId(userId);
    const booking = bookings.find(b => b.id === id);
    
    if (!booking) {
      return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
    }
    
    if (booking.status !== "holding") {
      return res.status(400).json({ error: "Η κράτηση δεν είναι σε αναμονή" });
    }
    
    if (booking.holdExpiresAt && new Date(booking.holdExpiresAt) < new Date()) {
      await storage.updateBooking(id, { status: "expired" });
      return res.status(400).json({ error: "Η κράτηση έχει λήξει" });
    }
    
    const updated = await storage.updateBooking(id, {
      status: "pending",
      holdExpiresAt: null,
    });
    
    res.json(updated);
  });

  app.put("/api/bookings/:id/cancel", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const { id } = req.params;
    const bookings = await storage.getBookingsByUserId(userId);
    const booking = bookings.find(b => b.id === id);
    
    if (!booking) {
      return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
    }
    
    if (booking.status !== "holding") {
      return res.status(400).json({ error: "Μόνο κρατήσεις σε αναμονή μπορούν να ακυρωθούν" });
    }
    
    await storage.deleteBooking(id);
    res.json({ success: true });
  });

  app.put("/api/bookings/:id/approve", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const { id } = req.params;
    const { adminNotes } = req.body;
    
    const updated = await storage.updateBooking(id, {
      status: "approved",
      adminNotes,
    });
    
    if (!updated) {
      return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
    }
    
    res.json(updated);
  });

  app.put("/api/bookings/:id/reject", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const { id } = req.params;
    const { adminNotes } = req.body;
    
    if (!adminNotes) {
      return res.status(400).json({ error: "Απαιτείται αιτιολογία απόρριψης" });
    }
    
    const updated = await storage.updateBooking(id, {
      status: "rejected",
      adminNotes,
    });
    
    if (!updated) {
      return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
    }
    
    res.json(updated);
  });

  app.get("/api/admin/stats", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const allBookings = await storage.getBookings();
    const today = new Date().toISOString().split("T")[0];
    
    const pending = allBookings.filter(b => b.status === "pending").length;
    const todayExams = allBookings.filter(b => b.bookingDate === today && b.status === "approved").length;
    
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const weekExams = allBookings.filter(b => {
      const bookingDate = new Date(b.bookingDate);
      return bookingDate >= weekStart && bookingDate < weekEnd && b.status === "approved";
    }).length;
    
    res.json({
      pending,
      todayExams,
      weekExams,
      total: allBookings.length,
    });
  });

  app.get("/api/admin/reports", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const allBookings = await storage.getBookings();
    const shifts = await storage.getShifts();
    
    const departmentStats = new Map<string, { total: number; approved: number; rejected: number; pending: number }>();
    const shiftStats = new Map<string, number>();
    const monthlyStats = new Map<string, number>();
    
    for (const booking of allBookings) {
      const dept = departmentStats.get(booking.departmentId) || { total: 0, approved: 0, rejected: 0, pending: 0 };
      dept.total++;
      if (booking.status === "approved") dept.approved++;
      else if (booking.status === "rejected") dept.rejected++;
      else if (booking.status === "pending") dept.pending++;
      departmentStats.set(booking.departmentId, dept);
      
      if (booking.shiftId && booking.status === "approved") {
        const current = shiftStats.get(booking.shiftId) || 0;
        shiftStats.set(booking.shiftId, current + 1);
      }
      
      const month = booking.bookingDate.substring(0, 7);
      const monthCount = monthlyStats.get(month) || 0;
      monthlyStats.set(month, monthCount + 1);
    }
    
    const shiftStatsWithNames = Array.from(shiftStats.entries()).map(([shiftId, count]) => {
      const shift = shifts.find(s => s.id === shiftId);
      return {
        shiftId,
        shiftName: shift?.name || "Άγνωστο",
        startTime: shift?.startTime || "",
        endTime: shift?.endTime || "",
        count,
      };
    }).sort((a, b) => b.count - a.count);
    
    res.json({
      departmentStats: Array.from(departmentStats.entries()).map(([id, stats]) => ({ departmentId: id, ...stats })),
      shiftStats: shiftStatsWithNames,
      monthlyStats: Array.from(monthlyStats.entries()).map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
      totalBookings: allBookings.length,
      approvedBookings: allBookings.filter(b => b.status === "approved").length,
      rejectedBookings: allBookings.filter(b => b.status === "rejected").length,
      pendingBookings: allBookings.filter(b => b.status === "pending").length,
    });
  });

  app.get("/api/notifications", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const notificationsList = await storage.getNotificationsByUserId(userId);
    res.json(notificationsList);
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const count = await storage.getUnreadNotificationCount(userId);
    res.json({ count });
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const { id } = req.params;
    await storage.markNotificationAsRead(id, userId);
    res.json({ success: true });
  });

  app.put("/api/notifications/read-all", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    await storage.markAllNotificationsAsRead(userId);
    res.json({ success: true });
  });

  app.get("/api/waitlist", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const entries = await storage.getWaitlistByUserId(userId);
    res.json(entries);
  });

  app.post("/api/waitlist", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    try {
      const { departmentId, candidateCount, preferredDate, preferredShift } = req.body;
      
      if (!departmentId || !candidateCount || !preferredDate || !preferredShift) {
        return res.status(400).json({ error: "Λείπουν απαραίτητα πεδία" });
      }
      
      const entry = await storage.createWaitlistEntry({
        userId,
        departmentId,
        candidateCount,
        preferredDate,
        preferredShift,
      });
      
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating waitlist entry:", error);
      res.status(500).json({ error: "Σφάλμα κατά την εγγραφή στη λίστα αναμονής" });
    }
  });

  app.delete("/api/waitlist/:id", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const { id } = req.params;
    await storage.deleteWaitlistEntry(id, userId);
    res.json({ success: true });
  });

  const httpServer = createServer(app);
  return httpServer;
}
