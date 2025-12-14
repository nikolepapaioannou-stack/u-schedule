import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, useAuthenticatedFetch } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface DashboardStats {
  todayBookings: number;
  pendingApprovals: number;
  weekBookings: number;
  totalApproved: number;
}

interface RecentBooking {
  id: string;
  departmentId: string;
  candidateCount: number;
  bookingDate: string;
  status: string;
  createdAt: string;
}

const STATUS_CONFIG = {
  holding: { label: "Σε Αναμονή", color: "statusPending", icon: "clock" },
  pending: { label: "Υποβλήθηκε", color: "warning", icon: "send" },
  approved: { label: "Εγκρίθηκε", color: "statusApproved", icon: "check-circle" },
  rejected: { label: "Απορρίφθηκε", color: "statusRejected", icon: "x-circle" },
} as const;

export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const authFetch = useAuthenticatedFetch();

  const [stats, setStats] = useState<DashboardStats>({
    todayBookings: 0,
    pendingApprovals: 0,
    weekBookings: 0,
    totalApproved: 0,
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [bookingsData, statsData] = await Promise.all([
        authFetch("/api/bookings"),
        authFetch("/api/admin/stats").catch(() => null),
      ]);

      const allBookings = bookingsData || [];
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const todayBookings = allBookings.filter((b: any) => b.bookingDate === today).length;
      const pendingApprovals = allBookings.filter((b: any) => b.status === "pending").length;
      const weekBookings = allBookings.filter((b: any) => b.bookingDate >= weekAgo).length;
      const totalApproved = allBookings.filter((b: any) => b.status === "approved").length;

      setStats(statsData || { todayBookings, pendingApprovals, weekBookings, totalApproved });
      
      const recent = allBookings
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      setRecentBookings(recent);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("el-GR", {
      day: "2-digit",
      month: "short",
    });
  };

  const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) => (
    <Card elevation={1} style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <MaterialCommunityIcons name={icon as any} size={24} color={color} />
      </View>
      <ThemedText type="hero" style={{ marginTop: Spacing.sm }}>{value}</ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary }}>{label}</ThemedText>
    </Card>
  );

  const renderBookingItem = ({ item }: { item: RecentBooking }) => {
    const statusConfig = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    const statusColor = theme[statusConfig.color as keyof typeof theme] as string;

    return (
      <Pressable
        onPress={() => navigation.navigate("BookingDetails", { bookingId: item.id })}
        style={({ pressed }) => [
          styles.bookingItem,
          { backgroundColor: pressed ? theme.backgroundSecondary : theme.backgroundDefault },
        ]}
      >
        <View style={styles.bookingInfo}>
          <ThemedText type="h4">Τμήμα {item.departmentId}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {formatDate(item.bookingDate)} - {item.candidateCount} υποψήφιοι
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
          <MaterialCommunityIcons name={statusConfig.icon as any} size={12} color={statusColor} />
          <ThemedText type="caption" style={{ color: statusColor, marginLeft: 4 }}>
            {statusConfig.label}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  const ListHeader = () => (
    <View style={styles.header}>
      <HeaderTitle title="ExamScheduler" />
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
        Καλώς ήρθατε, Διαχειριστή
      </ThemedText>

      <View style={styles.statsGrid}>
        <StatCard icon="calendar" label="Σήμερα" value={stats.todayBookings} color={theme.primary} />
        <StatCard icon="clock" label="Εκκρεμείς" value={stats.pendingApprovals} color={theme.warning} />
        <StatCard icon="trending-up" label="Εβδομάδα" value={stats.weekBookings} color={theme.secondary} />
        <StatCard icon="check-circle" label="Εγκεκριμένες" value={stats.totalApproved} color={theme.success} />
      </View>

      <View style={styles.sectionHeader}>
        <ThemedText type="h3">Πρόσφατες Κρατήσεις</ThemedText>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="inbox" size={48} color={theme.textSecondary} />
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.lg, textAlign: "center" }}>
        Δεν υπάρχουν πρόσφατες κρατήσεις
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={recentBookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBookingItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.xl,
    marginHorizontal: -Spacing.xs,
  },
  statCard: {
    width: "48%",
    marginHorizontal: "1%",
    marginBottom: Spacing.md,
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeader: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  bookingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  bookingInfo: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  separator: {
    height: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
});
