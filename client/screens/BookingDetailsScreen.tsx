import React, { useState, useEffect } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuthenticatedFetch } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
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

  const { bookingId } = route.params;

  const [booking, setBooking] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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
        <Feather name="alert-circle" size={48} color={theme.textSecondary} />
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
          <Feather name={statusConfig.icon as any} size={24} color={statusColor} />
          <ThemedText type="h4" style={{ color: statusColor, marginLeft: Spacing.md }}>
            {statusConfig.label}
          </ThemedText>
        </View>

        <Card elevation={1} style={styles.detailsCard}>
          <ThemedText type="h3">Στοιχεία Κράτησης</ThemedText>

          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Feather name="hash" size={18} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                Κωδικός Τμήματος
              </ThemedText>
            </View>
            <ThemedText type="h4">{booking.departmentId}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Feather name="calendar" size={18} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                Ημερομηνία Εξέτασης
              </ThemedText>
            </View>
            <ThemedText type="body">{formatDate(booking.bookingDate)}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Feather name="clock" size={18} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                Βάρδια
              </ThemedText>
            </View>
            <ThemedText type="body">
              {SHIFT_LABELS[booking.preferredShift as keyof typeof SHIFT_LABELS] || booking.preferredShift}
            </ThemedText>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailLabel}>
              <Feather name="users" size={18} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                Αριθμός Υποψηφίων
              </ThemedText>
            </View>
            <ThemedText type="body">{booking.candidateCount}</ThemedText>
          </View>

          {booking.confirmationNumber ? (
            <View style={styles.detailRow}>
              <View style={styles.detailLabel}>
                <Feather name="file-text" size={18} color={theme.textSecondary} />
                <ThemedText type="body" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                  Αριθμός Επιβεβαίωσης
                </ThemedText>
              </View>
              <ThemedText type="body" style={{ fontWeight: "600" }}>{booking.confirmationNumber}</ThemedText>
            </View>
          ) : null}
        </Card>

        {booking.notes ? (
          <Card elevation={1} style={styles.notesCard}>
            <ThemedText type="h4">Σημειώσεις Χρήστη</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              {booking.notes}
            </ThemedText>
          </Card>
        ) : null}

        {booking.adminNotes ? (
          <Card elevation={1} style={[styles.notesCard, { borderLeftColor: statusColor, borderLeftWidth: 4 }]}>
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
});
