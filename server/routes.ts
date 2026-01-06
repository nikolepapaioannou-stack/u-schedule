import type { Express, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { storage, initializeDefaultData } from "./storage";
import { insertUserSchema, loginSchema, searchSlotsSchema, insertBookingSchema, insertClosedDateSchema, adminCreateUserSchema, updateUserRoleSchema, userRoles, type UserRole } from "@shared/schema";
import { createHash, randomBytes } from "crypto";
import * as XLSX from "xlsx";

let wss: WebSocketServer | null = null;

interface BookingEvent {
  type: 'booking:created' | 'booking:submitted' | 'booking:approved' | 'booking:rejected';
  booking: {
    id: string;
    departmentId: string;
    candidateCount: number;
    bookingDate: string;
    status: string;
    userId: string;
  };
  timestamp: string;
}

interface SettingsEvent {
  type: 'settings:updated';
  settings: {
    workingDaysRule: number;
    holdDurationMinutes: number;
    maxCandidatesPerDay: number;
    candidatesPerProctor: number;
    reservePercentage: number;
  };
  updatedBy: string;
  timestamp: string;
}

type WebSocketEvent = BookingEvent | SettingsEvent;

function broadcastEvent(event: WebSocketEvent) {
  if (!wss) return;
  
  const message = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
  console.log(`[WebSocket] Broadcast event: ${event.type}`);
}

function broadcastBookingEvent(event: BookingEvent) {
  broadcastEvent(event);
}

function broadcastSettingsEvent(settings: SettingsEvent['settings'], updatedBy: string) {
  broadcastEvent({
    type: 'settings:updated',
    settings,
    updatedBy,
    timestamp: new Date().toISOString(),
  });
}

async function sendExpoPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const pushTokens = await storage.getPushTokensByUserId(userId);
    if (!pushTokens || pushTokens.length === 0) {
      console.log(`[Push] No push tokens found for user ${userId}`);
      return;
    }

    for (const tokenRecord of pushTokens) {
      const message = {
        to: tokenRecord.token,
        sound: 'default',
        title,
        body,
        data: data || {},
      };

      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        const result = await response.json();
        if (result.data?.status === 'error') {
          console.error(`[Push] Failed to send to ${tokenRecord.token}:`, result.data.message);
        } else {
          console.log(`[Push] Sent notification to user ${userId}`);
        }
      } catch (error) {
        console.error(`[Push] Error sending to ${tokenRecord.token}:`, error);
      }
    }
  } catch (error) {
    console.error(`[Push] Error getting tokens for user ${userId}:`, error);
  }
}

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

async function createSession(userId: string): Promise<string> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  try {
    await storage.createSession(token, userId, expiresAt);
    console.log(`Session created for user ${userId}, token: ${token.slice(0, 8)}...`);
  } catch (error) {
    console.error("Failed to create session:", error);
    throw error;
  }
  return token;
}

async function validateSession(token: string): Promise<string | null> {
  console.log(`[validateSession] Looking up token: ${token.slice(0, 8)}...`);
  const session = await storage.getSession(token);
  if (!session) {
    console.log(`[validateSession] No session found for token: ${token.slice(0, 8)}...`);
    return null;
  }
  console.log(`[validateSession] Found session for user: ${session.userId}, expires: ${session.expiresAt}`);
  if (session.expiresAt < new Date()) {
    console.log(`[validateSession] Session expired, deleting...`);
    await storage.deleteSession(token);
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
  const userId = await validateSession(token);
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
  if (!user?.isAdmin && user?.role !== 'admin' && user?.role !== 'superadmin') {
    res.status(403).json({ error: "Απαιτούνται δικαιώματα διαχειριστή" });
    return null;
  }
  return userId;
}

async function requireSuperAdmin(req: Request, res: Response): Promise<string | null> {
  const userId = await requireAuth(req, res);
  if (!userId) return null;
  
  const user = await storage.getUser(userId);
  if (user?.role !== 'superadmin') {
    res.status(403).json({ error: "Απαιτούνται δικαιώματα κεντρικού διαχειριστή" });
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
      // Ensure hour keys are numbers for proper Map lookup
      const hourlyCapacityMap = new Map(hourlyCapacities.map(hc => [Number(hc.hour), hc]));
      console.log(`[DEBUG] Date: ${dateStr}, hourlyCapacities count: ${hourlyCapacities.length}, hours: ${hourlyCapacities.map(hc => hc.hour).join(',')}`);
      
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
          
          // Use hourly capacity if configured and > 0, otherwise fall back to shift's max capacity
          const effectiveCapacity = hourlyCapacity?.effectiveCapacity || shift.maxCandidates;
          const hourAvailable = effectiveCapacity - hourBookedCandidates;
          
          console.log(`[DEBUG] ${dateStr} ${shift.name} hour ${hour}: capacity=${effectiveCapacity}, booked=${hourBookedCandidates}, available=${hourAvailable}`);
          
          if (hourAvailable > 0) {
            hourlySlots.push({
              hour,
              effectiveCapacity,
              bookedCandidates: hourBookedCandidates,
              availableCapacity: hourAvailable,
            });
          }
        }
        console.log(`[DEBUG] ${dateStr} ${shift.name}: hourlySlots.length = ${hourlySlots.length}`);
        
        
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
      
      const token = await createSession(user.id);
      
      res.json({
        user: { 
          id: user.id, 
          email: user.email, 
          ugrId: user.ugrId, 
          isAdmin: user.isAdmin,
          role: user.role || 'user',
        },
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
        console.log("[Login] Invalid input:", parsed.error);
        return res.status(400).json({ error: "Μη έγκυρα στοιχεία σύνδεσης" });
      }
      
      const { email, password } = parsed.data;
      console.log("[Login] Attempting login for:", email);
      
      const user = await storage.getUserByEmail(email);
      console.log("[Login] User found:", user ? user.email : "NOT FOUND");
      
      const inputHash = hashPassword(password);
      console.log("[Login] Input password hash:", inputHash);
      console.log("[Login] Stored password hash:", user?.password);
      console.log("[Login] Hashes match:", user?.password === inputHash);
      
      if (!user || user.password !== inputHash) {
        return res.status(401).json({ error: "Λάθος email ή κωδικός" });
      }
      
      const token = await createSession(user.id);
      
      res.json({
        user: { 
          id: user.id, 
          email: user.email, 
          ugrId: user.ugrId, 
          isAdmin: user.isAdmin,
          role: user.role || (user.isAdmin ? 'superadmin' : 'user'),
        },
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
      role: user.role || (user.isAdmin ? 'superadmin' : 'user'),
      biometricEnabled: user.biometricEnabled,
    });
  });

  app.post("/api/auth/logout", async (req, res) => {
    const token = getAuthToken(req);
    if (token) {
      await storage.deleteSession(token);
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

  // User Management - Super Admin only for creating admins
  app.get("/api/admin/users", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const allUsers = await storage.getAllUsers();
      res.json(allUsers.map(u => ({
        id: u.id,
        email: u.email,
        ugrId: u.ugrId,
        role: u.role || (u.isAdmin ? 'superadmin' : 'user'),
        isAdmin: u.isAdmin,
        createdAt: u.createdAt,
      })));
    } catch (error) {
      console.error("Get users error:", error);
      res.status(500).json({ error: "Σφάλμα κατά την ανάκτηση χρηστών" });
    }
  });

  app.post("/api/admin/users", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const parsed = adminCreateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Μη έγκυρα δεδομένα", details: parsed.error.errors });
      }
      
      const { email, password, ugrId, role } = parsed.data;
      
      // Only superadmin can create admin or superadmin users
      const admin = await storage.getUser(adminId);
      const isSuperAdmin = admin?.role === 'superadmin' || (admin?.isAdmin && !admin?.role);
      if ((role === 'admin' || role === 'superadmin') && !isSuperAdmin) {
        return res.status(403).json({ error: "Μόνο ο κεντρικός διαχειριστής μπορεί να δημιουργήσει λογαριασμούς διαχειριστών" });
      }
      
      // Check if email already exists
      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        return res.status(409).json({ error: "Το email χρησιμοποιείται ήδη" });
      }
      
      // Check if UGR ID already exists
      const existingUgr = await storage.getUserByUgrId(ugrId);
      if (existingUgr) {
        return res.status(409).json({ error: "Το UGR ID χρησιμοποιείται ήδη" });
      }
      
      const hashedPassword = hashPassword(password);
      const newUser = await storage.createUserWithRole({
        email,
        password: hashedPassword,
        ugrId,
        role,
        isAdmin: role === 'admin' || role === 'superadmin',
      });
      
      res.status(201).json({
        id: newUser.id,
        email: newUser.email,
        ugrId: newUser.ugrId,
        role: newUser.role,
        isAdmin: newUser.isAdmin,
        createdAt: newUser.createdAt,
      });
    } catch (error) {
      console.error("Create user error:", error);
      res.status(500).json({ error: "Σφάλμα κατά τη δημιουργία χρήστη" });
    }
  });

  app.put("/api/admin/users/:id/role", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const { id } = req.params;
      const parsed = updateUserRoleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Μη έγκυρος ρόλος" });
      }
      
      const { role } = parsed.data;
      
      // Prevent changing own role
      if (id === adminId) {
        return res.status(400).json({ error: "Δεν μπορείτε να αλλάξετε τον δικό σας ρόλο" });
      }
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "Ο χρήστης δεν βρέθηκε" });
      }
      
      const admin = await storage.getUser(adminId);
      // Check for superadmin: either explicit role OR legacy isAdmin with no role
      const isSuperAdmin = admin?.role === 'superadmin' || (admin?.isAdmin && !admin?.role);
      const targetIsPrivileged = user.role === 'admin' || user.role === 'superadmin' || user.isAdmin;
      
      // Only superadmin can modify admin/superadmin users
      if (targetIsPrivileged && !isSuperAdmin) {
        return res.status(403).json({ error: "Μόνο ο κεντρικός διαχειριστής μπορεί να τροποποιήσει διαχειριστές" });
      }
      
      // Only superadmin can promote to admin or superadmin
      if ((role === 'admin' || role === 'superadmin') && !isSuperAdmin) {
        return res.status(403).json({ error: "Μόνο ο κεντρικός διαχειριστής μπορεί να αναβαθμίσει χρήστες σε διαχειριστές" });
      }
      
      const updated = await storage.updateUserRole(id, role);
      res.json({
        id: updated.id,
        email: updated.email,
        ugrId: updated.ugrId,
        role: updated.role,
        isAdmin: updated.isAdmin,
      });
    } catch (error) {
      console.error("Update role error:", error);
      res.status(500).json({ error: "Σφάλμα κατά την ενημέρωση ρόλου" });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const { id } = req.params;
      
      // Prevent deleting self
      if (id === adminId) {
        return res.status(400).json({ error: "Δεν μπορείτε να διαγράψετε τον εαυτό σας" });
      }
      
      const user = await storage.getUser(id);
      if (!user) {
        return res.status(404).json({ error: "Ο χρήστης δεν βρέθηκε" });
      }
      
      // Only superadmin can delete admin/superadmin users
      const admin = await storage.getUser(adminId);
      // Check for superadmin: either explicit role OR legacy isAdmin with no role
      const isSuperAdmin = admin?.role === 'superadmin' || (admin?.isAdmin && !admin?.role);
      const targetIsPrivileged = user.role === 'admin' || user.role === 'superadmin' || user.isAdmin;
      
      if (targetIsPrivileged && !isSuperAdmin) {
        return res.status(403).json({ error: "Μόνο ο κεντρικός διαχειριστής μπορεί να διαγράψει διαχειριστές" });
      }
      
      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Delete user error:", error);
      res.status(500).json({ error: "Σφάλμα κατά τη διαγραφή χρήστη" });
    }
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
    
    broadcastSettingsEvent({
      workingDaysRule: updated.workingDaysRule,
      holdDurationMinutes: updated.holdDurationMinutes,
      maxCandidatesPerDay: updated.maxCandidatesPerDay,
      candidatesPerProctor: updated.candidatesPerProctor,
      reservePercentage: updated.reservePercentage,
    }, adminId);
    
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

  app.get("/api/approved-bookings", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    const allBookings = await storage.getBookings();
    const approvedBookings = allBookings
      .filter(b => b.status === "approved")
      .map(b => ({
        id: b.id,
        bookingDate: b.bookingDate,
        departmentId: b.departmentId,
        examStartHour: b.examStartHour,
        candidateCount: b.candidateCount,
        preferredShift: b.preferredShift,
      }));
    res.json(approvedBookings);
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
      const closedDatesMap = new Map(closedDatesData.map(cd => [cd.date, cd.reason]));
      const settings = await storage.getSettings();
      const allShifts = await storage.getShifts();
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const courseEnd = new Date(courseEndDate);
      const referenceDate = courseEnd >= today ? courseEnd : today;
      
      const minDate = addWorkingDays(referenceDate, settings.workingDaysRule, closedDatesSet);
      
      const slots = await getAvailableSlots(minDate, minDate, candidateCount, preferredShift);
      
      // Collect unavailable dates (closed and fully booked) for display
      const unavailableDates: Array<{ date: string; reason: string; type: 'closed' | 'full' }> = [];
      
      // Iterate through dates from minDate to 2 months ahead
      const current = new Date(minDate);
      const end = new Date(minDate);
      end.setMonth(end.getMonth() + 2);
      
      while (current <= end) {
        const dateStr = current.toISOString().split("T")[0];
        
        if (!isWeekend(current)) {
          // Check if date is admin-closed
          if (closedDatesSet.has(dateStr)) {
            const reason = closedDatesMap.get(dateStr);
            unavailableDates.push({
              date: dateStr,
              reason: reason || "Μη διαθέσιμη ημερομηνία",
              type: 'closed',
            });
          } else {
            // Check if date is fully booked (no capacity in any shift)
            let hasCapacity = false;
            for (const shift of allShifts) {
              const existingBookings = await storage.getBookingsByDateAndShift(dateStr, shift.id);
              const bookedCandidates = existingBookings.reduce((sum, b) => sum + b.candidateCount, 0);
              if (bookedCandidates < shift.maxCandidates) {
                hasCapacity = true;
                break;
              }
            }
            
            if (!hasCapacity && allShifts.length > 0) {
              unavailableDates.push({
                date: dateStr,
                reason: "Πλήρως καλυμμένη ημερομηνία",
                type: 'full',
              });
            }
          }
        }
        
        current.setDate(current.getDate() + 1);
      }
      
      res.json({
        minDate: minDate.toISOString().split("T")[0],
        slots,
        unavailableDates,
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
      const bookingsWithUser = await Promise.all(
        allBookings.map(async (booking) => {
          const bookingUser = await storage.getUser(booking.userId);
          return {
            ...booking,
            user: bookingUser ? { email: bookingUser.email, ugrId: bookingUser.ugrId } : null,
          };
        })
      );
      return res.json(bookingsWithUser);
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
    
    if (updated) {
      broadcastBookingEvent({
        type: 'booking:submitted',
        booking: {
          id: updated.id,
          departmentId: updated.departmentId,
          candidateCount: updated.candidateCount,
          bookingDate: updated.bookingDate,
          status: updated.status,
          userId: updated.userId,
        },
        timestamp: new Date().toISOString(),
      });
      
      await storage.createNotification({
        userId,
        type: "booking_submitted",
        title: "Κράτηση Υποβλήθηκε",
        message: `Η κράτησή σας για το τμήμα ${updated.departmentId} υποβλήθηκε και αναμένει έγκριση.`,
        bookingId: updated.id,
      });
    }
    
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
    
    if (updated) {
      await storage.addBookingHistory({
        bookingId: id,
        eventType: "approved",
        description: `Κράτηση εγκρίθηκε${isOverCapacity && forceApprove ? " (υπέρβαση χωρητικότητας)" : ""}`,
        performedBy: adminId,
        metadata: adminNotes ? JSON.stringify({ adminNotes }) : undefined,
      });
      
      broadcastBookingEvent({
        type: 'booking:approved',
        booking: {
          id: updated.id,
          departmentId: updated.departmentId,
          candidateCount: updated.candidateCount,
          bookingDate: updated.bookingDate,
          status: updated.status,
          userId: updated.userId,
        },
        timestamp: new Date().toISOString(),
      });
      
      await storage.createNotification({
        userId: updated.userId,
        type: "booking_approved",
        title: "Κράτηση Εγκρίθηκε",
        message: `Η κράτησή σας για το τμήμα ${updated.departmentId} εγκρίθηκε για ${new Date(updated.bookingDate).toLocaleDateString("el-GR")}.`,
        bookingId: updated.id,
      });

      await sendExpoPushNotification(
        updated.userId,
        "Κράτηση Εγκρίθηκε",
        `Η κράτησή σας για ${new Date(updated.bookingDate).toLocaleDateString("el-GR")} εγκρίθηκε.`,
        { bookingId: updated.id, type: "booking_approved" }
      );
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
    
    await storage.addBookingHistory({
      bookingId: id,
      eventType: "rejected",
      description: `Κράτηση απορρίφθηκε: ${adminNotes}`,
      performedBy: adminId,
      metadata: JSON.stringify({ adminNotes }),
    });
    
    broadcastBookingEvent({
      type: 'booking:rejected',
      booking: {
        id: updated.id,
        departmentId: updated.departmentId,
        candidateCount: updated.candidateCount,
        bookingDate: updated.bookingDate,
        status: updated.status,
        userId: updated.userId,
      },
      timestamp: new Date().toISOString(),
    });
    
    await storage.createNotification({
      userId: updated.userId,
      type: "booking_rejected",
      title: "Κράτηση Απορρίφθηκε",
      message: `Η κράτησή σας για το τμήμα ${updated.departmentId} απορρίφθηκε.${adminNotes ? ` Λόγος: ${adminNotes}` : ''}`,
      bookingId: updated.id,
    });

    await sendExpoPushNotification(
      updated.userId,
      "Κράτηση Απορρίφθηκε",
      `Η κράτησή σας για ${new Date(updated.bookingDate).toLocaleDateString("el-GR")} απορρίφθηκε.`,
      { bookingId: updated.id, type: "booking_rejected" }
    );
    
    res.json(updated);
  });

  app.get("/api/admin/bookings", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const allBookings = await storage.getBookings();
    const bookingsWithUser = await Promise.all(
      allBookings.map(async (booking) => {
        const bookingUser = await storage.getUser(booking.userId);
        return {
          ...booking,
          user: bookingUser ? { email: bookingUser.email, ugrId: bookingUser.ugrId } : null,
        };
      })
    );
    res.json(bookingsWithUser);
  });

  app.put("/api/admin/bookings/:id/approve", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const { id } = req.params;
    const { adminNotes, forceApprove } = req.body;
    
    const booking = await storage.getBooking(id);
    if (!booking) {
      return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
    }
    
    const updated = await storage.updateBooking(id, {
      status: "approved",
      adminNotes: adminNotes || undefined,
    });
    
    if (updated) {
      broadcastBookingEvent({
        type: 'booking:approved',
        booking: {
          id: updated.id,
          departmentId: updated.departmentId,
          candidateCount: updated.candidateCount,
          bookingDate: updated.bookingDate,
          status: updated.status,
          userId: updated.userId,
        },
        timestamp: new Date().toISOString(),
      });
      
      await storage.createNotification({
        userId: updated.userId,
        type: "booking_approved",
        title: "Κράτηση Εγκρίθηκε",
        message: `Η κράτησή σας για το τμήμα ${updated.departmentId} εγκρίθηκε για ${new Date(updated.bookingDate).toLocaleDateString("el-GR")}.`,
        bookingId: updated.id,
      });

      await sendExpoPushNotification(
        updated.userId,
        "Κράτηση Εγκρίθηκε",
        `Η κράτησή σας για ${new Date(updated.bookingDate).toLocaleDateString("el-GR")} εγκρίθηκε.`,
        { bookingId: updated.id, type: "booking_approved" }
      );
    }
    
    res.json(updated);
  });

  app.put("/api/admin/bookings/:id/reject", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const { id } = req.params;
    const { reason } = req.body;
    
    const updated = await storage.updateBooking(id, {
      status: "rejected",
      adminNotes: reason || undefined,
    });
    
    if (!updated) {
      return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
    }
    
    broadcastBookingEvent({
      type: 'booking:rejected',
      booking: {
        id: updated.id,
        departmentId: updated.departmentId,
        candidateCount: updated.candidateCount,
        bookingDate: updated.bookingDate,
        status: updated.status,
        userId: updated.userId,
      },
      timestamp: new Date().toISOString(),
    });
    
    await storage.createNotification({
      userId: updated.userId,
      type: "booking_rejected",
      title: "Κράτηση Απορρίφθηκε",
      message: `Η κράτησή σας για το τμήμα ${updated.departmentId} απορρίφθηκε.${reason ? ` Λόγος: ${reason}` : ''}`,
      bookingId: updated.id,
    });

    await sendExpoPushNotification(
      updated.userId,
      "Κράτηση Απορρίφθηκε",
      `Η κράτησή σας για ${new Date(updated.bookingDate).toLocaleDateString("el-GR")} απορρίφθηκε.`,
      { bookingId: updated.id, type: "booking_rejected" }
    );
    
    res.json(updated);
  });

  app.get("/api/admin/stats", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    const allBookings = await storage.getBookings();
    const today = new Date().toISOString().split("T")[0];
    
    const pendingApprovals = allBookings.filter(b => b.status === "pending").length;
    const todayBookings = allBookings.filter(b => b.bookingDate === today && b.status === "approved").length;
    const totalApproved = allBookings.filter(b => b.status === "approved").length;
    
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];
    
    const weekBookings = allBookings.filter(b => {
      return b.bookingDate >= weekStartStr && b.bookingDate <= weekEndStr && b.status === "approved";
    }).length;
    
    res.json({
      todayBookings,
      pendingApprovals,
      weekBookings,
      totalApproved,
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

  // External action tracking endpoints
  
  // Get bookings with pending actions (for admin dashboard)
  app.get("/api/external-actions/pending", async (req, res) => {
    const userId = await requireAdmin(req, res);
    if (!userId) return;
    
    try {
      const bookings = await storage.getBookingsWithPendingActions();
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching pending actions:", error);
      res.status(500).json({ error: "Σφάλμα κατά την ανάκτηση εκκρεμοτήτων" });
    }
  });
  
  // Get bookings pending verification (user marked complete, admin needs to verify)
  app.get("/api/external-actions/pending-verification", async (req, res) => {
    const userId = await requireAdmin(req, res);
    if (!userId) return;
    
    try {
      const bookings = await storage.getBookingsPendingVerification();
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching pending verification:", error);
      res.status(500).json({ error: "Σφάλμα κατά την ανάκτηση προς επαλήθευση" });
    }
  });
  
  // User marks external action as completed
  app.post("/api/bookings/:id/external-action/complete", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    try {
      const { id } = req.params;
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
      }
      
      if (booking.userId !== userId) {
        return res.status(403).json({ error: "Δεν έχετε πρόσβαση σε αυτή την κράτηση" });
      }
      
      if (booking.status !== "approved") {
        return res.status(400).json({ error: "Η κράτηση δεν είναι εγκεκριμένη" });
      }
      
      const updated = await storage.markExternalActionUserCompleted(id);
      
      await storage.addBookingHistory({
        bookingId: id,
        eventType: "voucher_user_completed",
        description: "Ο χρήστης δήλωσε ολοκλήρωση ανάρτησης voucher",
        performedBy: userId,
      });
      
      // Format date as DD/MM/YYYY
      const examDate = new Date(booking.bookingDate);
      const formattedDate = `${String(examDate.getDate()).padStart(2, '0')}/${String(examDate.getMonth() + 1).padStart(2, '0')}/${examDate.getFullYear()}`;
      
      // Notify admins
      const admins = await storage.getAdminUsers();
      for (const admin of admins) {
        await storage.createNotification({
          userId: admin.id,
          type: 'action_user_completed',
          title: 'Ανάρτηση Voucher Προς Επαλήθευση',
          message: `Ο χρήστης δήλωσε ότι ανάρτησε τους κωδικούς επιταγής για το τμήμα ${booking.departmentId} (${formattedDate}). Παρακαλώ επιβεβαιώστε.`,
          bookingId: id,
        });
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Error marking action complete:", error);
      res.status(500).json({ error: "Σφάλμα κατά την ενημέρωση" });
    }
  });
  
  // Admin verifies external action
  app.post("/api/bookings/:id/external-action/verify", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const { id } = req.params;
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
      }
      
      if (booking.status !== "approved") {
        return res.status(400).json({ error: "Η κράτηση δεν είναι εγκεκριμένη" });
      }
      
      if (booking.externalActionStatus === "verified") {
        return res.status(400).json({ error: "Η ενέργεια είναι ήδη επαληθευμένη" });
      }
      
      const updated = await storage.verifyExternalAction(id);
      
      await storage.addBookingHistory({
        bookingId: id,
        eventType: "voucher_verified",
        description: "Η ανάρτηση voucher επιβεβαιώθηκε από διαχειριστή",
        performedBy: adminId,
      });
      
      // Format date as DD/MM/YYYY
      const examDate = new Date(booking.bookingDate);
      const formattedDate = `${String(examDate.getDate()).padStart(2, '0')}/${String(examDate.getMonth() + 1).padStart(2, '0')}/${examDate.getFullYear()}`;
      
      // Notify user
      await storage.createNotification({
        userId: booking.userId,
        type: 'action_verified',
        title: 'Επιβεβαίωση ανάρτησης Voucher',
        message: `Η ανάρτηση των κωδικών επιταγής για το τμήμα ${booking.departmentId} (${formattedDate}) επιβεβαιώθηκε επιτυχώς. Η εξέταση θα διεξαχθεί κανονικά.`,
        bookingId: id,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error verifying action:", error);
      res.status(500).json({ error: "Σφάλμα κατά την επιβεβαίωση" });
    }
  });
  
  // Admin rejects external action (user needs to redo)
  app.post("/api/bookings/:id/external-action/reject", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
      }
      
      if (booking.status !== "approved") {
        return res.status(400).json({ error: "Η κράτηση δεν είναι εγκεκριμένη" });
      }
      
      if (booking.externalActionStatus !== "user_completed") {
        return res.status(400).json({ error: "Η ενέργεια δεν είναι σε κατάσταση προς επαλήθευση" });
      }
      
      const updated = await storage.rejectExternalAction(id);
      
      await storage.addBookingHistory({
        bookingId: id,
        eventType: "voucher_rejected",
        description: `Η ανάρτηση voucher απορρίφθηκε${reason ? `: ${reason}` : ""}`,
        performedBy: adminId,
        metadata: reason ? JSON.stringify({ reason }) : undefined,
      });
      
      // Format date as DD/MM/YYYY
      const examDate = new Date(booking.bookingDate);
      const formattedDate = `${String(examDate.getDate()).padStart(2, '0')}/${String(examDate.getMonth() + 1).padStart(2, '0')}/${examDate.getFullYear()}`;
      
      // Notify user
      await storage.createNotification({
        userId: booking.userId,
        type: 'action_rejected',
        title: 'Απόρριψη ανάρτησης Voucher',
        message: `Η ανάρτηση κωδικών επιταγής για το τμήμα ${booking.departmentId} (${formattedDate}) απορρίφθηκε. ${reason ? `Λόγος: ${reason}` : 'Παρακαλώ αναρτήστε ξανά τους κωδικούς.'}`,
        bookingId: id,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error rejecting action:", error);
      res.status(500).json({ error: "Σφάλμα κατά την απόρριψη" });
    }
  });
  
  // Admin directly marks action as verified (without user input)
  app.post("/api/bookings/:id/external-action/admin-complete", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const { id } = req.params;
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
      }
      
      if (booking.status !== "approved") {
        return res.status(400).json({ error: "Η κράτηση δεν είναι εγκεκριμένη" });
      }
      
      if (booking.externalActionStatus === "verified") {
        return res.status(400).json({ error: "Η ενέργεια είναι ήδη επαληθευμένη" });
      }
      
      const updated = await storage.verifyExternalAction(id);
      
      await storage.addBookingHistory({
        bookingId: id,
        eventType: "voucher_admin_completed",
        description: "Η ανάρτηση voucher ολοκληρώθηκε άμεσα από διαχειριστή",
        performedBy: adminId,
      });
      
      // Format date as DD/MM/YYYY
      const examDate = new Date(booking.bookingDate);
      const formattedDate = `${String(examDate.getDate()).padStart(2, '0')}/${String(examDate.getMonth() + 1).padStart(2, '0')}/${examDate.getFullYear()}`;
      
      // Notify user
      await storage.createNotification({
        userId: booking.userId,
        type: 'action_verified',
        title: 'Ολοκλήρωση ανάρτησης Voucher',
        message: `Η ανάρτηση των κωδικών επιταγής για το τμήμα ${booking.departmentId} (${formattedDate}) ολοκληρώθηκε. Η εξέταση θα διεξαχθεί κανονικά.`,
        bookingId: id,
      });
      
      res.json(updated);
    } catch (error) {
      console.error("Error admin completing action:", error);
      res.status(500).json({ error: "Σφάλμα κατά την ολοκλήρωση" });
    }
  });
  
  // Admin sends reminder to user about pending external action
  app.post("/api/bookings/:id/external-action/send-reminder", async (req, res) => {
    const adminId = await requireAdmin(req, res);
    if (!adminId) return;
    
    try {
      const { id } = req.params;
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
      }
      
      if (booking.status !== "approved") {
        return res.status(400).json({ error: "Η κράτηση δεν είναι εγκεκριμένη" });
      }
      
      if (booking.externalActionStatus === "verified") {
        return res.status(400).json({ error: "Η ενέργεια είναι ήδη ολοκληρωμένη" });
      }
      
      if (booking.externalActionStatus === "user_completed") {
        return res.status(400).json({ error: "Ο χρήστης έχει ήδη δηλώσει ολοκλήρωση" });
      }
      
      const examDate = new Date(booking.bookingDate);
      const formattedDate = `${String(examDate.getDate()).padStart(2, '0')}/${String(examDate.getMonth() + 1).padStart(2, '0')}/${examDate.getFullYear()}`;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      examDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      await storage.createNotification({
        userId: booking.userId,
        type: 'action_reminder',
        title: 'Υπενθύμιση: Εκκρεμεί ανάρτηση Voucher',
        message: `Υπενθυμίζουμε ότι για το τμήμα ${booking.departmentId} (εξέταση ${formattedDate}, σε ${daysUntil} ημέρες) εκκρεμεί η ανάρτηση των κωδικών επιταγής. Παρακαλούμε ολοκληρώστε την ενέργεια το συντομότερο.`,
        bookingId: id,
      });
      
      await storage.addBookingHistory({
        bookingId: id,
        eventType: "voucher_reminder_sent",
        description: "Στάλθηκε υπενθύμιση για ανάρτηση voucher",
        performedBy: adminId,
      });
      
      res.json({ success: true, message: "Η υπενθύμιση στάλθηκε επιτυχώς" });
    } catch (error) {
      console.error("Error sending reminder:", error);
      res.status(500).json({ error: "Σφάλμα κατά την αποστολή υπενθύμισης" });
    }
  });
  
  // Get booking history
  app.get("/api/bookings/:id/history", async (req, res) => {
    const userId = await requireAuth(req, res);
    if (!userId) return;
    
    try {
      const { id } = req.params;
      const booking = await storage.getBooking(id);
      
      if (!booking) {
        return res.status(404).json({ error: "Η κράτηση δεν βρέθηκε" });
      }
      
      // Users can only see their own booking history, admins can see all
      const user = await storage.getUser(userId);
      if (booking.userId !== userId && !user?.isAdmin) {
        return res.status(403).json({ error: "Δεν έχετε πρόσβαση σε αυτό το ιστορικό" });
      }
      
      const history = await storage.getBookingHistory(id);
      
      // Enrich with performer names
      const enrichedHistory = await Promise.all(history.map(async (entry) => {
        let performerName = null;
        if (entry.performedBy) {
          const performer = await storage.getUser(entry.performedBy);
          performerName = performer?.email?.split('@')[0] || 'Χρήστης';
        }
        return { ...entry, performerName };
      }));
      
      res.json(enrichedHistory);
    } catch (error) {
      console.error("Error fetching booking history:", error);
      res.status(500).json({ error: "Σφάλμα κατά την ανάκτηση ιστορικού" });
    }
  });
  
  // Search bookings by confirmation number, department ID, or center ID (admin only)
  // Using POST to avoid proxy caching issues
  app.post("/api/admin/bookings/search", async (req, res) => {
    const userId = await requireAdmin(req, res);
    if (!userId) return;
    
    try {
      const { query, type } = req.body;
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: "Απαιτείται κριτήριο αναζήτησης" });
      }
      
      const trimmed = query.trim();
      
      if (!trimmed) {
        return res.status(400).json({ error: "Απαιτείται κριτήριο αναζήτησης" });
      }
      
      const searchType = typeof type === 'string' ? type : 'auto';
      let bookingsResults: any[] = [];
      
      // Helper to enrich bookings with user info
      async function enrichBookings(bookingsList: any[]) {
        return Promise.all(bookingsList.map(async (booking) => {
          const user = await storage.getUser(booking.userId);
          return {
            ...booking,
            userEmail: user?.email,
            userUgrId: user?.ugrId,
          };
        }));
      }
      
      if (searchType === 'centerId') {
        // Search by center ID - returns multiple bookings
        const centerBookings = await storage.getBookingsByCenterId(trimmed);
        bookingsResults = await enrichBookings(centerBookings);
      } else if (searchType === 'departmentId') {
        // Search by department ID - returns single or multiple bookings
        const deptBookings = await storage.getBookingsByDepartmentId(trimmed);
        bookingsResults = await enrichBookings(deptBookings);
      } else if (searchType === 'confirmationNumber') {
        // Search by confirmation number - returns single booking
        let booking = await storage.getBookingByConfirmationNumber(trimmed);
        
        // If not found and input is numeric, try zero-padded format
        if (!booking) {
          const numericOnly = trimmed.replace(/\D/g, '');
          if (numericOnly && numericOnly.length <= 6) {
            const normalizedNumber = numericOnly.padStart(6, '0');
            booking = await storage.getBookingByConfirmationNumber(normalizedNumber);
          }
        }
        
        if (booking) {
          bookingsResults = await enrichBookings([booking]);
        }
      } else {
        // Auto-detect: try confirmation number first, then department, then center
        let booking = await storage.getBookingByConfirmationNumber(trimmed);
        
        if (!booking) {
          const numericOnly = trimmed.replace(/\D/g, '');
          if (numericOnly && numericOnly.length <= 6) {
            const normalizedNumber = numericOnly.padStart(6, '0');
            booking = await storage.getBookingByConfirmationNumber(normalizedNumber);
          }
        }
        
        if (booking) {
          bookingsResults = await enrichBookings([booking]);
        } else {
          // Try department ID
          const deptBookings = await storage.getBookingsByDepartmentId(trimmed);
          if (deptBookings.length > 0) {
            bookingsResults = await enrichBookings(deptBookings);
          } else {
            // Try center ID
            const centerBookings = await storage.getBookingsByCenterId(trimmed);
            bookingsResults = await enrichBookings(centerBookings);
          }
        }
      }
      
      if (bookingsResults.length === 0) {
        return res.status(404).json({ error: "Δεν βρέθηκαν κρατήσεις" });
      }
      
      // Return array for multiple results, single object for backwards compatibility
      if (bookingsResults.length === 1 && searchType !== 'centerId') {
        res.json(bookingsResults[0]);
      } else {
        res.json({ bookings: bookingsResults, count: bookingsResults.length });
      }
    } catch (error) {
      console.error("Error searching booking:", error);
      res.status(500).json({ error: "Σφάλμα κατά την αναζήτηση" });
    }
  });
  
  // Manual trigger for scheduler (for testing)
  app.post("/api/admin/trigger-scheduler", async (req, res) => {
    const userId = await requireAdmin(req, res);
    if (!userId) return;
    
    try {
      const { runManualCheck } = await import('./scheduler');
      await runManualCheck();
      res.json({ success: true, message: "Scheduler executed successfully" });
    } catch (error) {
      console.error("Error triggering scheduler:", error);
      res.status(500).json({ error: "Σφάλμα κατά την εκτέλεση του scheduler" });
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
  
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');
    
    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
    });
    
    ws.on('error', (error) => {
      console.error('[WebSocket] Error:', error);
    });
  });
  
  console.log('[WebSocket] Server initialized on /ws path');
  
  return httpServer;
}
