import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useTheme } from "@/hooks/useTheme";
import { useAuthenticatedFetch } from "@/lib/auth";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { AppIcon } from "@/components/AppIcon";
import { Spacing } from "@/constants/theme";
import type { Booking } from "@shared/schema";

type FilterTab = "pending" | "verification" | "all";

function getDaysUntil(dateStr: string): number {
  const examDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  examDate.setHours(0, 0, 0, 0);
  const diffTime = examDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function getGreekDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("el-GR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function getStatusLabel(status: string | null): string {
  switch (status) {
    case "user_completed":
      return "Προς Επαλήθευση";
    case "verified":
      return "Επαληθευμένο";
    case "rejected":
      return "Απορρίφθηκε";
    case "pending":
    default:
      return "Εκκρεμεί";
  }
}

function getStatusColor(status: string | null, theme: any): string {
  switch (status) {
    case "user_completed":
      return theme.warning;
    case "verified":
      return theme.success;
    case "rejected":
      return theme.error;
    case "pending":
    default:
      return theme.textSecondary;
  }
}

export default function ExternalActionsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>("verification");

  const { data: pendingActions = [], isLoading: loadingPending, refetch: refetchPending } = useQuery<Booking[]>({
    queryKey: ["/api/external-actions/pending"],
    queryFn: () => authFetch("/api/external-actions/pending"),
  });

  const { data: pendingVerification = [], isLoading: loadingVerification, refetch: refetchVerification } = useQuery<Booking[]>({
    queryKey: ["/api/external-actions/pending-verification"],
    queryFn: () => authFetch("/api/external-actions/pending-verification"),
  });

  const verifyMutation = useMutation({
    mutationFn: (bookingId: string) =>
      authFetch(`/api/bookings/${bookingId}/external-action/verify`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-actions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/external-actions/pending-verification"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ bookingId, reason }: { bookingId: string; reason?: string }) =>
      authFetch(`/api/bookings/${bookingId}/external-action/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-actions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/external-actions/pending-verification"] });
    },
  });

  const adminCompleteMutation = useMutation({
    mutationFn: (bookingId: string) =>
      authFetch(`/api/bookings/${bookingId}/external-action/admin-complete`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-actions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/external-actions/pending-verification"] });
    },
  });

  const isActionPending = verifyMutation.isPending || rejectMutation.isPending || adminCompleteMutation.isPending;

  const handleVerify = (bookingId: string) => {
    Alert.alert(
      "Επιβεβαίωση",
      "Είστε σίγουροι ότι η εξωτερική ενέργεια ολοκληρώθηκε σωστά;",
      [
        { text: "Ακύρωση", style: "cancel" },
        {
          text: "Επιβεβαίωση",
          onPress: () => verifyMutation.mutate(bookingId),
        },
      ]
    );
  };

  const handleReject = (bookingId: string) => {
    Alert.alert(
      "Απόρριψη",
      "Θέλετε να απορρίψετε την εξωτερική ενέργεια; Ο χρήστης θα ειδοποιηθεί να την επαναλάβει.",
      [
        { text: "Ακύρωση", style: "cancel" },
        {
          text: "Απόρριψη",
          style: "destructive",
          onPress: () => rejectMutation.mutate({ bookingId }),
        },
      ]
    );
  };

  const handleAdminComplete = (bookingId: string) => {
    Alert.alert(
      "Ολοκλήρωση από Admin",
      "Θέλετε να σημειώσετε την ενέργεια ως ολοκληρωμένη;",
      [
        { text: "Ακύρωση", style: "cancel" },
        {
          text: "Ολοκλήρωση",
          onPress: () => adminCompleteMutation.mutate(bookingId),
        },
      ]
    );
  };

  const getFilteredData = (): Booking[] => {
    switch (activeTab) {
      case "verification":
        return pendingVerification;
      case "pending":
        return pendingActions.filter(
          (b) => b.externalActionStatus === "pending" || !b.externalActionStatus
        );
      case "all":
      default:
        return pendingActions;
    }
  };

  const filteredData = getFilteredData();
  const isLoading = loadingPending || loadingVerification;

  const renderBookingCard = (booking: Booking) => {
    const daysUntil = getDaysUntil(booking.bookingDate);
    const isUrgent = daysUntil <= 2;
    const isPendingVerification = booking.externalActionStatus === "user_completed";

    return (
      <Card key={booking.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.departmentInfo}>
            <ThemedText style={styles.departmentId}>{booking.departmentId}</ThemedText>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: getStatusColor(booking.externalActionStatus, theme) + "20" },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: getStatusColor(booking.externalActionStatus, theme) },
                ]}
              >
                {getStatusLabel(booking.externalActionStatus)}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.daysBadge,
              { backgroundColor: isUrgent ? theme.error + "20" : theme.primary + "20" },
            ]}
          >
            <Text
              style={[styles.daysText, { color: isUrgent ? theme.error : theme.primary }]}
            >
              {daysUntil === 0
                ? "Σήμερα"
                : daysUntil === 1
                ? "Αύριο"
                : `${daysUntil} ημέρες`}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <AppIcon name="calendar-outline" size={16} color={theme.textSecondary} />
            <ThemedText style={styles.detailText}>{getGreekDate(booking.bookingDate)}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <AppIcon name="account-group-outline" size={16} color={theme.textSecondary} />
            <ThemedText style={styles.detailText}>{booking.candidateCount} υποψήφιοι</ThemedText>
          </View>
        </View>

        {isPendingVerification ? (
          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.success, opacity: isActionPending ? 0.6 : 1 }]}
              onPress={() => handleVerify(booking.id)}
              disabled={isActionPending}
            >
              <AppIcon name="check" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Επιβεβαίωση</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.error, opacity: isActionPending ? 0.6 : 1 }]}
              onPress={() => handleReject(booking.id)}
              disabled={isActionPending}
            >
              <AppIcon name="close" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Απόρριψη</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.adminCompleteButton, { backgroundColor: theme.primary, opacity: isActionPending ? 0.6 : 1 }]}
            onPress={() => handleAdminComplete(booking.id)}
            disabled={isActionPending}
          >
            <AppIcon name="check-circle-outline" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Ολοκλήρωση</Text>
          </Pressable>
        )}
      </Card>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <ThemedText style={styles.title}>Εξωτερικές Ενέργειες</ThemedText>
        <ThemedText style={styles.subtitle}>
          {pendingVerification.length} προς επαλήθευση | {pendingActions.length} συνολικά
        </ThemedText>
      </View>

      <View style={styles.tabContainer}>
        <Pressable
          style={[
            styles.tab,
            activeTab === "verification" && { backgroundColor: theme.primary },
          ]}
          onPress={() => setActiveTab("verification")}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === "verification" ? "#fff" : theme.text },
            ]}
          >
            Προς Επαλήθευση ({pendingVerification.length})
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            activeTab === "pending" && { backgroundColor: theme.primary },
          ]}
          onPress={() => setActiveTab("pending")}
        >
          <Text
            style={[styles.tabText, { color: activeTab === "pending" ? "#fff" : theme.text }]}
          >
            Εκκρεμείς
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === "all" && { backgroundColor: theme.primary }]}
          onPress={() => setActiveTab("all")}
        >
          <Text style={[styles.tabText, { color: activeTab === "all" ? "#fff" : theme.text }]}>
            Όλες
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: tabBarHeight + Spacing.xl },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => {
                refetchPending();
                refetchVerification();
              }}
            />
          }
        >
          {filteredData.length === 0 ? (
            <View style={styles.emptyContainer}>
              <AppIcon name="check-circle-outline" size={64} color={theme.textSecondary} />
              <ThemedText style={styles.emptyText}>
                {activeTab === "verification"
                  ? "Δεν υπάρχουν ενέργειες προς επαλήθευση"
                  : "Δεν υπάρχουν εκκρεμείς ενέργειες"}
              </ThemedText>
            </View>
          ) : (
            filteredData.map(renderBookingCard)
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "rgba(128,128,128,0.1)",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
    textAlign: "center",
  },
  card: {
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
  },
  departmentInfo: {
    flex: 1,
    gap: 4,
  },
  departmentId: {
    fontSize: 16,
    fontWeight: "600",
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  daysBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  daysText: {
    fontSize: 12,
    fontWeight: "600",
  },
  cardDetails: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    opacity: 0.8,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  adminCompleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
});
