import { eq, and, gte, lte, not, or, isNull, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import {
  type User,
  type InsertUser,
  type Shift,
  type ClosedDate,
  type Settings,
  type Booking,
  type InsertBooking,
  type Notification,
  type InsertNotification,
  type Waitlist,
  type InsertWaitlist,
  type PushToken,
  type ProctorRoster,
  users,
  shifts,
  closedDates,
  settings,
  bookings,
  notifications,
  waitlist,
  pushTokens,
  proctorRosters,
} from "@shared/schema";
import { randomUUID } from "crypto";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUgrId(ugrId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBiometric(userId: string, enabled: boolean): Promise<void>;
  
  getShifts(): Promise<Shift[]>;
  getShift(id: string): Promise<Shift | undefined>;
  createShift(shift: Omit<Shift, "id" | "isActive">): Promise<Shift>;
  updateShift(id: string, shift: Partial<Shift>): Promise<Shift | undefined>;
  
  getClosedDates(): Promise<ClosedDate[]>;
  getClosedDatesInRange(startDate: string, endDate: string): Promise<ClosedDate[]>;
  createClosedDate(closedDate: { date: string; reason?: string; createdBy?: string }): Promise<ClosedDate>;
  deleteClosedDate(id: string): Promise<void>;
  
  getSettings(): Promise<Settings>;
  updateSettings(settingsData: Partial<Settings>): Promise<Settings>;
  
  getBookings(): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | undefined>;
  getBookingsByUserId(userId: string): Promise<Booking[]>;
  getBookingByDepartmentId(departmentId: string): Promise<Booking | undefined>;
  getBookingsByDate(date: string): Promise<Booking[]>;
  getBookingsByDateAndShift(date: string, shiftId: string): Promise<Booking[]>;
  getPendingBookings(): Promise<Booking[]>;
  createBooking(booking: InsertBooking & { userId: string }): Promise<Booking>;
  updateBooking(id: string, booking: Partial<Booking>): Promise<Booking | undefined>;
  deleteBooking(id: string): Promise<void>;
  releaseExpiredHolds(): Promise<number>;
  
  getNotificationsByUserId(userId: string): Promise<Notification[]>;
  getUnreadNotificationCount(userId: string): Promise<number>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string, userId: string): Promise<void>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  
  getWaitlistByUserId(userId: string): Promise<Waitlist[]>;
  getWaitlistForSlot(date: string, shift: string): Promise<Waitlist[]>;
  createWaitlistEntry(entry: InsertWaitlist & { userId: string }): Promise<Waitlist>;
  updateWaitlistEntry(id: string, userId: string, data: Partial<Waitlist>): Promise<Waitlist | undefined>;
  deleteWaitlistEntry(id: string, userId: string): Promise<void>;
  
  getPushTokensByUserId(userId: string): Promise<PushToken[]>;
  getAllPushTokens(): Promise<PushToken[]>;
  savePushToken(userId: string, token: string, platform?: string): Promise<PushToken>;
  deletePushToken(userId: string): Promise<void>;
  
  getProctorRosters(): Promise<ProctorRoster[]>;
  getProctorRosterByDateAndShift(date: string, shiftId: string): Promise<ProctorRoster | undefined>;
  getProctorRostersInRange(startDate: string, endDate: string): Promise<ProctorRoster[]>;
  createProctorRoster(roster: Omit<ProctorRoster, "id" | "createdAt">): Promise<ProctorRoster>;
  deleteProctorRostersByDateRange(startDate: string, endDate: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return result[0];
  }

  async getUserByUgrId(ugrId: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.ugrId, ugrId));
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await db.insert(users).values({
      ...insertUser,
      email: insertUser.email.toLowerCase(),
    }).returning();
    return result[0];
  }

  async updateUserBiometric(userId: string, enabled: boolean): Promise<void> {
    await db.update(users).set({ biometricEnabled: enabled }).where(eq(users.id, userId));
  }

  async getShifts(): Promise<Shift[]> {
    return db.select().from(shifts).where(eq(shifts.isActive, true));
  }

  async getShift(id: string): Promise<Shift | undefined> {
    const result = await db.select().from(shifts).where(eq(shifts.id, id));
    return result[0];
  }

  async createShift(shift: Omit<Shift, "id" | "isActive">): Promise<Shift> {
    const result = await db.insert(shifts).values(shift).returning();
    return result[0];
  }

  async updateShift(id: string, shift: Partial<Shift>): Promise<Shift | undefined> {
    const result = await db.update(shifts).set(shift).where(eq(shifts.id, id)).returning();
    return result[0];
  }

  async getClosedDates(): Promise<ClosedDate[]> {
    return db.select().from(closedDates);
  }

  async getClosedDatesInRange(startDate: string, endDate: string): Promise<ClosedDate[]> {
    return db.select().from(closedDates).where(
      and(
        gte(closedDates.date, startDate),
        lte(closedDates.date, endDate)
      )
    );
  }

  async createClosedDate(closedDate: { date: string; reason?: string; createdBy?: string }): Promise<ClosedDate> {
    const result = await db.insert(closedDates).values(closedDate).returning();
    return result[0];
  }

  async deleteClosedDate(id: string): Promise<void> {
    await db.delete(closedDates).where(eq(closedDates.id, id));
  }

  async getSettings(): Promise<Settings> {
    const result = await db.select().from(settings);
    if (result.length === 0) {
      const newSettings = await db.insert(settings).values({}).returning();
      return newSettings[0];
    }
    return result[0];
  }

  async updateSettings(settingsData: Partial<Settings>): Promise<Settings> {
    const current = await this.getSettings();
    const result = await db.update(settings)
      .set({ ...settingsData, updatedAt: new Date() })
      .where(eq(settings.id, current.id))
      .returning();
    return result[0];
  }

  async getBookings(): Promise<Booking[]> {
    return db.select().from(bookings);
  }

  async getBooking(id: string): Promise<Booking | undefined> {
    const result = await db.select().from(bookings).where(eq(bookings.id, id));
    return result[0];
  }

  async getBookingsByUserId(userId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.userId, userId));
  }

  async getBookingByDepartmentId(departmentId: string): Promise<Booking | undefined> {
    const result = await db.select().from(bookings).where(
      and(
        eq(bookings.departmentId, departmentId),
        not(eq(bookings.status, "rejected")),
        not(eq(bookings.status, "expired"))
      )
    );
    return result[0];
  }

  async getBookingsByDate(date: string): Promise<Booking[]> {
    return db.select().from(bookings).where(
      and(
        eq(bookings.bookingDate, date),
        not(eq(bookings.status, "rejected")),
        not(eq(bookings.status, "expired"))
      )
    );
  }

  async getBookingsByDateAndShift(date: string, shiftId: string): Promise<Booking[]> {
    return db.select().from(bookings).where(
      and(
        eq(bookings.bookingDate, date),
        eq(bookings.shiftId, shiftId),
        not(eq(bookings.status, "rejected")),
        not(eq(bookings.status, "expired"))
      )
    );
  }

  async getPendingBookings(): Promise<Booking[]> {
    return db.select().from(bookings).where(eq(bookings.status, "pending"));
  }

  async createBooking(booking: InsertBooking & { userId: string }): Promise<Booking> {
    const confirmationNumber = `EX${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;
    const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    
    const result = await db.insert(bookings).values({
      ...booking,
      status: "holding",
      holdExpiresAt,
      confirmationNumber,
    }).returning();
    return result[0];
  }

  async updateBooking(id: string, booking: Partial<Booking>): Promise<Booking | undefined> {
    const result = await db.update(bookings)
      .set({ ...booking, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return result[0];
  }

  async deleteBooking(id: string): Promise<void> {
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  async releaseExpiredHolds(): Promise<number> {
    const now = new Date();
    const result = await db.update(bookings)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(bookings.status, "holding"),
          lte(bookings.holdExpiresAt, now)
        )
      )
      .returning();
    return result.length;
  }

  async getNotificationsByUserId(userId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const result = await db.select().from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return result.length;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(notification).returning();
    return result[0];
  }

  async markNotificationAsRead(id: string, userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(
      and(eq(notifications.id, id), eq(notifications.userId, userId))
    );
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db.update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  }

  async getWaitlistByUserId(userId: string): Promise<Waitlist[]> {
    return db.select().from(waitlist)
      .where(eq(waitlist.userId, userId))
      .orderBy(waitlist.createdAt);
  }

  async getWaitlistForSlot(date: string, shift: string): Promise<Waitlist[]> {
    return db.select().from(waitlist)
      .where(
        and(
          eq(waitlist.preferredDate, date),
          eq(waitlist.preferredShift, shift),
          eq(waitlist.status, "waiting")
        )
      )
      .orderBy(waitlist.createdAt);
  }

  async createWaitlistEntry(entry: InsertWaitlist & { userId: string }): Promise<Waitlist> {
    const result = await db.insert(waitlist).values(entry).returning();
    return result[0];
  }

  async updateWaitlistEntry(id: string, userId: string, data: Partial<Waitlist>): Promise<Waitlist | undefined> {
    const result = await db.update(waitlist).set(data).where(
      and(eq(waitlist.id, id), eq(waitlist.userId, userId))
    ).returning();
    return result[0];
  }

  async deleteWaitlistEntry(id: string, userId: string): Promise<void> {
    await db.delete(waitlist).where(
      and(eq(waitlist.id, id), eq(waitlist.userId, userId))
    );
  }

  async getPushTokensByUserId(userId: string): Promise<PushToken[]> {
    return db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
  }

  async getAllPushTokens(): Promise<PushToken[]> {
    return db.select().from(pushTokens);
  }

  async savePushToken(userId: string, token: string, platform?: string): Promise<PushToken> {
    const existing = await db.select().from(pushTokens).where(eq(pushTokens.token, token));
    
    if (existing.length > 0) {
      const result = await db.update(pushTokens)
        .set({ userId, platform, updatedAt: new Date() })
        .where(eq(pushTokens.token, token))
        .returning();
      return result[0];
    }
    
    const result = await db.insert(pushTokens).values({
      userId,
      token,
      platform,
    }).returning();
    return result[0];
  }

  async deletePushToken(userId: string): Promise<void> {
    await db.delete(pushTokens).where(eq(pushTokens.userId, userId));
  }

  async getProctorRosters(): Promise<ProctorRoster[]> {
    return db.select().from(proctorRosters);
  }

  async getProctorRosterByDateAndShift(date: string, shiftId: string): Promise<ProctorRoster | undefined> {
    const result = await db.select().from(proctorRosters).where(
      and(eq(proctorRosters.date, date), eq(proctorRosters.shiftId, shiftId))
    );
    return result[0];
  }

  async getProctorRostersInRange(startDate: string, endDate: string): Promise<ProctorRoster[]> {
    return db.select().from(proctorRosters).where(
      and(
        gte(proctorRosters.date, startDate),
        lte(proctorRosters.date, endDate)
      )
    );
  }

  async createProctorRoster(roster: Omit<ProctorRoster, "id" | "createdAt">): Promise<ProctorRoster> {
    const result = await db.insert(proctorRosters).values(roster).returning();
    return result[0];
  }

  async deleteProctorRostersByDateRange(startDate: string, endDate: string): Promise<void> {
    await db.delete(proctorRosters).where(
      and(
        gte(proctorRosters.date, startDate),
        lte(proctorRosters.date, endDate)
      )
    );
  }
}

export const storage = new DatabaseStorage();

export async function initializeDefaultData() {
  const existingShifts = await storage.getShifts();
  if (existingShifts.length === 0) {
    await storage.createShift({
      name: "morning",
      startTime: "08:00",
      endTime: "12:00",
      maxCandidates: 30,
    });
    await storage.createShift({
      name: "midday",
      startTime: "12:00",
      endTime: "16:00",
      maxCandidates: 30,
    });
    await storage.createShift({
      name: "afternoon",
      startTime: "16:00",
      endTime: "19:00",
      maxCandidates: 30,
    });
  }
  
  await storage.getSettings();
}
