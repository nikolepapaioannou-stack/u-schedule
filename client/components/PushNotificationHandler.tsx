import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  registerPushToken,
  addNotificationReceivedListener,
  addNotificationResponseReceivedListener,
} from "@/lib/notifications";

export function PushNotificationHandler() {
  const queryClient = useQueryClient();
  const { user, token } = useAuth();
  const isRegistered = useRef(false);
  const notificationSubscription = useRef<{ remove: () => void } | null>(null);
  const responseSubscription = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    if (!user || !token) {
      return;
    }

    if (isRegistered.current) {
      return;
    }

    const setupNotifications = async () => {
      try {
        const result = await registerPushToken(token);
        if (result.success) {
          console.log("[PushNotificationHandler] Push token registered:", result.token);
          isRegistered.current = true;
        } else {
          console.log("[PushNotificationHandler] Failed to register push token");
        }

        if (!notificationSubscription.current) {
          notificationSubscription.current = addNotificationReceivedListener((notification) => {
            console.log("[PushNotificationHandler] Notification received:", notification);
            queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
            queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
          });
        }

        if (!responseSubscription.current) {
          responseSubscription.current = addNotificationResponseReceivedListener((response) => {
            console.log("[PushNotificationHandler] Notification response:", response);
            const data = response?.notification?.request?.content?.data;
            if (data?.bookingId) {
              queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
            }
          });
        }
      } catch (error) {
        console.error("[PushNotificationHandler] Error setting up notifications:", error);
      }
    };

    setupNotifications();

    return () => {
      if (notificationSubscription.current) {
        notificationSubscription.current.remove();
        notificationSubscription.current = null;
      }
      if (responseSubscription.current) {
        responseSubscription.current.remove();
        responseSubscription.current = null;
      }
      isRegistered.current = false;
    };
  }, [user, token, queryClient]);

  return null;
}
