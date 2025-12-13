import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  ugrId: text("ugr_id").notNull().unique(),
  isAdmin: boolean("is_admin").notNull().default(false),
  biometricEnabled: boolean("biometric_enabled").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const shifts = pgTable("shifts", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  maxCandidates: integer("max_candidates").notNull().default(30),
  isActive: boolean("is_active").notNull().default(true),
});

export const closedDates = pgTable("closed_dates", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  reason: text("reason"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  workingDaysRule: integer("working_days_rule").notNull().default(6),
  holdDurationMinutes: integer("hold_duration_minutes").notNull().default(15),
  maxCandidatesPerDay: integer("max_candidates_per_day").notNull().default(100),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  departmentId: text("department_id").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  candidateCount: integer("candidate_count").notNull(),
  courseEndDate: date("course_end_date").notNull(),
  preferredShift: text("preferred_shift").notNull(),
  shiftId: varchar("shift_id").references(() => shifts.id),
  bookingDate: date("booking_date").notNull(),
  status: text("status").notNull().default("pending"),
  holdExpiresAt: timestamp("hold_expires_at"),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  confirmationNumber: text("confirmation_number"),
  isSplit: boolean("is_split").notNull().default(false),
  splitGroupId: varchar("split_group_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  bookingId: varchar("booking_id").references(() => bookings.id),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const waitlist = pgTable("waitlist", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  departmentId: text("department_id").notNull(),
  candidateCount: integer("candidate_count").notNull(),
  preferredDate: date("preferred_date").notNull(),
  preferredShift: text("preferred_shift").notNull(),
  status: text("status").notNull().default("waiting"),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  ugrId: true,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const insertShiftSchema = createInsertSchema(shifts).pick({
  name: true,
  startTime: true,
  endTime: true,
  maxCandidates: true,
});

export const insertClosedDateSchema = createInsertSchema(closedDates).pick({
  date: true,
  reason: true,
});

export const insertBookingSchema = createInsertSchema(bookings).pick({
  departmentId: true,
  candidateCount: true,
  courseEndDate: true,
  preferredShift: true,
  bookingDate: true,
  shiftId: true,
  notes: true,
  isSplit: true,
  splitGroupId: true,
});

export const searchSlotsSchema = z.object({
  departmentId: z.string().min(1),
  candidateCount: z.number().min(1).max(50),
  courseEndDate: z.string(),
  preferredShift: z.enum(["morning", "midday", "afternoon"]),
});

export const insertNotificationSchema = createInsertSchema(notifications).pick({
  userId: true,
  type: true,
  title: true,
  message: true,
  bookingId: true,
});

export const insertWaitlistSchema = createInsertSchema(waitlist).pick({
  departmentId: true,
  candidateCount: true,
  preferredDate: true,
  preferredShift: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Shift = typeof shifts.$inferSelect;
export type ClosedDate = typeof closedDates.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type SearchSlotsInput = z.infer<typeof searchSlotsSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Waitlist = typeof waitlist.$inferSelect;
export type InsertWaitlist = z.infer<typeof insertWaitlistSchema>;
