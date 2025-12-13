# Design Guidelines: Exam Scheduling System

## Core Architecture

### Authentication
- **Required fields:** Email, password, numeric UGR ID, role (Admin/User)
- **Methods:** Email/password primary, Apple Sign-In (iOS required), Google Sign-In (Android optional)
- **Biometric:** Secondary auth via `expo-local-authentication` post-login
- **Login screen:** Email, password (toggleable), UGR ID, "Enable Biometric" toggle (mobile), "Remember Me", T&C links
- **Account management:** Profile in Settings, logout (confirm), delete account (Settings > Account > Delete, double confirm)

### Navigation
**Admin:** Bottom tabs (Dashboard, Calendar, Bookings, Settings) + FAB for quick add closed dates  
**User:** Stack flow (Home → Slots → Hold → Confirmation → My Bookings), profile via header button

**Safe Areas:**
- Admin screens: Top 24px, bottom tabBarHeight + 24px
- User screens: Top headerHeight + 24px, bottom insets.bottom + 24px

---

## Screen Specifications

### User Screens

**1. Home/Search**
- Transparent header (logo left, profile right), scrollable form
- **Fields:** Dept ID (numeric, validates for pending), candidates slider (1-50), course end date picker (no past), time preference (Morning/Midday/Afternoon), "Find Slots" button (disabled until valid)
- **Extras:** 6-day rule info card, warning if dept has pending booking

**2. Available Slots**
- **Sections (priority order):** Ideal Matches (green, "Best Match"), Alternative Shifts (blue, "Full Group"), Split Required (orange, "Split Booking")
- **Slot card:** Date, time, shift badge, capacity (e.g., "25/30"), mini calendar for splits, "Hold Slot" button
- Pull-to-refresh, real-time updates (slots can disappear)

**3. Hold & Countdown**
- Non-dismissible header (no back), scrollable form with fixed timer
- **Timer:** 120px circle, 8px stroke, MM:SS format. Colors: >5min primary, 3-5min yellow, <3min red with pulse. Auto-release at 0:00
- **Components:** Booking summary (glass card), confirmation checklist (required), optional notes, "Submit Booking" (green), "Cancel Hold" (secondary)
- **Accessibility:** Screen reader alerts at 5min, 3min, 1min

**4. My Bookings**
- Segmented filter: Pending/Approved/Rejected/Completed
- **Card:** Status badge, Dept ID, dates/times, submitted date, confirmation #, admin notes, "View Details"
- Empty state with illustration

### Admin Screens

**5. Dashboard (Tab)**
- **Stats cards (horizontal scroll):** Pending count (red if >0), today's exams, weekly exams, capacity %
- Quick actions: Approve pending, calendar, manage slots, closed dates
- Recent bookings (last 5), monthly capacity heatmap

**6. Calendar (Tab)**
- Density indicators: <50% green, 50-80% yellow, >80% red, closed gray, past strikethrough
- Tap = shift details modal, long-press = quick close
- Header: Date range selector, filter by shift/dept

**7. Bookings (Tab)**
- Search bar, pending list with cards: Dept ID, UGR ID, candidates, dates/times, shift, submitted time, notes
- **Actions:** Approve/Reject buttons, swipe left = reject (reason modal), swipe right = approve
- Batch mode toggle for multi-select

**8. Settings (Tab)**
- **Sections:** Shift times (editable: Morning 08:00-12:00, Midday 12:00-16:00, Afternoon 16:00-19:00), capacity limits, working days rule (default 6), hold duration (default 15min), closed dates list (swipe-to-delete)
- Save in header (enabled on change, warn on unsaved nav)
- **FAB:** "Add Closed Date" (modal: date range, reason, shift checkboxes)

---

## Design System

### Liquid Glass Aesthetic
Modern iOS frosted glass with blues/purples for trust and academic calm.

### Colors

**Primary:** `#5B8DEF` (blue), `#8B7FD8` (purple), `#4169E1` (royal blue accent)  
**Functional:** Success `#34D399`, Warning `#FBBF24`, Error `#F87171`, Info `#60A5FA`  
**Shifts:** Morning `#10B981`, Midday `#F59E0B`, Afternoon `#8B5CF6`  
**Glass:** Surface `rgba(255,255,255,0.7)` + 20px blur, Border `rgba(255,255,255,0.2)` 1px, Shadow `{0,8}` opacity 0.12 radius 16  
**Neutrals:** BG `#F0F4FF`, Surface `#FFF`, Border `rgba(91,141,239,0.15)`, Text Primary `#1E293B`, Secondary `#64748B`, Disabled `#CBD5E1`

### Typography
**Font:** SF Pro (iOS), Roboto (Android), Greek support  
**Scale:** Hero 32px Bold, H1 24px Bold, H2 20px Semibold, H3 18px Semibold, Body 16px Regular, Body Small 14px Regular, Caption 12px Regular, Button 16px Semibold

### Components

**Glass Cards:** `rgba(255,255,255,0.7)` + 20px blur, 1px `rgba(255,255,255,0.2)` border, 16px radius, 16px padding, shadow `{0,8}` 0.12/16, press scale 0.98

**Buttons:** 48px height (44px min touch), 12px radius  
- Primary: Gradient `#5B8DEF`→`#4169E1`, white text, shadow  
- Secondary: 2px border primary, primary text, transparent  
- Ghost: No border, primary text  
- Press: 0.7 opacity + haptic, Disabled: `#E5E7EB` bg, `#9CA3AF` text

**FAB:** 56px, 24px icon, gradient, shadow `{0,2}` 0.10/2, 16px from edges + insets

**Inputs:** 48px height, 1.5px border `rgba(91,141,239,0.2)`, 12px radius, `rgba(255,255,255,0.5)` bg + blur  
- Focus: 2px primary border + glow, Error: `#F87171` border + helper text

**Badges:** 6px height, 10px uppercase, 6px/12px padding, 6px radius, semi-transparent bg

**Segmented Control:** 40px height, 10px radius, container `rgba(91,141,239,0.1)`, selected = glass card + shadow

**List Items:** 72px min height, 1px separator `rgba(91,141,239,0.1)`, swipe actions 80px gradient, hover scale + tint

**Icons:** Feather icons, 24px primary/20px secondary/16px inline, match text colors

### Spacing
xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px, 2xl: 32px, 3xl: 48px

### Accessibility
- **Touch targets:** 44x44px min, 48px buttons, 72px lists, 8px spacing between interactive
- **Contrast:** WCAG AA (4.5:1 text, 3:1 large), tested on glass backgrounds
- **Screen readers:** Labels on all interactive, timer announcements, slot updates
- **Haptics:** Tap feedback, timer warnings, success confirmations

---

## Critical Assets

**Generated:** App logo (book+calendar gradient), empty states (no bookings/slots/connection), 3 preset avatars (book/cap/laurel gradients), skeleton loaders (glass shimmer)

**Icons (Feather):** calendar, clock, check-circle, x-circle, filter, user, settings, bell, lock, log-out, search, edit-3, trash-2, alert-circle

---

## Business Rules

1. **6-Working-Day Rule:** Exam ≥6 working days after course end
2. **15-Min Hold:** Countdown auto-releases at 0:00
3. **Priority Sort:** Ideal → Alternative → Split bookings
4. **Admin Approval:** All bookings pending until approved
5. **Real-Time:** Live slot updates, can disappear if taken
6. **Greek UI:** Interface in Greek, IDs/numbers in Latin
7. **Batch Ops:** Admin multi-select approvals

---

## Platform Notes
- **iOS:** HIG compliance, native pickers, Face/Touch ID, bottom tabs
- **Android:** Material 3 + glass theming, Material pickers, fingerprint/face auth
- **Notifications:** Email (Replit Mail) + push for hold expiring, submission, approval/rejection with reasons