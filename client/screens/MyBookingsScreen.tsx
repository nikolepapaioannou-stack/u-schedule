import React, { useState, useCallback, useMemo } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { useAuthenticatedFetch } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type FilterTab = "active" | "history";

interface Booking {
  id: string;
  departmentId: string;
  candidateCount: number;
  bookingDate: string;
  status: string;
  preferredShift: string;
  confirmationNumber: string;
  createdAt: string;
  adminNotes?: string;
}

const STATUS_CONFIG = {
  holding: { label: "Σε Αναμονή", color: "statusPending", icon: "time-outline" },
  pending: { label: "Υποβλήθηκε", color: "warning", icon: "send-outline" },
  approved: { label: "Εγκρίθηκε", color: "statusApproved", icon: "checkmark-circle-outline" },
  rejected: { label: "Απορρίφθηκε", color: "statusRejected", icon: "close-circle-outline" },
  expired: { label: "Έληξε", color: "statusCompleted", icon: "time-outline" },
  completed: { label: "Ολοκληρώθηκε", color: "statusCompleted", icon: "checkmark-outline" },
} as const;

const SHIFT_LABELS = {
  morning: "Πρωί",
  midday: "Μεσημέρι",
  afternoon: "Απόγευμα",
};

const ACTIVE_STATUSES = ["holding", "pending", "approved"];
const HISTORY_STATUSES = ["rejected", "expired", "completed"];

export default function MyBookingsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const authFetch = useAuthenticatedFetch();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>("active");

  const fetchBookings = useCallback(async () => {
    try {
      const data = await authFetch("/api/bookings");
      setBookings(data);
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchBookings();
  };

  const filteredBookings = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return bookings.filter((booking) => {
      const bookingDate = new Date(booking.bookingDate);
      bookingDate.setHours(0, 0, 0, 0);
      const isPastDate = bookingDate < today;
      
      if (activeTab === "active") {
        return ACTIVE_STATUSES.includes(booking.status) && !isPastDate;
      } else {
        return HISTORY_STATUSES.includes(booking.status) || isPastDate;
      }
    });
  }, [bookings, activeTab]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("el-GR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const renderBookingItem = ({ item }: { item: Booking }) => {
    const statusConfig = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    const statusColor = theme[statusConfig.color as keyof typeof theme] as string;

    return (
      <Card
        elevation={1}
        style={styles.bookingCard}
        onPress={() => navigation.navigate("BookingDetails", { bookingId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={styles.departmentBadge}>
            <ThemedText type="h4">Τμήμα {item.departmentId}</ThemedText>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <Ionicons name={statusConfig.icon as any} size={14} color={statusColor} />
            <ThemedText type="caption" style={{ color: statusColor, marginLeft: 4, fontWeight: "600" }}>
              {statusConfig.label}
            </ThemedText>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              {formatDate(item.bookingDate)}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              {SHIFT_LABELS[item.preferredShift as keyof typeof SHIFT_LABELS] || item.preferredShift}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              {item.candidateCount} υποψήφιοι
            </ThemedText>
          </View>
        </View>

        {item.confirmationNumber ? (
          <View style={[styles.confirmationRow, { borderTopColor: theme.border }]}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              Αρ. Επιβεβαίωσης:
            </ThemedText>
            <ThemedText type="small" style={{ fontWeight: "600" }}>
              {item.confirmationNumber}
            </ThemedText>
          </View>
        ) : null}
      </Card>
    );
  };

  const renderEmptyState = () => {
    const isHistoryTab = activeTab === "history";
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
          <Ionicons name={isHistoryTab ? "archive-outline" : "calendar-outline"} size={48} color={theme.textSecondary} />
        </View>
        <ThemedText type="h3" style={{ marginTop: Spacing.xl, textAlign: "center" }}>
          {isHistoryTab ? "Δεν υπάρχει ιστορικό" : "Δεν υπάρχουν ενεργές κρατήσεις"}
        </ThemedText>
        <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
          {isHistoryTab 
            ? "Οι ολοκληρωμένες και παρελθούσες κρατήσεις σας θα εμφανίζονται εδώ" 
            : "Αναζητήστε διαθέσιμες θέσεις για να κάνετε την πρώτη σας κράτηση"}
        </ThemedText>
      </View>
    );
  };

  const renderTabSelector = () => (
    <View style={[styles.tabContainer, { backgroundColor: theme.backgroundSecondary }]}>
      <Pressable
        style={[
          styles.tab,
          activeTab === "active" && { backgroundColor: theme.background },
        ]}
        onPress={() => setActiveTab("active")}
      >
        <Ionicons 
          name="time-outline" 
          size={16} 
          color={activeTab === "active" ? theme.primary : theme.textSecondary} 
        />
        <ThemedText 
          type="body" 
          style={{ 
            marginLeft: Spacing.xs, 
            color: activeTab === "active" ? theme.primary : theme.textSecondary,
            fontWeight: activeTab === "active" ? "600" : "400",
          }}
        >
          Ενεργές
        </ThemedText>
      </Pressable>
      <Pressable
        style={[
          styles.tab,
          activeTab === "history" && { backgroundColor: theme.background },
        ]}
        onPress={() => setActiveTab("history")}
      >
        <Ionicons 
          name="archive-outline" 
          size={16} 
          color={activeTab === "history" ? theme.primary : theme.textSecondary} 
        />
        <ThemedText 
          type="body" 
          style={{ 
            marginLeft: Spacing.xs, 
            color: activeTab === "history" ? theme.primary : theme.textSecondary,
            fontWeight: activeTab === "history" ? "600" : "400",
          }}
        >
          Ιστορικό
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={filteredBookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBookingItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: tabBarHeight + Spacing.xl },
          filteredBookings.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={
          <View>
            <HeaderTitle title="Οι Κρατήσεις Μου" />
            {renderTabSelector()}
          </View>
        }
        ListEmptyComponent={!isLoading ? renderEmptyState() : null}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
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
  emptyListContent: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  bookingCard: {
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  departmentBadge: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  cardBody: {
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  confirmationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
  },
});
