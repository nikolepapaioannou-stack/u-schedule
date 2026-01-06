import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userRoles = ["user", "admin", "superadmin"] as const;
export type UserRole = typeof userRoles[number];

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  ugrId: text("ugr_id").notNull().unique(),
  role: text("role").notNull().default("user"),
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
  candidatesPerProctor: integer("candidates_per_proctor").notNull().default(25),
  reservePercentage: integer("reserve_percentage").notNull().default(15),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const proctorRosters = pgTable("proctor_rosters", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  shiftId: varchar("shift_id").notNull().references(() => shifts.id),
  totalProctors: integer("total_proctors").notNull(),
  reserveProctors: integer("reserve_proctors").notNull().default(0),
  effectiveCapacity: integer("effective_capacity").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const proctorHourlyCapacities = pgTable("proctor_hourly_capacities", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  date: date("date").notNull(),
  hour: integer("hour").notNull(),
  totalProctors: integer("total_proctors").notNull(),
  reserveProctors: integer("reserve_proctors").notNull().default(0),
  effectiveCapacity: integer("effective_capacity").notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const externalActionStatuses = ["pending", "user_completed", "verified", "rejected"] as const;
export type ExternalActionStatus = typeof externalActionStatuses[number];

export const bookings = pgTable("bookings", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  departmentId: text("department_id").notNull(),
  centerId: text("center_id"),
  userId: varchar("user_id").notNull().references(() => users.id),
  candidateCount: integer("candidate_count").notNull(),
  courseEndDate: date("course_end_date").notNull(),
  preferredShift: text("preferred_shift").notNull(),
  shiftId: varchar("shift_id").references(() => shifts.id),
  examStartHour: integer("exam_start_hour"),
  bookingDate: date("booking_date").notNull(),
  status: text("status").notNull().default("pending"),
  holdExpiresAt: timestamp("hold_expires_at"),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  confirmationNumber: text("confirmation_number"),
  isSplit: boolean("is_split").notNull().default(false),
  splitGroupId: varchar("split_group_id"),
  capacityOverrideBy: varchar("capacity_override_by").references(() => users.id),
  capacityOverrideAt: timestamp("capacity_override_at"),
  capacityOverrideDetails: text("capacity_override_details"),
  // External action tracking fields
  externalActionStatus: text("external_action_status").default("pending"),
  externalActionCompletedAt: timestamp("external_action_completed_at"),
  externalActionVerifiedAt: timestamp("external_action_verified_at"),
  externalActionWarningSentAt: timestamp("external_action_warning_sent_at"),
  externalActionDeadlineWarningSentAt: timestamp("external_action_deadline_warning_sent_at"),
  externalActionCancelledAt: timestamp("external_action_cancelled_at"),
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

export const pushTokens = pgTable("push_tokens", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  platform: text("platform"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const bookingHistoryEventTypes = [
  "created",
  "submitted",
  "approved",
  "rejected",
  "cancelled",
  "hold_expired",
  "voucher_warning_sent",
  "voucher_deadline_warning_sent",
  "voucher_user_completed",
  "voucher_verified",
  "voucher_rejected",
  "voucher_auto_cancelled",
  "voucher_admin_completed",
  "voucher_reminder_sent",
  "admin_note_added",
  "status_changed",
] as const;
export type BookingHistoryEventType = typeof bookingHistoryEventTypes[number];

export const bookingHistory = pgTable("booking_history", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  bookingId: varchar("booking_id").notNull().references(() => bookings.id),
  eventType: text("event_type").notNull(),
  description: text("description").notNull(),
  performedBy: varchar("performed_by").references(() => users.id),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  ugrId: true,
});

export const adminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  ugrId: z.string().min(1),
  role: z.enum(userRoles).default("user"),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(userRoles),
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
  centerId: true,
  candidateCount: true,
  courseEndDate: true,
  preferredShift: true,
  bookingDate: true,
  shiftId: true,
  examStartHour: true,
  notes: true,
  isSplit: true,
  splitGroupId: true,
});

export const searchSlotsSchema = z.object({
  departmentId: z.string().min(1),
  centerId: z.string().optional(),
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
export type PushToken = typeof pushTokens.$inferSelect;
export type ProctorRoster = typeof proctorRosters.$inferSelect;
export type ProctorHourlyCapacity = typeof proctorHourlyCapacities.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type BookingHistory = typeof bookingHistory.$inferSelect;
