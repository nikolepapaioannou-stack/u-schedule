import React from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, ViewStyle } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  bookingId?: string;
  isRead: boolean;
  createdAt: string;
}

const NOTIFICATION_ICONS: Record<string, string> = {
  booking_approved: "check-circle",
  booking_rejected: "x-circle",
  hold_expiring: "alert-triangle",
  hold_expired: "clock",
  waitlist_available: "bell",
  default: "bell",
};

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, refetch, isRefetching } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchOnWindowFocus: true,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("PUT", `/api/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", "/api/notifications/read-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleMarkAsRead = (id: string) => {
    markAsReadMutation.mutate(id);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Μόλις τώρα";
    if (diffMins < 60) return `${diffMins} λεπτά πριν`;
    if (diffHours < 24) return `${diffHours} ώρες πριν`;
    if (diffDays < 7) return `${diffDays} ημέρες πριν`;
    
    return date.toLocaleDateString("el-GR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const iconName = NOTIFICATION_ICONS[item.type] || NOTIFICATION_ICONS.default;
    const isUnread = !item.isRead;

    const cardStyle: ViewStyle = {
      ...styles.notificationCard,
      ...(isUnread ? { backgroundColor: theme.primary + "10" } : {}),
    };

    return (
      <Pressable onPress={() => !item.isRead && handleMarkAsRead(item.id)}>
        <Card
          elevation={isUnread ? 2 : 1}
          style={cardStyle}
        >
          <View style={styles.cardContent}>
            <View style={[
              styles.iconContainer,
              { backgroundColor: isUnread ? theme.primary + "20" : theme.backgroundSecondary }
            ]}>
              <Feather 
                name={iconName as any} 
                size={20} 
                color={isUnread ? theme.primary : theme.textSecondary} 
              />
            </View>
            <View style={styles.textContent}>
              <View style={styles.titleRow}>
                <ThemedText 
                  type="body" 
                  style={[styles.title, isUnread && { fontWeight: "700" }]}
                >
                  {item.title}
                </ThemedText>
                {isUnread ? (
                  <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
                ) : null}
              </View>
              <ThemedText type="small" style={styles.message}>
                {item.message}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {formatDate(item.createdAt)}
              </ThemedText>
            </View>
          </View>
        </Card>
      </Pressable>
    );
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotificationItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + Spacing.xl }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          unreadCount > 0 ? (
            <Pressable 
              style={[styles.markAllButton, { backgroundColor: theme.primary + "10" }]}
              onPress={handleMarkAllAsRead}
            >
              <Feather name="check-square" size={16} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary, marginLeft: 6 }}>
                Επισήμανση όλων ως αναγνωσμένα ({unreadCount})
              </ThemedText>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Feather name="bell-off" size={48} color={theme.textSecondary} />
              <ThemedText type="body" style={[styles.emptyText, { color: theme.textSecondary }]}>
                Δεν έχετε ειδοποιήσεις
              </ThemedText>
            </View>
          ) : null
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  notificationCard: {
    marginBottom: Spacing.md,
  },
  cardContent: {
    flexDirection: "row",
    padding: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  textContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  title: {
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: Spacing.sm,
  },
  message: {
    marginBottom: Spacing.xs,
  },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyText: {
    marginTop: Spacing.md,
  },
});
