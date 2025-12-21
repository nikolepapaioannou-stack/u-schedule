import React, { useState, useEffect } from "react";
import { StyleSheet, View, ActivityIndicator, Pressable, Platform, Text, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuthenticatedFetch } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";

const VOUCHER_STATUS_CONFIG = {
  pending: { label: "Εκκρεμεί", color: "warning", icon: "clock-outline" },
  user_completed: { label: "Σε Αναμονή Επιβεβαίωσης", color: "info", icon: "send" },
  verified: { label: "Επαληθευμένο", color: "success", icon: "check-circle" },
  rejected: { label: "Απορρίφθηκε - Επαναλάβετε", color: "error", icon: "alert-circle" },
} as const;

function crossPlatformConfirm(
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText: string = "OK"
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: "Ακύρωση", style: "cancel" },
      { text: confirmText, onPress: onConfirm },
    ]);
  }
}

function formatDateDDMMYYYY(dateStr: string): string {
  const date = new Date(dateStr);
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function getDeadlineDate(examDateStr: string): string {
  const examDate = new Date(examDateStr);
  examDate.setDate(examDate.getDate() - 1);
  return formatDateDDMMYYYY(examDate.toISOString().split("T")[0]);
}
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RoutePropType = RouteProp<RootStackParamList, "BookingDetails">;

const STATUS_CONFIG = {
  holding: { label: "Σε Αναμονή Επιβεβαίωσης", color: "statusPending", icon: "clock" },
  pending: { label: "Αναμένει Έγκριση", color: "warning", icon: "send" },
  approved: { label: "Εγκρίθηκε", color: "statusApproved", icon: "check-circle" },
  rejected: { label: "Απορρίφθηκε", color: "statusRejected", icon: "x-circle" },
  expired: { label: "Έληξε", color: "statusCompleted", icon: "clock" },
} as const;

const SHIFT_LABELS = {
  morning: "Πρωί (08:00-12:00)",
  midday: "Μεσημέρι (12:00-16:00)",
  afternoon: "Απόγευμα (16:00-19:00)",
};

export default function BookingDetailsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const route = useRoute<RoutePropType>();
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();

  const { bookingId } = route.params;

  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const completeVoucherMutation = useMutation({
    mutationFn: () =>
      authFetch(`/api/bookings/${bookingId}/external-action/complete`, {
        method: "POST",
      }),
    onSuccess: (updatedBooking) => {
      setBooking((prev: any) => ({ ...prev, externalActionStatus: "user_completed" }));
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/external-actions/pending"] });
    },
  });

  const handleCompleteVoucher = () => {
    crossPlatformConfirm(
      "Δήλωση Ανάρτησης Voucher",
      "Επιβεβαιώνετε ότι έχετε αναρτήσει τους κωδικούς επιταγής πιστοποίησης; Η δήλωση θα αποσταλεί για επαλήθευση από τον διαχειριστή.",
      () => completeVoucherMutation.mutate(),
      "Επιβεβαίωση"
    );
  };

  useEffect(() => {
    fetchBooking();
  }, []);

  async function fetchBooking() {
    try {
      const bookings = await authFetch("/api/bookings");
      const found = bookings.find((b: any) => b.id === bookingId);
      setBooking(found);
    } catch (error) {
      console.error("Failed to fetch booking:", error);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (!booking) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={48} color={theme.textSecondary} />
        <ThemedText type="h3" style={{ marginTop: Spacing.lg }}>Η κράτηση δεν βρέθηκε</ThemedText>
      </ThemedView>
    );
  }

  const statusConfig = STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const statusColor = theme[statusConfig.color as keyof typeof theme] as string;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("el-GR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={[styles.statusBanner, { backgroundColor: statusColor + "20" }]}>
          <MaterialCommunityIcons name={statusConfig.icon as any} size={24} color={statusColor} />
          <ThemedText type="h4" style={{ color: statusColor, marginLeft: Spacing.md }}>
            {statusConfig.label}
          </ThemedText>
        </View>

        <Card elevation={1} style={styles.detailsCard}>
          <ThemedText type="h3">Στοιχεία Κράτησης</ThemedText>

          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <MaterialCommunityIcons name="tag-outline" size={18} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                Κωδικός Τμήματος
              </ThemedText>
            </View>
            <ThemedText type="h4">{booking.departmentId}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <MaterialCommunityIcons name="calendar-outline" size={18} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                Ημερομηνία Εξέτασης
              </ThemedText>
            </View>
            <ThemedText type="body">{formatDate(booking.bookingDate)}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                Βάρδια
              </ThemedText>
            </View>
            <ThemedText type="body">
              {SHIFT_LABELS[booking.preferredShift as keyof typeof SHIFT_LABELS] || booking.preferredShift}
            </ThemedText>
          </View>

          {booking.examStartHour !== null && booking.examStartHour !== undefined ? (
            <View style={styles.detailRow}>
              <View style={styles.detailLabel}>
                <MaterialCommunityIcons name="clock-start" size={18} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                  Ώρα Έναρξης
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                {booking.examStartHour.toString().padStart(2, "0")}:00
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <MaterialCommunityIcons name="account-group-outline" size={18} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                Αριθμός Υποψηφίων
              </ThemedText>
            </View>
            <ThemedText type="body">{booking.candidateCount}</ThemedText>
          </View>

          {booking.confirmationNumber ? (
            <View style={styles.detailRow}>
              <View style={styles.detailLabel}>
                <MaterialCommunityIcons name="file-document-outline" size={18} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                  Αριθμός Επιβεβαίωσης
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ fontWeight: "600" }}>{booking.confirmationNumber}</ThemedText>
            </View>
          ) : null}
        </Card>

        {booking.status === "approved" ? (
          <Card elevation={1} style={styles.voucherCard}>
            <View style={styles.voucherHeader}>
              <MaterialCommunityIcons name="ticket-confirmation-outline" size={24} color={theme.primary} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Ανάρτηση Voucher</ThemedText>
            </View>
            
            {(() => {
              const voucherStatus = booking.externalActionStatus || "pending";
              const voucherConfig = VOUCHER_STATUS_CONFIG[voucherStatus as keyof typeof VOUCHER_STATUS_CONFIG] || VOUCHER_STATUS_CONFIG.pending;
              const voucherColor = theme[voucherConfig.color as keyof typeof theme] as string || theme.warning;
              const deadlineDate = getDeadlineDate(booking.bookingDate);
              const canComplete = voucherStatus === "pending" || voucherStatus === "rejected";
              
              return (
                <>
                  <View style={[styles.voucherStatusBadge, { backgroundColor: voucherColor + "20" }]}>
                    <MaterialCommunityIcons name={voucherConfig.icon as any} size={18} color={voucherColor} />
                    <Text style={[styles.voucherStatusText, { color: voucherColor }]}>
                      {voucherConfig.label}
                    </Text>
                  </View>
                  
                  <View style={styles.voucherDeadline}>
                    <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.textSecondary} />
                    <ThemedText type="small" style={{ marginLeft: Spacing.xs, color: theme.textSecondary }}>
                      Προθεσμία: {deadlineDate} στις 12:00μ.μ.
                    </ThemedText>
                  </View>
                  
                  {canComplete ? (
                    <Pressable
                      style={[
                        styles.voucherButton,
                        { backgroundColor: theme.primary, opacity: completeVoucherMutation.isPending ? 0.6 : 1 },
                      ]}
                      onPress={handleCompleteVoucher}
                      disabled={completeVoucherMutation.isPending}
                    >
                      {completeVoucherMutation.isPending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <>
                          <MaterialCommunityIcons name="check" size={18} color="#fff" />
                          <Text style={styles.voucherButtonText}>Δήλωσα Ανάρτηση Voucher</Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                  
                  {voucherStatus === "verified" ? (
                    <ThemedText type="small" style={{ color: theme.success, textAlign: "center" }}>
                      Η ανάρτηση έχει επιβεβαιωθεί. Η εξέταση θα διεξαχθεί κανονικά.
                    </ThemedText>
                  ) : null}
                  
                  {voucherStatus === "user_completed" ? (
                    <ThemedText type="small" style={{ color: theme.info, textAlign: "center" }}>
                      Η δήλωσή σας αναμένει επιβεβαίωση από τον διαχειριστή.
                    </ThemedText>
                  ) : null}
                </>
              );
            })()}
          </Card>
        ) : null}

        {booking.notes ? (
          <Card elevation={1} style={styles.notesCard}>
            <ThemedText type="h4">Σημειώσεις Χρήστη</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {booking.notes}
            </ThemedText>
          </Card>
        ) : null}

        {booking.adminNotes ? (
          <Card elevation={1} style={StyleSheet.flatten([styles.notesCard, { borderLeftColor: statusColor, borderLeftWidth: 4 }])}>
            <ThemedText type="h4">Σημειώσεις Διαχειριστή</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {booking.adminNotes}
            </ThemedText>
          </Card>
        ) : null}

        <Card elevation={1} style={styles.timestampCard}>
          <View style={styles.timestampRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Δημιουργήθηκε:</ThemedText>
            <ThemedText type="small">
              {new Date(booking.createdAt).toLocaleString("el-GR")}
            </ThemedText>
          </View>
          <View style={styles.timestampRow}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>Τελευταία Ενημέρωση:</ThemedText>
            <ThemedText type="small">
              {new Date(booking.updatedAt).toLocaleString("el-GR")}
            </ThemedText>
          </View>
        </Card>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  detailsCard: {
    gap: Spacing.lg,
  },
  detailRow: {
    gap: Spacing.xs,
  },
  detailLabel: {
    flexDirection: "row",
    alignItems: "center",
  },
  notesCard: {
    gap: Spacing.sm,
  },
  timestampCard: {
    gap: Spacing.sm,
  },
  timestampRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  voucherCard: {
    gap: Spacing.md,
  },
  voucherHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  voucherStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    alignSelf: "flex-start",
  },
  voucherStatusText: {
    marginLeft: Spacing.sm,
    fontWeight: "600",
    fontSize: 14,
  },
  voucherDeadline: {
    flexDirection: "row",
    alignItems: "center",
  },
  voucherButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  voucherButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});
