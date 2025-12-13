import { useEffect } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useQueryClient } from "@tanstack/react-query";

export function PushNotificationHandler() {
  const { notification, isRegistered } = usePushNotifications();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (notification) {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      
      const data = notification.request.content.data;
      if (data?.bookingId) {
        queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      }
    }
  }, [notification, queryClient]);

  return null;
}
