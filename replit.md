# U-Schedule

## Overview

An exam scheduling system built with Expo (React Native) for cross-platform mobile and web support, with an Express.js backend. Branded as **U-SCHEDULE** (with "U" in navy blue and "SCHEDULE" in silver/gray, similar to U-CERT style). The application allows university departments to book exam slots, with role-based access separating regular users (who search and book slots) from administrators (who approve bookings and manage the calendar).

The system enforces a 6-working-day booking rule, supports slot holding with countdown timers, and provides shift-based scheduling (morning, midday, afternoon).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: Expo SDK 54 with React Native 0.81
- **Navigation**: React Navigation with native stack and bottom tabs
- **State Management**: TanStack React Query for server state, React Context for auth
- **Styling**: React Native StyleSheet with a custom theme system (light/dark mode)
- **Path Aliases**: `@/` maps to `./client`, `@shared/` maps to `./shared`

### Role-Based Navigation
- **Users**: Bottom tab navigator with Search, My Bookings, and Profile screens
- **Admins**: Bottom tab navigator with Dashboard, Pending Approvals, Calendar, and Settings screens
- Both roles share stack screens for slot selection, hold countdown, and booking details

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Authentication**: Session-based with SHA-256 password hashing and bearer tokens
- **API Structure**: RESTful endpoints under `/api/` prefix

### Data Model
Key tables in `shared/schema.ts`:
- `users`: Email, password, UGR ID (university identifier), admin flag, biometric preference
- `shifts`: Time slots with name, start/end times, capacity
- `bookings`: Links users to dates/shifts with status workflow (holding → pending → approved/rejected), includes `examStartHour` for hourly capacity tracking
- `closedDates`: Admin-defined blackout dates
- `settings`: System-wide configuration (working days rule, hold duration, daily capacity, candidatesPerProctor, reservePercentage)
- `proctorRosters`: Per-shift proctor counts and capacity
- `proctorHourlyCapacities`: Per-hour capacity calculated from proctor schedules using 1-hour rule

### Booking Workflow
1. User searches for available slots based on department, candidate count, and preferred shift
2. System calculates availability respecting the 6-working-day rule and closed dates
3. User holds a slot (15-minute countdown timer)
4. User confirms booking before timer expires
5. Admin reviews and approves/rejects pending bookings

### External Action Tracking
The system tracks external actions required for approved bookings (e.g., venue arrangements, proctor assignments):
- **4-day advance warning**: Automated reminder 4 days before exam
- **User completion**: Users mark external action as complete
- **Admin verification**: Admins verify or reject user-marked completions
- **Auto-cancellation**: Bookings are automatically cancelled at 12:00 PM (Europe/Athens) one day before exam if external action is not verified

**Scheduler** (`server/scheduler.ts`):
- Daily reminder job at 08:00 Europe/Athens
- Deadline enforcement job at 12:00 Europe/Athens
- Uses `node-cron` for scheduling

**Status flow**: `pending` → `user_completed` → `verified` (or `rejected` → `pending`)

### Shared Code
The `shared/` directory contains Drizzle schema definitions and Zod validation schemas, used by both frontend and backend for type safety and validation.

## External Dependencies

### Database
- **PostgreSQL**: Primary data store, connected via `DATABASE_URL` environment variable
- **Drizzle ORM**: Schema management and type-safe queries

### Authentication & Security
- **expo-local-authentication**: Biometric authentication on mobile devices
- **AsyncStorage**: Persistent token storage on client

### UI/UX Libraries
- **expo-blur**: iOS-style blur effects for tab bars and headers
- **expo-haptics**: Haptic feedback on interactions
- **react-native-reanimated**: Smooth animations
- **react-native-keyboard-controller**: Keyboard-aware form handling
- **@expo/vector-icons (Feather)**: Icon set throughout the app

### Development & Build
- **Replit Environment**: Uses `REPLIT_DEV_DOMAIN` and `REPLIT_DOMAINS` for CORS and API URL configuration
- **tsx**: TypeScript execution for development server
- **esbuild**: Production server bundling