import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { useAuthenticatedFetch } from "@/lib/auth";
import { useBookingWebSocket } from "@/lib/websocket";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface PendingBooking {
  id: string;
  departmentId: string;
  candidateCount: number;
  bookingDate: string;
  preferredShift: string;
  examStartHour?: number | null;
  notes?: string;
  createdAt: string;
  user?: {
    email: string;
    ugrId: string;
  };
}

const SHIFT_LABELS = {
  morning: "Πρωί",
  midday: "Μεσημέρι",
  afternoon: "Απόγευμα",
};

export default function PendingApprovalsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const authFetch = useAuthenticatedFetch();

  const [bookings, setBookings] = useState<PendingBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  const fetchPendingBookings = useCallback(async () => {
    try {
      const allBookings = await authFetch("/api/admin/bookings");
      const pending = allBookings.filter((b: any) => b.status === "pending");
      setBookings(pending);
    } catch (error) {
      console.error("Failed to fetch pending bookings:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      fetchPendingBookings();
    }, [fetchPendingBookings])
  );

  useBookingWebSocket(
    useCallback((event) => {
      if (event.type === 'booking:submitted') {
        console.log('[PendingApprovals] New booking submitted, refreshing...');
        fetchPendingBookings();
      }
    }, [fetchPendingBookings])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPendingBookings();
  };

  const handleApprove = async (bookingId: string) => {
    setProcessingIds((prev) => new Set(prev).add(bookingId));
    try {
      await authFetch(`/api/admin/bookings/${bookingId}/approve`, { method: "PUT" });
      setBookings((prev) => prev.filter((b) => b.id !== bookingId));
      Alert.alert("Επιτυχία", "Η κράτηση εγκρίθηκε");
    } catch (err: any) {
      Alert.alert("Σφάλμα", err.message || "Αποτυχία έγκρισης");
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(bookingId);
        return next;
      });
    }
  };

  const handleReject = (bookingId: string) => {
    Alert.prompt(
      "Απόρριψη Κράτησης",
      "Προσθέστε σχόλιο για τον λόγο απόρριψης (προαιρετικά):",
      [
        { text: "Ακύρωση", style: "cancel" },
        {
          text: "Απόρριψη",
          style: "destructive",
          onPress: async (reason?: string) => {
            setProcessingIds((prev) => new Set(prev).add(bookingId));
            try {
              await authFetch(`/api/admin/bookings/${bookingId}/reject`, {
                method: "PUT",
                body: JSON.stringify({ reason }),
              });
              setBookings((prev) => prev.filter((b) => b.id !== bookingId));
              Alert.alert("Επιτυχία", "Η κράτηση απορρίφθηκε");
            } catch (err: any) {
              Alert.alert("Σφάλμα", err.message || "Αποτυχία απόρριψης");
            } finally {
              setProcessingIds((prev) => {
                const next = new Set(prev);
                next.delete(bookingId);
                return next;
              });
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("el-GR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("el-GR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderBookingItem = ({ item }: { item: PendingBooking }) => {
    const isProcessing = processingIds.has(item.id);

    return (
      <Card elevation={1} style={styles.bookingCard}>
        <View style={styles.cardHeader}>
          <View>
            <ThemedText type="h4">Τμήμα {item.departmentId}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary }}>
              Υποβλήθηκε: {formatTime(item.createdAt)}
            </ThemedText>
          </View>
          <View style={[styles.countBadge, { backgroundColor: theme.primary + "20" }]}>
            <ThemedText type="h3" style={{ color: theme.primary }}>{item.candidateCount}</ThemedText>
            <ThemedText type="caption" style={{ color: theme.primary }}>υποψ.</ThemedText>
          </View>
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="calendar-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              {formatDate(item.bookingDate)}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              {SHIFT_LABELS[item.preferredShift as keyof typeof SHIFT_LABELS] || item.preferredShift}
              {item.examStartHour !== null && item.examStartHour !== undefined 
                ? ` - ${item.examStartHour.toString().padStart(2, "0")}:00` 
                : null}
            </ThemedText>
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              Κέντρο: {item.user?.ugrId || "Μη διαθέσιμο"}
            </ThemedText>
          </View>

          {item.notes ? (
            <View style={[styles.notesContainer, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText type="caption" style={{ color: theme.textSecondary }}>Σημειώσεις:</ThemedText>
              <ThemedText type="small">{item.notes}</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.actionButtons}>
          <Button
            onPress={() => handleApprove(item.id)}
            disabled={isProcessing}
            style={[styles.actionButton, { backgroundColor: theme.success }]}
          >
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="check" size={18} color="#fff" />
              <ThemedText type="body" style={{ color: "#fff", marginLeft: Spacing.xs }}>
                {isProcessing ? "..." : "Έγκριση"}
              </ThemedText>
            </View>
          </Button>
          <Button
            onPress={() => handleReject(item.id)}
            disabled={isProcessing}
            style={[styles.actionButton, { backgroundColor: theme.error }]}
          >
            <View style={styles.buttonContent}>
              <MaterialCommunityIcons name="close" size={18} color="#fff" />
              <ThemedText type="body" style={{ color: "#fff", marginLeft: Spacing.xs }}>
                Απόρριψη
              </ThemedText>
            </View>
          </Button>
        </View>
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <MaterialCommunityIcons name="check-circle-outline" size={48} color={theme.success} />
      </View>
      <ThemedText type="h3" style={{ marginTop: Spacing.xl, textAlign: "center" }}>
        Όλες οι κρατήσεις επεξεργάστηκαν
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
        Δεν υπάρχουν εκκρεμείς κρατήσεις προς έγκριση
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBookingItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
          bookings.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <HeaderTitle title="Εκκρεμείς Εγκρίσεις" />
            {bookings.length > 0 ? (
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
                {bookings.length} κρατήσεις αναμένουν έγκριση
              </ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
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
  header: {
    marginBottom: Spacing.xl,
  },
  bookingCard: {
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  countBadge: {
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  cardBody: {
    gap: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  notesContainer: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
