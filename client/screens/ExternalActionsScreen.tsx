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
  Platform,
  Image,
  Modal,
} from "react-native";

function crossPlatformConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText: string = "OK",
  isDestructive: boolean = false
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: "Ακύρωση", style: "cancel" },
      {
        text: confirmText,
        style: isDestructive ? "destructive" : "default",
        onPress: onConfirm,
      },
    ]);
  }
}
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

type BookingWithReminder = Booking & {
  lastReminderSent?: string | null;
};

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

function getGreekDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("el-GR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
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
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  const { data: pendingActions = [], isLoading: loadingPending, refetch: refetchPending } = useQuery<BookingWithReminder[]>({
    queryKey: ["/api/external-actions/pending"],
    queryFn: () => authFetch("/api/external-actions/pending"),
  });

  const { data: pendingVerification = [], isLoading: loadingVerification, refetch: refetchVerification } = useQuery<BookingWithReminder[]>({
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

  const sendReminderMutation = useMutation({
    mutationFn: (bookingId: string) =>
      authFetch(`/api/bookings/${bookingId}/external-action/send-reminder`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/external-actions/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/external-actions/pending-verification"] });
      if (Platform.OS === "web") {
        window.alert("Η υπενθύμιση στάλθηκε επιτυχώς");
      } else {
        Alert.alert("Επιτυχία", "Η υπενθύμιση στάλθηκε επιτυχώς");
      }
    },
  });

  const isActionPending = verifyMutation.isPending || rejectMutation.isPending || adminCompleteMutation.isPending || sendReminderMutation.isPending;

  const handleVerify = (bookingId: string) => {
    crossPlatformConfirm(
      "Επιβεβαίωση",
      "Είστε σίγουροι ότι η εξωτερική ενέργεια ολοκληρώθηκε σωστά;",
      () => verifyMutation.mutate(bookingId),
      "Επιβεβαίωση"
    );
  };

  const handleReject = (bookingId: string) => {
    crossPlatformConfirm(
      "Απόρριψη",
      "Θέλετε να απορρίψετε την εξωτερική ενέργεια; Ο χρήστης θα ειδοποιηθεί να την επαναλάβει.",
      () => rejectMutation.mutate({ bookingId }),
      "Απόρριψη",
      true
    );
  };

  const handleAdminComplete = (bookingId: string) => {
    crossPlatformConfirm(
      "Ολοκλήρωση από Admin",
      "Θέλετε να σημειώσετε την ενέργεια ως ολοκληρωμένη;",
      () => adminCompleteMutation.mutate(bookingId),
      "Ολοκλήρωση"
    );
  };

  const handleSendReminder = (bookingId: string) => {
    crossPlatformConfirm(
      "Αποστολή Υπενθύμισης",
      "Θέλετε να στείλετε υπενθύμιση στον χρήστη για την εκκρεμή ενέργεια;",
      () => sendReminderMutation.mutate(bookingId),
      "Αποστολή"
    );
  };

  const getFilteredData = (): BookingWithReminder[] => {
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

  const renderBookingCard = (booking: BookingWithReminder) => {
    const daysUntil = getDaysUntil(booking.bookingDate);
    const isUrgent = daysUntil <= 2;
    const isPendingVerification = booking.externalActionStatus === "user_completed";
    const hasReminderSent = !!booking.lastReminderSent;

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
          {hasReminderSent && booking.lastReminderSent ? (
            <View style={styles.detailRow}>
              <AppIcon name="check-circle-outline" size={16} color={theme.success} />
              <Text style={[styles.detailText, { color: theme.success }]}>
                Υπενθύμιση: {getGreekDateTime(booking.lastReminderSent)}
              </Text>
            </View>
          ) : null}
        </View>

        {isPendingVerification ? (
          <>
            {booking.externalActionProofPhotoUrl ? (
              <Pressable 
                style={styles.proofPhotoContainer}
                onPress={() => setViewingPhoto(booking.externalActionProofPhotoUrl!)}
              >
                <Image 
                  source={{ uri: booking.externalActionProofPhotoUrl }}
                  style={styles.proofPhotoThumbnail}
                  resizeMode="cover"
                />
                <View style={[styles.photoLabel, { backgroundColor: theme.success + "20" }]}>
                  <AppIcon name="check-circle-outline" size={14} color={theme.success} />
                  <Text style={[styles.photoLabelText, { color: theme.success }]}>
                    Φωτογραφία Απόδειξης
                  </Text>
                </View>
              </Pressable>
            ) : (
              <View style={[styles.noPhotoContainer, { backgroundColor: theme.warning + "20" }]}>
                <AppIcon name="information-outline" size={16} color={theme.warning} />
                <Text style={[styles.noPhotoText, { color: theme.warning }]}>
                  Χωρίς φωτογραφία απόδειξης
                </Text>
              </View>
            )}
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
          </>
        ) : (
          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: hasReminderSent ? theme.textSecondary : theme.warning, opacity: isActionPending ? 0.6 : 1 }]}
              onPress={() => handleSendReminder(booking.id)}
              disabled={isActionPending}
            >
              <AppIcon name="bell-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>{hasReminderSent ? "Επανα-υπενθύμιση" : "Υπενθύμιση"}</Text>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.primary, opacity: isActionPending ? 0.6 : 1 }]}
              onPress={() => handleAdminComplete(booking.id)}
              disabled={isActionPending}
            >
              <AppIcon name="check-circle-outline" size={18} color="#fff" />
              <Text style={styles.actionButtonText}>Ολοκλήρωση</Text>
            </Pressable>
          </View>
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

      <Modal
        visible={!!viewingPhoto}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewingPhoto(null)}
      >
        <Pressable 
          style={styles.photoModalOverlay}
          onPress={() => setViewingPhoto(null)}
        >
          <View style={styles.photoModalContent}>
            {viewingPhoto ? (
              <Image 
                source={{ uri: viewingPhoto }}
                style={styles.fullPhoto}
                resizeMode="contain"
              />
            ) : null}
            <Pressable 
              style={[styles.closeButton, { backgroundColor: theme.error }]}
              onPress={() => setViewingPhoto(null)}
            >
              <AppIcon name="close" size={24} color="#fff" />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
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
  proofPhotoContainer: {
    marginBottom: Spacing.md,
  },
  proofPhotoThumbnail: {
    width: "100%",
    height: 120,
    borderRadius: 8,
  },
  photoLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 8,
  },
  photoLabelText: {
    fontSize: 12,
    fontWeight: "600",
  },
  noPhotoContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: Spacing.md,
  },
  noPhotoText: {
    fontSize: 13,
    fontWeight: "500",
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  photoModalContent: {
    width: "90%",
    height: "80%",
    justifyContent: "center",
    alignItems: "center",
  },
  fullPhoto: {
    width: "100%",
    height: "100%",
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
