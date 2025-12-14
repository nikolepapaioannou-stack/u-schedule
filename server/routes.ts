import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { storage, initializeDefaultData } from "./storage";
import { insertUserSchema, loginSchema, searchSlotsSchema, insertBookingSchema, insertClosedDateSchema } from "@shared/schema";
import { createHash, randomBytes } from "crypto";
import * as XLSX from "xlsx";

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

interface HourlySlot {
  hour: number;
  effectiveCapacity: number;
  bookedCandidates: number;
  availableCapacity: number;
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
    hourlySlots: HourlySlot[];
    splitInfo?: { dates: string[]; candidatesPerSlot: number[] };
  }> = [];
  
  const current = new Date(startDate);
  const end = new Date(endDate);
  end.setMonth(end.getMonth() + 2);
  
  while (current <= end) {
    const dateStr = current.toISOString().split("T")[0];
    
    if (!isWeekend(current) && !closedDatesSet.has(dateStr)) {
      const hourlyCapacities = await storage.getHourlyCapacitiesByDate(dateStr);
      const hourlyCapacityMap = new Map(hourlyCapacities.map(hc => [hc.hour, hc]));
      
      for (const shift of allShifts) {
        const existingBookings = await storage.getBookingsByDateAndShift(dateStr, shift.id);
        const bookedCandidates = existingBookings.reduce((sum, b) => sum + b.candidateCount, 0);
        const availableCapacity = shift.maxCandidates - bookedCandidates;
        
        const startHour = parseInt(shift.startTime.split(":")[0]);
        const endHour = parseInt(shift.endTime.split(":")[0]);
        const hourlySlots: HourlySlot[] = [];
        
        for (let hour = startHour; hour < endHour; hour++) {
          const hourlyCapacity = hourlyCapacityMap.get(hour);
          const hourBookings = await storage.getBookingsByDateAndHour(dateStr, hour);
          const hourBookedCandidates = hourBookings.reduce((sum, b) => sum + b.candidateCount, 0);
          
          // Use hourly capacity if configured, otherwise fall back to shift's max capacity
          const effectiveCapacity = hourlyCapacity?.effectiveCapacity ?? shift.maxCandidates;
          const hourAvailable = effectiveCapacity - hourBookedCandidates;
          
          if (hourAvailable > 0) {
            hourlySlots.push({
              hour,
              effectiveCapacity,
              bookedCandidates: hourBookedCandidates,
              availableCapacity: hourAvailable,
            });
          }
        }
        
        if (availableCapacity > 0 || hourlySlots.length > 0) {
          let priority = 3;
          
          const hasAvailableHour = hourlySlots.some(hs => hs.availableCapacity >= candidateCount);
          
          if (hasAvailableHour && shift.name === preferredShift) {
            priority = 1;
          } else if (hasAvailableHour) {
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
            isSplit: !hasAvailableHour && candidateCount > 0,
            hourlySlots,
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
      date: parsed.data.date,
      reason: parsed.data.reason ?? undefined,
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
    const { adminNotes, forceApprove } = req.body;
    
    const booking = await storage.getBooking(id);
    
    if (!booking) {
      return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
    }
    
    if (!booking.shiftId) {
      return res.status(400).json({ error: "Η κράτηση δεν έχει καθορισμένη βάρδια" });
    }
    
    let effectiveCapacity: number;
    let currentApprovedCandidates: number;
    let hasHourlyCapacity = false;
    let hasRoster = false;
    
    if (booking.examStartHour !== null && booking.examStartHour !== undefined) {
      const hourlyCapacity = await storage.getHourlyCapacityByDateAndHour(booking.bookingDate, booking.examStartHour);
      
      if (hourlyCapacity) {
        hasHourlyCapacity = true;
        effectiveCapacity = hourlyCapacity.effectiveCapacity;
        
        const existingBookings = await storage.getBookingsByDateAndHour(booking.bookingDate, booking.examStartHour);
        currentApprovedCandidates = existingBookings
          .filter(b => b.status === "approved" && b.id !== id)
          .reduce((sum, b) => sum + b.candidateCount, 0);
      } else {
        const roster = await storage.getProctorRosterByDateAndShift(booking.bookingDate, booking.shiftId);
        const shift = await storage.getShift(booking.shiftId);
        hasRoster = !!roster;
        
        const rosterCapacity = roster?.effectiveCapacity;
        const shiftCapacity = shift?.maxCandidates;
        
        if (rosterCapacity === undefined && (shiftCapacity === undefined || shiftCapacity === 0)) {
          return res.status(400).json({ 
            error: `Δεν έχει οριστεί χωρητικότητα για την ώρα ${booking.examStartHour}:00. Παρακαλώ ρυθμίστε το πρόγραμμα επιτηρητών.`,
            configurationMissing: true,
            examStartHour: booking.examStartHour,
          });
        }
        
        effectiveCapacity = rosterCapacity ?? shiftCapacity ?? 0;
        
        const existingBookings = await storage.getBookingsByDateAndShift(booking.bookingDate, booking.shiftId);
        currentApprovedCandidates = existingBookings
          .filter(b => b.status === "approved" && b.id !== id)
          .reduce((sum, b) => sum + b.candidateCount, 0);
      }
    } else {
      const roster = await storage.getProctorRosterByDateAndShift(booking.bookingDate, booking.shiftId);
      const shift = await storage.getShift(booking.shiftId);
      
      const rosterCapacity = roster?.effectiveCapacity;
      const shiftCapacity = shift?.maxCandidates;
      hasRoster = !!roster;
      
      if (rosterCapacity === undefined && (shiftCapacity === undefined || shiftCapacity === 0)) {
        return res.status(400).json({ 
          error: "Δεν έχει οριστεί χωρητικότητα για αυτή τη βάρδια. Παρακαλώ ρυθμίστε το πρόγραμμα επιτηρητών ή την μέγιστη χωρητικότητα βάρδιας.",
          configurationMissing: true,
        });
      }
      
      effectiveCapacity = rosterCapacity ?? shiftCapacity ?? 0;
      
      const existingBookings = await storage.getBookingsByDateAndShift(booking.bookingDate, booking.shiftId);
      currentApprovedCandidates = existingBookings
        .filter(b => b.status === "approved" && b.id !== id)
        .reduce((sum, b) => sum + b.candidateCount, 0);
    }
    
    const totalAfterApproval = currentApprovedCandidates + booking.candidateCount;
    const isOverCapacity = totalAfterApproval > effectiveCapacity;
    
    if (isOverCapacity && !forceApprove) {
      return res.status(409).json({
        error: "Υπέρβαση χωρητικότητας",
        capacityWarning: {
          effectiveCapacity,
          currentApproved: currentApprovedCandidates,
          requestedCandidates: booking.candidateCount,
          totalAfterApproval,
          overage: totalAfterApproval - effectiveCapacity,
          hasHourlyCapacity,
          hasRoster,
          examStartHour: booking.examStartHour,
        },
      });
    }
    
    const overrideData: {
      capacityOverrideBy?: string;
      capacityOverrideAt?: Date;
      capacityOverrideDetails?: string;
    } = {};
    
    if (isOverCapacity && forceApprove) {
      const timestamp = new Date();
      overrideData.capacityOverrideBy = adminId;
      overrideData.capacityOverrideAt = timestamp;
      overrideData.capacityOverrideDetails = JSON.stringify({
        effectiveCapacity,
        currentApproved: currentApprovedCandidates,
        requestedCandidates: booking.candidateCount,
        totalAfterApproval,
        overage: totalAfterApproval - effectiveCapacity,
        hasHourlyCapacity,
        hasRoster,
        examStartHour: booking.examStartHour,
      });
      console.log(`[CAPACITY OVERRIDE] Admin ${adminId} approved booking ${id} over capacity: ${totalAfterApproval}/${effectiveCapacity} at ${timestamp.toISOString()}`);
    }
    
    const updated = await storage.updateBooking(id, {
      status: "approved",
      adminNotes: adminNotes || undefined,
      ...overrideData,
    });
    
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

  app.post("/api/push-token", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    try {
      const { pushToken, platform } = req.body;
      
      if (!pushToken) {
        return res.status(400).json({ error: "Λείπει το push token" });
      }
      
      const token = await storage.savePushToken(userId, pushToken, platform);
      res.status(201).json(token);
    } catch (error) {
      console.error("Error saving push token:", error);
      res.status(500).json({ error: "Σφάλμα κατά την αποθήκευση του push token" });
    }
  });

  app.delete("/api/push-token", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    try {
      await storage.deletePushToken(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting push token:", error);
      res.status(500).json({ error: "Σφάλμα κατά τη διαγραφή του push token" });
    }
  });

  app.get("/api/proctor-rosters", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const rosters = await storage.getProctorRosters();
      res.json(rosters);
    } catch (error) {
      console.error("Error fetching proctor rosters:", error);
      res.status(500).json({ error: "Σφάλμα κατά την ανάκτηση προγράμματος επιτηρητών" });
    }
  });

  app.post("/api/proctor-rosters/upload", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const { data } = req.body;
      
      if (!data || !Array.isArray(data)) {
        return res.status(400).json({ error: "Μη έγκυρα δεδομένα" });
      }
      
      const appSettings = await storage.getSettings();
      const shifts = await storage.getShifts();
      const shiftMap = new Map(shifts.map(s => [s.name.toLowerCase(), s.id]));
      
      const validationErrors: Array<{ row: number; error: string }> = [];
      const processedRosters: Array<{
        date: string;
        shiftId: string;
        totalProctors: number;
        reserveProctors: number;
        effectiveCapacity: number;
        createdBy: string;
      }> = [];
      
      const dateRange = { start: "", end: "" };
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const { date, shift, proctorCount } = row;
        
        if (!date) {
          validationErrors.push({ row: i + 1, error: "Λείπει η ημερομηνία" });
          continue;
        }
        if (!shift) {
          validationErrors.push({ row: i + 1, error: "Λείπει η βάρδια" });
          continue;
        }
        if (typeof proctorCount !== "number" || proctorCount < 0) {
          validationErrors.push({ row: i + 1, error: "Μη έγκυρος αριθμός επιτηρητών" });
          continue;
        }
        
        const shiftId = shiftMap.get(shift.toLowerCase());
        if (!shiftId) {
          validationErrors.push({ row: i + 1, error: `Άγνωστη βάρδια: ${shift}` });
          continue;
        }
        
        if (!dateRange.start || date < dateRange.start) {
          dateRange.start = date;
        }
        if (!dateRange.end || date > dateRange.end) {
          dateRange.end = date;
        }
        
        const reserveProctors = Math.ceil(proctorCount * (appSettings.reservePercentage / 100));
        const effectiveProctors = proctorCount - reserveProctors;
        const effectiveCapacity = effectiveProctors * appSettings.candidatesPerProctor;
        
        processedRosters.push({
          date,
          shiftId,
          totalProctors: proctorCount,
          reserveProctors,
          effectiveCapacity,
          createdBy: adminId,
        });
      }
      
      if (processedRosters.length === 0) {
        return res.status(400).json({ 
          error: "Δεν βρέθηκαν έγκυρα δεδομένα επιτηρητών",
          validationErrors: validationErrors.length > 0 ? validationErrors : undefined,
        });
      }
      
      if (dateRange.start && dateRange.end) {
        await storage.deleteProctorRostersByDateRange(dateRange.start, dateRange.end);
      }
      
      const createdRosters = [];
      for (const roster of processedRosters) {
        const created = await storage.createProctorRoster(roster);
        createdRosters.push(created);
      }
      
      res.json({
        success: true,
        count: createdRosters.length,
        dateRange,
        skippedRows: validationErrors.length > 0 ? validationErrors : undefined,
      });
    } catch (error) {
      console.error("Error uploading proctor rosters:", error);
      res.status(500).json({ error: "Σφάλμα κατά τη μεταφόρτωση προγράμματος επιτηρητών" });
    }
  });

  app.post("/api/proctor-rosters/upload-excel", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const { excelData } = req.body;
      
      if (!excelData) {
        return res.status(400).json({ error: "Δεν βρέθηκε αρχείο Excel" });
      }
      
      const buffer = Buffer.from(excelData, "base64");
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      
      if (workbook.SheetNames.length === 0) {
        return res.status(400).json({ error: "Το αρχείο Excel είναι κενό" });
      }
      
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as unknown[][];
      
      if (rows.length < 3) {
        return res.status(400).json({ error: "Το αρχείο πρέπει να έχει τουλάχιστον 2 γραμμές επικεφαλίδων και δεδομένα επιτηρητών" });
      }
      
      const headerRow = rows[0] as (string | null)[];
      const dateRow = rows[1] as (string | number | null)[];
      
      if (!headerRow[0] || (typeof headerRow[0] === "string" && !headerRow[0].toLowerCase().includes("proctor"))) {
        return res.status(400).json({ 
          error: "Μη αναγνωρίσιμη μορφή Excel. Η πρώτη στήλη πρέπει να είναι 'PROCTOR'",
          foundHeader: headerRow[0],
        });
      }
      
      const parseTimeToMinutes = (timeStr: string): number => {
        const parts = timeStr.split(":");
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || "0", 10);
      };
      
      const parseWorkHours = (cell: unknown): { start: number; end: number } | null => {
        if (!cell || typeof cell !== "string") return null;
        const match = cell.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
        if (!match) return null;
        return {
          start: parseTimeToMinutes(match[1]),
          end: parseTimeToMinutes(match[2]),
        };
      };
      
      const canCoverShift = (proctorStart: number, proctorEnd: number, shiftStartTime: string, shiftEndTime: string): boolean => {
        const shiftStart = parseTimeToMinutes(shiftStartTime);
        const shiftEnd = parseTimeToMinutes(shiftEndTime);
        const proctorLastExamStart = proctorEnd - 60;
        const shiftLastExamStart = shiftEnd - 60;
        const proctorAvailableFrom = proctorStart;
        const proctorAvailableTo = proctorLastExamStart;
        const shiftExamFrom = shiftStart;
        const shiftExamTo = shiftLastExamStart;
        return proctorAvailableFrom <= shiftExamTo && proctorAvailableTo >= shiftExamFrom;
      };
      
      const dates: { colIndex: number; dateStr: string }[] = [];
      const currentYear = new Date().getFullYear();
      
      for (let col = 1; col < dateRow.length; col++) {
        const dateValue = dateRow[col];
        let dateStr: string | null = null;
        
        if (typeof dateValue === "number") {
          const excelDate = XLSX.SSF.parse_date_code(dateValue);
          dateStr = `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
        } else if (typeof dateValue === "string" && dateValue.trim()) {
          const parts = dateValue.split(/[\/\-\.]/);
          if (parts.length === 2) {
            const day = parts[0].padStart(2, "0");
            const month = parts[1].padStart(2, "0");
            const year = parseInt(month, 10) >= new Date().getMonth() + 1 ? currentYear : currentYear + 1;
            dateStr = `${year}-${month}-${day}`;
          } else if (parts.length === 3) {
            if (parts[2].length === 4) {
              dateStr = `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            } else {
              const year = parseInt(parts[2], 10) < 100 ? 2000 + parseInt(parts[2], 10) : parseInt(parts[2], 10);
              dateStr = `${year}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
            }
          }
        }
        
        if (dateStr) {
          dates.push({ colIndex: col, dateStr });
        }
      }
      
      if (dates.length === 0) {
        return res.status(400).json({ error: "Δεν βρέθηκαν έγκυρες ημερομηνίες στη δεύτερη γραμμή" });
      }
      
      const shifts = await storage.getShifts();
      const appSettings = await storage.getSettings();
      
      const shiftCounts: Map<string, Map<string, number>> = new Map();
      const hourlyCounts: Map<string, Map<number, number>> = new Map();
      
      for (const { dateStr } of dates) {
        const dateShifts = new Map<string, number>();
        for (const shift of shifts) {
          dateShifts.set(shift.id, 0);
        }
        shiftCounts.set(dateStr, dateShifts);
        hourlyCounts.set(dateStr, new Map<number, number>());
      }
      
      for (let rowIdx = 2; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (!row || !row[0]) continue;
        
        for (const { colIndex, dateStr } of dates) {
          const workHours = parseWorkHours(row[colIndex]);
          if (!workHours) continue;
          
          const dateShifts = shiftCounts.get(dateStr);
          if (!dateShifts) continue;
          
          for (const shift of shifts) {
            if (canCoverShift(workHours.start, workHours.end, shift.startTime, shift.endTime)) {
              dateShifts.set(shift.id, (dateShifts.get(shift.id) || 0) + 1);
            }
          }
          
          const dateHours = hourlyCounts.get(dateStr);
          if (!dateHours) continue;
          
          const startHour = Math.floor(workHours.start / 60);
          const lastExamStartMinutes = workHours.end - 60;
          const lastExamHour = Math.floor(lastExamStartMinutes / 60);
          
          for (let hour = startHour; hour <= lastExamHour; hour++) {
            dateHours.set(hour, (dateHours.get(hour) || 0) + 1);
          }
        }
      }
      
      const processedRosters: Array<{
        date: string;
        shiftId: string;
        totalProctors: number;
        reserveProctors: number;
        effectiveCapacity: number;
        createdBy: string;
      }> = [];
      
      const sortedDates = Array.from(shiftCounts.keys()).sort();
      const dateRange = {
        start: sortedDates[0] || "",
        end: sortedDates[sortedDates.length - 1] || "",
      };
      
      console.log("[Excel Upload] Settings:", JSON.stringify({
        candidatesPerProctor: appSettings.candidatesPerProctor,
        reservePercentage: appSettings.reservePercentage,
      }));
      
      for (const [dateStr, shiftMap] of shiftCounts) {
        for (const [shiftId, proctorCount] of shiftMap) {
          const reserveProctors = Math.ceil(proctorCount * (appSettings.reservePercentage / 100));
          const effectiveProctors = proctorCount - reserveProctors;
          const effectiveCapacity = effectiveProctors * appSettings.candidatesPerProctor;
          
          const shift = shifts.find(s => s.id === shiftId);
          console.log(`[Excel Upload] Date: ${dateStr}, Shift: ${shift?.name}, Proctors: ${proctorCount}, Reserve: ${reserveProctors}, Effective: ${effectiveProctors}, Capacity: ${effectiveCapacity}`);
          
          processedRosters.push({
            date: dateStr,
            shiftId,
            totalProctors: proctorCount,
            reserveProctors,
            effectiveCapacity,
            createdBy: adminId,
          });
        }
      }
      
      if (processedRosters.length === 0) {
        return res.status(400).json({ error: "Δεν βρέθηκαν έγκυρα δεδομένα επιτηρητών" });
      }
      
      const processedHourlyCapacities: Array<{
        date: string;
        hour: number;
        totalProctors: number;
        reserveProctors: number;
        effectiveCapacity: number;
        createdBy: string;
      }> = [];
      
      for (const [dateStr, hourMap] of hourlyCounts) {
        for (const [hour, proctorCount] of hourMap) {
          const reserveProctors = Math.ceil(proctorCount * (appSettings.reservePercentage / 100));
          const effectiveProctors = proctorCount - reserveProctors;
          const effectiveCapacity = effectiveProctors * appSettings.candidatesPerProctor;
          
          console.log(`[Excel Upload] Date: ${dateStr}, Hour: ${hour}:00, Proctors: ${proctorCount}, Reserve: ${reserveProctors}, Effective: ${effectiveProctors}, Capacity: ${effectiveCapacity}`);
          
          processedHourlyCapacities.push({
            date: dateStr,
            hour,
            totalProctors: proctorCount,
            reserveProctors,
            effectiveCapacity,
            createdBy: adminId,
          });
        }
      }
      
      if (dateRange.start && dateRange.end) {
        await storage.deleteProctorRostersByDateRange(dateRange.start, dateRange.end);
        await storage.deleteHourlyCapacitiesByDateRange(dateRange.start, dateRange.end);
      }
      
      const createdRosters = [];
      for (const roster of processedRosters) {
        const created = await storage.createProctorRoster(roster);
        createdRosters.push(created);
      }
      
      const createdHourlyCapacities = [];
      for (const capacity of processedHourlyCapacities) {
        const created = await storage.createHourlyCapacity(capacity);
        createdHourlyCapacities.push(created);
      }
      
      const proctorCount = rows.length - 2;
      
      const hourlyCapacitySummary: Record<string, Record<number, number>> = {};
      for (const cap of createdHourlyCapacities) {
        if (!hourlyCapacitySummary[cap.date]) {
          hourlyCapacitySummary[cap.date] = {};
        }
        hourlyCapacitySummary[cap.date][cap.hour] = cap.effectiveCapacity;
      }
      
      res.json({
        success: true,
        count: createdRosters.length,
        hourlyCapacitiesCount: createdHourlyCapacities.length,
        dateRange,
        proctorsProcessed: proctorCount,
        datesProcessed: dates.length,
        shiftsPerDate: shifts.length,
        hourlyCapacitySummary,
      });
    } catch (error) {
      console.error("Error uploading Excel proctor rosters:", error);
      res.status(500).json({ error: "Σφάλμα κατά τη μεταφόρτωση αρχείου Excel" });
    }
  });

  app.delete("/api/proctor-rosters", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const { startDate, endDate } = req.body;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Απαιτούνται ημερομηνίες έναρξης και λήξης" });
      }
      
      await storage.deleteProctorRostersByDateRange(startDate, endDate);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting proctor rosters:", error);
      res.status(500).json({ error: "Σφάλμα κατά τη διαγραφή προγράμματος επιτηρητών" });
    }
  });

  app.get("/api/capacity/hourly", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const { start, end } = req.query;
      
      if (!start || !end || typeof start !== "string" || typeof end !== "string") {
        return res.status(400).json({ error: "Απαιτούνται παράμετροι start και end" });
      }
      
      const hourlyCapacities = await storage.getHourlyCapacitiesInRange(start, end);
      
      const groupedByDate: Record<string, Array<{
        hour: number;
        totalProctors: number;
        reserveProctors: number;
        effectiveCapacity: number;
      }>> = {};
      
      for (const cap of hourlyCapacities) {
        if (!groupedByDate[cap.date]) {
          groupedByDate[cap.date] = [];
        }
        groupedByDate[cap.date].push({
          hour: cap.hour,
          totalProctors: cap.totalProctors,
          reserveProctors: cap.reserveProctors,
          effectiveCapacity: cap.effectiveCapacity,
        });
      }
      
      for (const date of Object.keys(groupedByDate)) {
        groupedByDate[date].sort((a, b) => a.hour - b.hour);
      }
      
      res.json({
        dateRange: { start, end },
        data: groupedByDate,
      });
    } catch (error) {
      console.error("Error fetching hourly capacities:", error);
      res.status(500).json({ error: "Σφάλμα κατά την ανάκτηση ωριαίας χωρητικότητας" });
    }
  });

  app.get("/api/capacity/hourly/:date/:hour", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    try {
      const { date, hour } = req.params;
      const hourNum = parseInt(hour, 10);
      
      if (isNaN(hourNum)) {
        return res.status(400).json({ error: "Μη έγκυρη ώρα" });
      }
      
      const capacity = await storage.getHourlyCapacityByDateAndHour(date, hourNum);
      
      if (capacity) {
        const existingBookings = await storage.getBookingsByDateAndHour(date, hourNum);
        const bookedCandidates = existingBookings
          .filter(b => b.status === "approved" || b.status === "pending" || b.status === "holding")
          .reduce((sum, b) => sum + b.candidateCount, 0);
        
        return res.json({
          hasHourlyCapacity: true,
          effectiveCapacity: capacity.effectiveCapacity,
          totalProctors: capacity.totalProctors,
          reserveProctors: capacity.reserveProctors,
          bookedCandidates,
          availableCapacity: capacity.effectiveCapacity - bookedCandidates,
        });
      }
      
      const appSettings = await storage.getSettings();
      res.json({
        hasHourlyCapacity: false,
        effectiveCapacity: appSettings.maxCandidatesPerDay,
        totalProctors: null,
        reserveProctors: null,
        bookedCandidates: 0,
        availableCapacity: appSettings.maxCandidatesPerDay,
      });
    } catch (error) {
      console.error("Error fetching hourly capacity:", error);
      res.status(500).json({ error: "Σφάλμα κατά την ανάκτηση ωριαίας χωρητικότητας" });
    }
  });

  app.get("/api/proctor-rosters/capacity/:date/:shiftId", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    try {
      const { date, shiftId } = req.params;
      
      const roster = await storage.getProctorRosterByDateAndShift(date, shiftId);
      
      if (roster) {
        return res.json({
          hasRoster: true,
          effectiveCapacity: roster.effectiveCapacity,
          totalProctors: roster.totalProctors,
          reserveProctors: roster.reserveProctors,
        });
      }
      
      const shift = await storage.getShift(shiftId);
      const appSettings = await storage.getSettings();
      
      res.json({
        hasRoster: false,
        effectiveCapacity: shift?.maxCandidates || appSettings.maxCandidatesPerDay,
        totalProctors: null,
        reserveProctors: null,
      });
    } catch (error) {
      console.error("Error fetching capacity:", error);
      res.status(500).json({ error: "Σφάλμα κατά την ανάκτηση χωρητικότητας" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
