import { storage } from './storage';

export async function sendExpoPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
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
          console.log(`[Push] Sent notification to user ${userId}: "${title}"`);
        }
      } catch (error) {
        console.error(`[Push] Error sending to ${tokenRecord.token}:`, error);
      }
    }
  } catch (error) {
    console.error(`[Push] Error getting tokens for user ${userId}:`, error);
  }
}

export async function sendPushToAdmins(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const admins = await storage.getAdminUsers();
    for (const admin of admins) {
      await sendExpoPushNotification(admin.id, title, body, data);
    }
  } catch (error) {
    console.error('[Push] Error sending to admins:', error);
  }
}
