import { useState, useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import {
  registerPushToken,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from "@/lib/notifications";
import { useAuth } from "@/lib/auth";

export function usePushNotifications() {
  const { user, token } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const notificationListener = useRef<{ remove: () => void } | null>(null);
  const responseListener = useRef<{ remove: () => void } | null>(null);

  const registerForNotifications = useCallback(async () => {
    if (!token || Platform.OS === "web" || Platform.OS === "android") {
      return;
    }

    try {
      const result = await registerPushToken(token);
      setIsRegistered(result.success);
      setExpoPushToken(result.token);
    } catch (error) {
      console.error("Failed to register for push notifications:", error);
    }
  }, [token]);

  useEffect(() => {
    if (user && token) {
      registerForNotifications();
    }
  }, [user, token, registerForNotifications]);

  useEffect(() => {
    if (Platform.OS === "web" || Platform.OS === "android") {
      return;
    }

    notificationListener.current = addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    responseListener.current = addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log("Notification response:", data);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return {
    expoPushToken,
    notification,
    isRegistered,
    registerForNotifications,
  };
}
