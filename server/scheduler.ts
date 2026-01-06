import cron from 'node-cron';
import { storage } from './storage';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getGreekDateString(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('el-GR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatDateDDMMYYYY(dateStr: string): string {
  const date = new Date(dateStr);
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function getDeadlineDate(examDateStr: string): string {
  const examDate = new Date(examDateStr);
  const deadline = addDays(examDate, -1);
  return formatDateDDMMYYYY(deadline.toISOString().split('T')[0]);
}

async function sendDailyAdminReminder() {
  console.log('[Scheduler] Running daily admin reminder job...');
  
  const targetDate = addDays(new Date(), 4);
  const targetDateStr = formatDate(targetDate);
  
  const bookings = await storage.getBookingsNeedingWarning(targetDateStr);
  
  if (bookings.length === 0) {
    console.log('[Scheduler] No bookings need warning for', targetDateStr);
    return;
  }
  
  console.log(`[Scheduler] Found ${bookings.length} bookings for ${targetDateStr} needing attention`);
  
  const admins = await storage.getAdminUsers();
  
  const departmentList = bookings.map(b => b.departmentId).join(', ');
  
  for (const admin of admins) {
    await storage.createNotification({
      userId: admin.id,
      type: 'admin_reminder',
      title: 'Υπενθύμιση ανάρτησης Voucher',
      message: `Υπάρχουν ${bookings.length} εξετάσεις προγραμματισμένες για ${getGreekDateString(targetDateStr)} που απαιτούν ανάρτηση κωδικών επιταγής πιστοποίησης. Τμήματα: ${departmentList}. Παρακαλώ ελέγξτε αν έχουν αναρτηθεί οι κωδικοί.`,
      bookingId: bookings[0]?.id,
    });
    console.log(`[Scheduler] Sent reminder to admin ${admin.email}`);
  }
  
  for (const booking of bookings) {
    const user = await storage.getUser(booking.userId);
    if (user) {
      const deadlineDate = getDeadlineDate(targetDateStr);
      await storage.createNotification({
        userId: user.id,
        type: 'action_reminder',
        title: 'Υπενθύμιση ανάρτησης Voucher',
        message: `Η εξέταση για το τμήμα ${booking.departmentId} είναι προγραμματισμένη για ${getGreekDateString(targetDateStr)}. Παρακαλώ βεβαιωθείτε ότι έχετε αναρτήσει τους κωδικούς επιταγής πιστοποίησης μέχρι και ${deadlineDate} στις 12:00μ.μ.`,
        bookingId: booking.id,
      });
    }
    await storage.markWarningSent(booking.id);
  }
  
  console.log('[Scheduler] Daily admin reminder completed');
}

async function checkDeadlines() {
  console.log('[Scheduler] Running deadline check job...');
  
  const now = new Date();
  const currentHour = now.getHours();
  
  if (currentHour < 12) {
    console.log('[Scheduler] Before noon, skipping deadline enforcement');
    return;
  }
  
  const tomorrow = addDays(new Date(), 1);
  const tomorrowStr = formatDate(tomorrow);
  
  const bookings = await storage.getBookingsNeedingDeadlineCheck(tomorrowStr);
  
  if (bookings.length === 0) {
    console.log('[Scheduler] No bookings need deadline check for', tomorrowStr);
    return;
  }
  
  console.log(`[Scheduler] Found ${bookings.length} bookings for ${tomorrowStr} to check`);
  
  const admins = await storage.getAdminUsers();
  
  for (const booking of bookings) {
    if (booking.externalActionStatus === 'verified') {
      continue;
    }
    
    console.log(`[Scheduler] Cancelling booking ${booking.id} due to deadline`);
    await storage.cancelBookingDueToDeadline(booking.id);
    
    const user = await storage.getUser(booking.userId);
    const examDateFormatted = formatDateDDMMYYYY(tomorrowStr);
    if (user) {
      await storage.createNotification({
        userId: user.id,
        type: 'booking_cancelled',
        title: 'Ακύρωση Εξέτασης',
        message: `Η εξέταση για το τμήμα ${booking.departmentId} (${examDateFormatted}) ακυρώθηκε λόγω μη ανάρτησης των κωδικών επιταγής πιστοποίησης μέχρι την προθεσμία (12:00μ.μ. μια ημέρα πριν).`,
        bookingId: booking.id,
      });
    }
    
    for (const admin of admins) {
      await storage.createNotification({
        userId: admin.id,
        type: 'booking_auto_cancelled',
        title: 'Αυτόματη Ακύρωση Εξέτασης',
        message: `Η εξέταση του τμήματος ${booking.departmentId} (${examDateFormatted}) ακυρώθηκε αυτόματα λόγω μη ανάρτησης των κωδικών επιταγής πιστοποίησης.`,
        bookingId: booking.id,
      });
    }
  }
  
  console.log('[Scheduler] Deadline check completed');
}

async function runManualCheck() {
  console.log('[Scheduler] Running manual check...');
  await sendDailyAdminReminder();
  await checkDeadlines();
  console.log('[Scheduler] Manual check completed');
}

export function initScheduler() {
  console.log('[Scheduler] Initializing scheduler...');
  
  cron.schedule('0 8 * * *', async () => {
    console.log('[Scheduler] Running 08:00 daily reminder job');
    await sendDailyAdminReminder();
  }, {
    timezone: 'Europe/Athens'
  });
  
  cron.schedule('0 12 * * *', async () => {
    console.log('[Scheduler] Running 12:00 deadline check job');
    await checkDeadlines();
  }, {
    timezone: 'Europe/Athens'
  });
  
  console.log('[Scheduler] Scheduler initialized with:');
  console.log('  - Daily reminder at 08:00 Europe/Athens');
  console.log('  - Deadline check at 12:00 Europe/Athens');
}

export { runManualCheck, sendDailyAdminReminder, checkDeadlines };
