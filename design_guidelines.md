# Design Guidelines: Exam Scheduling System

## Core Architecture

### Authentication
- **Required fields:** Email, password, UGR ID (unique university identifier)
- **Biometric (mobile):** Secondary auth via `expo-local-authentication` after initial login
- **Role-based access:** Admin vs. User (email domain or explicit assignment)
- **Login UI:** Email, password (with toggle), UGR ID (numeric), "Enable Biometric" toggle (mobile), "Remember Me", T&C links

### Navigation

**Admin:** Tab navigation (4 tabs + FAB)
- Dashboard → Calendar → Bookings → Settings
- FAB: Quick close date/add holiday

**User:** Stack navigation
- Home → Available Slots → Hold/Countdown → Confirmation → My Bookings
- Profile via header button

---

## Screen Specifications

### User Screens

**1. Home/Search**
- **Layout:** Scrollable form, transparent header (logo left, profile right)
- **Safe areas:** Top = headerHeight + 24px, bottom = insets + 24px
- **Components:**
  - Department ID (numeric, validates existing bookings on blur)
  - Candidates slider (1-50, live display)
  - Course end date picker (no past dates)
  - Time preference (Morning/Midday/Afternoon segmented control)
  - Primary button "Find Available Slots" (disabled until valid)
  - Info card: 6-working-day rule
  - Warning banner if department has pending booking

**2. Available Slots**
- **Sections (priority order):**
  1. Ideal Matches (green, "Best Match" badge)
  2. Alternative Shifts (blue, "Full Group" badge)
  3. Split Required (orange, "Split Booking" badge)
- **Slot card:** Date, time range, shift badge, capacity (e.g., "25/30"), mini calendar for splits, "Hold Slot" button
- **Features:** Pull-to-refresh, real-time updates, tap to expand details

**3. Hold & Countdown**
- **Timer:** Circular progress (120px diameter, 8px stroke), MM:SS format
  - Colors: >5min primary, 3-5min yellow, <3min red (with pulse)
  - Auto-release at 0:00 with modal
- **Components:** Booking summary, confirmation checklist (required), notes field, "Submit Booking" (green) + "Cancel Hold" (gray)
- **Non-dismissible:** Must cancel to exit

**4. My Bookings**
- **Segmented list:** Pending (yellow) / Approved (green) / Rejected (red) / Completed (gray)
- **Card contents:** Status badge, Dept ID, dates/times, submitted date, confirmation #, admin notes, "View Details"

### Admin Screens

**5. Dashboard**
- **Stats cards (horizontal scroll):** Pending (red badge if >0), today's exams, week's exams, capacity %
- **Quick actions:** Approve, calendar, slots, closed dates
- **Recent bookings:** Last 5 with "View All"
- **Heatmap:** Monthly capacity density

**6. Pending Approvals**
- **Card:** Dept ID, UGR ID, candidates, dates/times, shift, course end, submitted time, user notes, Approve/Reject buttons
- **Swipe actions:** Left = reject (reason required), right = approve
- **Batch mode:** Multi-select approvals

**7. Calendar View**
- **Color coding:** Green (<50%), yellow (50-80%), red (>80%), gray (closed), strikethrough (past)
- **Interactions:** Tap = shift modal, long-press = quick close
- **Header:** Date range selector, filter button

**8. Slot Management**
- **Sections:**
  - Shift times (editable): Morning 08:00-12:00, Midday 12:00-16:00, Afternoon 16:00-19:00
  - Capacity: Max per shift, max concurrent/day
  - Working days rule (default: 6)
  - Hold duration (default: 15min)
- **Save in header:** Enabled on changes, unsaved warning on back

**9. Closed Dates**
- **Card:** Date range, reason, delete (swipe)
- **Add modal:** Date range picker, reason field, shift checkboxes, save/cancel
- **FAB:** "Add Holiday"

---

## Design System

### Colors

**Primary Palette:**
- Primary: `#1E40AF` (actions, admin)
- Secondary: `#059669` (success, approvals)
- Accent: `#DC2626` (alerts, rejections, timer)

**Shifts:**
- Morning: `#10B981`, Midday: `#F59E0B`, Afternoon: `#8B5CF6`

**Status:**
- Pending: `#FBBF24`, Approved: `#10B981`, Rejected: `#EF4444`, Completed: `#6B7280`, Available: `#3B82F6`

**Neutrals:**
- Background: `#F9FAFB`, Surface: `#FFFFFF`, Border: `#E5E7EB`, Text Primary: `#111827`, Text Secondary: `#6B7280`, Disabled: `#D1D5DB`

### Typography
- **Font:** System (SF Pro/Roboto), Greek support required
- **Scale:** Hero 32px Bold | H1 24px Bold | H2 20px Semibold | H3 18px Semibold | Body 16px | Body Small 14px | Caption 12px | Button 16px Semibold

### Components

**Cards:**
- Border radius: 12px, padding: 16px
- Shadow: `{width: 0, height: 1}`, opacity 0.08, radius 3, elevation 2

**Buttons:**
- Height: 48px (44px min touch target)
- Primary: Filled primary, white text, 12px radius
- Secondary: 2px outline, primary text
- Press: 0.7 opacity | Disabled: `#E5E7EB` bg, `#9CA3AF` text

**FAB:**
- Size: 56px, icon 24px, shadow: `{width: 0, height: 2}` opacity 0.10 radius 2
- Position: 16px from edges + safe area

**Inputs:**
- Height: 48px, border 1px `#E5E7EB`, focus 2px primary, radius 8px
- Error: Red border + helper text

**Badges:**
- Small: 6px height, 10px uppercase | Large: 8px height, 12px text
- Padding: 4px 8px, radius 4px

**List Items:**
- Min height: 72px, separator 1px, swipe actions 80px width
- Hover (web): `#F3F4F6` bg

**Icons:**
- Feather icons (@expo/vector-icons): 24px primary, 20px secondary, 16px inline
- No emojis

### Spacing
xs: 4px | sm: 8px | md: 12px | lg: 16px | xl: 24px | 2xl: 32px | 3xl: 48px

### Accessibility

- **Touch targets:** 44x44px min, buttons 48px, list items 72px, 8px spacing between
- **Contrast:** WCAG AA (4.5:1 text, 3:1 large text)
- **Screen readers:** Labels on all interactive elements, timer announcements, slot release alerts
- **Biometric:** Password fallback, setup instructions, error messaging

### Notifications

**Email (Replit Mail):**
- Hold expiring (3min), submission success, approval, rejection (with reason)

**Push (Mobile):**
- Same events, actionable (tap to screen), badge counts

### Critical Assets

**Generated:**
1. Logo: Book + calendar icon
2. Empty states: No bookings, no slots, connection error
3. Skeleton loaders

**Feather Icons:**
calendar, clock, check-circle, x-circle, filter, user, settings, bell, lock, log-out

### Platform Notes

**iOS:** Apple HIG, native pickers, Face/Touch ID, bottom tabs
**Android:** Material Design 3, Material pickers, fingerprint/face, bottom tabs
**Web:** Responsive (640/768/1024px), hover states, keyboard shortcuts (Cmd+A approve, Cmd+R reject)

---

## Key Rules

1. **6-Working-Day Rule:** Exam must be ≥6 working days after course end
2. **15-Min Hold:** Slots reserved 15min, auto-release at 0:00
3. **Priority Sorting:** Ideal → Alternative shifts → Split bookings
4. **Admin Approval:** All bookings require admin confirmation
5. **Real-Time Updates:** Slots refresh live (can disappear if taken)
6. **Safe Areas:** Always account for insets (top header, bottom tabs/nav)
7. **Greek UI:** All text Greek, numbers/IDs Latin
8. **Color Blindness:** Status colors tested for accessibility
9. **Batch Operations:** Admin can approve multiple bookings
10. **Unsaved Changes:** Warn before navigation with pending edits