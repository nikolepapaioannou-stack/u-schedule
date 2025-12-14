import { Platform } from "react-native";
import { getApiUrl } from "./query-client";

let Notifications: any = null;
let Device: any = null;
let Constants: any = null;

if (Platform.OS === "ios") {
  Notifications = require("expo-notifications");
  Device = require("expo-device");
  Constants = require("expo-constants");
  
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export interface PushNotificationState {
  expoPushToken: string | null;
  notification: any | null;
}

export interface PermissionResult {
  granted: boolean;
  canAskAgain: boolean;
  shouldOpenSettings: boolean;
}

export async function getNotificationPermissionStatus(): Promise<PermissionResult> {
  if (Platform.OS === "web" || Platform.OS === "android" || !Notifications) {
    return { granted: false, canAskAgain: false, shouldOpenSettings: false };
  }
  
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  return {
    granted: status === "granted",
    canAskAgain: canAskAgain ?? true,
    shouldOpenSettings: status === "denied" && !canAskAgain,
  };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "web" || Platform.OS === "android" || !Notifications || !Device) {
    console.log("Push notifications are not available on this platform");
    return null;
  }

  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus, canAskAgain } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    if (!canAskAgain) {
      console.log("Permission denied and cannot ask again - user should open Settings");
      return null;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Failed to get push token for push notification");
    return null;
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
    return token.data;
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
}

export async function registerPushToken(authToken: string): Promise<{ success: boolean; token: string | null }> {
  const pushToken = await registerForPushNotificationsAsync();
  
  if (!pushToken) {
    return { success: false, token: null };
  }

  try {
    const baseUrl = getApiUrl();
    const url = new URL("/api/push-token", baseUrl);
    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ pushToken }),
    });
    
    if (!response.ok) {
      console.error("Failed to register push token: HTTP", response.status);
      return { success: false, token: pushToken };
    }
    
    return { success: true, token: pushToken };
  } catch (error) {
    console.error("Failed to register push token:", error);
    return { success: false, token: pushToken };
  }
}

export async function unregisterPushToken(authToken: string): Promise<boolean> {
  try {
    const baseUrl = getApiUrl();
    const url = new URL("/api/push-token", baseUrl);
    await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    return true;
  } catch (error) {
    console.error("Failed to unregister push token:", error);
    return false;
  }
}

export function addNotificationReceivedListener(
  listener: (notification: any) => void
) {
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationReceivedListener(listener);
}

export function addNotificationResponseReceivedListener(
  listener: (response: any) => void
) {
  if (!Notifications) return { remove: () => {} };
  return Notifications.addNotificationResponseReceivedListener(listener);
}

export async function schedulePushNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
  seconds?: number
) {
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: data || {},
      sound: true,
    },
    trigger: seconds ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds } : null,
  });
}

export async function getBadgeCount(): Promise<number> {
  if (!Notifications) return 0;
  return await Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(count);
}

export async function dismissAllNotifications(): Promise<void> {
  if (!Notifications) return;
  await Notifications.dismissAllNotificationsAsync();
}
