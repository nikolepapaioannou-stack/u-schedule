import React, { useState, useEffect } from "react";
import { StyleSheet, View, ActivityIndicator, Pressable, Platform, Text, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
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
  const [history, setHistory] = useState<any[]>([]);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const completeVoucherMutation = useMutation({
    mutationFn: () =>
      authFetch(`/api/bookings/${bookingId}/external-action/complete`, {
        method: "POST",
      }),
    onSuccess: (updatedBooking) => {
      setBooking((prev: any) => ({ ...prev, externalActionStatus: "user_completed" }));
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/external-actions/pending"] });
      if (historyExpanded) {
        fetchHistory(true);
      }
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

  async function fetchHistory(forceRefresh = false) {
    if (isLoadingHistory) return;
    if (!forceRefresh && history.length > 0) return;
    setIsLoadingHistory(true);
    try {
      const data = await authFetch(`/api/bookings/${bookingId}/history`);
      setHistory(data);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }

  const toggleHistory = () => {
    if (!historyExpanded) {
      fetchHistory();
    }
    setHistoryExpanded(!historyExpanded);
  };

  const getEventIcon = (eventType: string): string => {
    const icons: Record<string, string> = {
      created: "plus-circle",
      submitted: "send",
      approved: "check-circle",
      rejected: "x-circle",
      cancelled: "slash",
      hold_expired: "clock",
      voucher_warning_sent: "bell",
      voucher_deadline_warning_sent: "alert-triangle",
      voucher_user_completed: "check",
      voucher_verified: "check-circle",
      voucher_rejected: "x-circle",
      voucher_auto_cancelled: "alert-circle",
      voucher_admin_completed: "shield-check",
      admin_note_added: "edit-3",
      status_changed: "refresh-cw",
    };
    return icons[eventType] || "activity";
  };

  const getEventColor = (eventType: string): string => {
    if (eventType.includes("approved") || eventType.includes("verified") || eventType.includes("completed")) {
      return theme.success;
    }
    if (eventType.includes("rejected") || eventType.includes("cancelled")) {
      return theme.error;
    }
    if (eventType.includes("warning")) {
      return theme.warning;
    }
    return theme.primary;
  };

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

        <Card elevation={1} style={styles.historyCard}>
          <Pressable onPress={toggleHistory} style={styles.historyHeader}>
            <View style={styles.historyHeaderLeft}>
              <Feather name="clock" size={18} color={theme.primary} />
              <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Ιστορικό Κράτησης</ThemedText>
            </View>
            <Feather 
              name={historyExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={theme.textSecondary} 
            />
          </Pressable>
          
          {historyExpanded ? (
            <View style={styles.historyContent}>
              {isLoadingHistory ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : history.length === 0 ? (
                <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center" }}>
                  Δεν υπάρχει ιστορικό
                </ThemedText>
              ) : (
                history.map((entry, index) => (
                  <View 
                    key={entry.id} 
                    style={[
                      styles.historyEntry,
                      index < history.length - 1 && styles.historyEntryBorder
                    ]}
                  >
                    <View style={[styles.historyIcon, { backgroundColor: getEventColor(entry.eventType) + "20" }]}>
                      <Feather 
                        name={getEventIcon(entry.eventType) as any} 
                        size={14} 
                        color={getEventColor(entry.eventType)} 
                      />
                    </View>
                    <View style={styles.historyDetails}>
                      <ThemedText type="small" style={{ fontWeight: "600" }}>
                        {entry.description}
                      </ThemedText>
                      <View style={styles.historyMeta}>
                        <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>
                          {new Date(entry.createdAt).toLocaleString("el-GR")}
                        </ThemedText>
                        {entry.performerName ? (
                          <ThemedText type="small" style={{ color: theme.textSecondary, fontSize: 11 }}>
                            {" "}· {entry.performerName}
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </Card>

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
  historyCard: {
    gap: Spacing.sm,
  },
  historyHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  historyContent: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  historyEntry: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
  },
  historyEntryBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128, 128, 128, 0.2)",
  },
  historyIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  historyDetails: {
    flex: 1,
    gap: 2,
  },
  historyMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
