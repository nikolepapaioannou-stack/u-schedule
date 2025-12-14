import React, { useState, useEffect } from "react";
import { StyleSheet, View, FlatList, RefreshControl, ActivityIndicator, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuthenticatedFetch } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "AvailableSlots">;
type RoutePropType = RouteProp<RootStackParamList, "AvailableSlots">;

interface HourlySlot {
  hour: number;
  effectiveCapacity: number;
  bookedCandidates: number;
  availableCapacity: number;
}

interface Slot {
  date: string;
  shiftId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  availableCapacity: number;
  priority: number;
  isSplit: boolean;
  hourlySlots: HourlySlot[];
}

const PRIORITY_CONFIG = {
  1: { label: "Ιδανική Επιλογή", color: "success", badge: "Καλύτερη Επιλογή" },
  2: { label: "Εναλλακτική Βάρδια", color: "primary", badge: "Πλήρες Τμήμα" },
  3: { label: "Απαιτείται Διαχωρισμός", color: "warning", badge: "Διαχωρισμός" },
} as const;

const SHIFT_LABELS = {
  morning: "Πρωί",
  midday: "Μεσημέρι",
  afternoon: "Απόγευμα",
};

export default function AvailableSlotsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const authFetch = useAuthenticatedFetch();

  const { departmentId, candidateCount, courseEndDate, preferredShift } = route.params;

  const [slots, setSlots] = useState<Slot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isBooking, setIsBooking] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [selectedHour, setSelectedHour] = useState<{ slotKey: string; hour: number } | null>(null);

  useEffect(() => {
    fetchSlots();
  }, []);

  async function fetchSlots() {
    try {
      const result = await authFetch("/api/slots/search", {
        method: "POST",
        body: JSON.stringify({ departmentId, candidateCount, courseEndDate, preferredShift }),
      });
      setSlots(result.slots);
      setError("");
    } catch (err: any) {
      setError(err.message || "Σφάλμα φόρτωσης");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  async function handleHoldSlot(slot: Slot, examStartHour: number) {
    const slotKey = slot.shiftId + slot.date;
    setIsBooking(slotKey);
    try {
      const booking = await authFetch("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          departmentId,
          candidateCount,
          courseEndDate,
          preferredShift,
          bookingDate: slot.date,
          shiftId: slot.shiftId,
          examStartHour,
          isSplit: slot.isSplit,
        }),
      });

      navigation.replace("HoldCountdown", { bookingId: booking.id });
    } catch (err: any) {
      setError(err.message || "Σφάλμα κράτησης");
    } finally {
      setIsBooking(null);
    }
  }

  function toggleSlotExpansion(slotKey: string) {
    if (expandedSlot === slotKey) {
      setExpandedSlot(null);
      setSelectedHour(null);
    } else {
      setExpandedSlot(slotKey);
      setSelectedHour(null);
    }
  }

  function selectHour(slotKey: string, hour: number) {
    setSelectedHour({ slotKey, hour });
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("el-GR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    });
  };

  const renderSlotItem = ({ item }: { item: Slot }) => {
    const config = PRIORITY_CONFIG[item.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG[3];
    const priorityColor = theme[config.color as keyof typeof theme] as string;
    const slotKey = item.shiftId + item.date;
    const isCurrentBooking = isBooking === slotKey;
    const isExpanded = expandedSlot === slotKey;
    const currentSelectedHour = selectedHour?.slotKey === slotKey ? selectedHour.hour : null;

    return (
      <Card elevation={1} style={{ ...styles.slotCard, borderLeftColor: priorityColor, borderLeftWidth: 4 }}>
        <Pressable onPress={() => toggleSlotExpansion(slotKey)}>
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <ThemedText type="h4">{formatDate(item.date)}</ThemedText>
              <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                {SHIFT_LABELS[item.shiftName as keyof typeof SHIFT_LABELS]} ({item.startTime} - {item.endTime})
              </ThemedText>
            </View>
            <View style={styles.headerRight}>
              <View style={[styles.badge, { backgroundColor: priorityColor + "20" }]}>
                <ThemedText type="caption" style={{ color: priorityColor, fontWeight: "600" }}>
                  {config.badge}
                </ThemedText>
              </View>
              <MaterialCommunityIcons 
                name={isExpanded ? "chevron-up" : "chevron-down"} 
                size={24} 
                color={theme.textSecondary} 
              />
            </View>
          </View>
        </Pressable>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
              {(item.hourlySlots ?? []).length} διαθέσιμες ώρες
            </ThemedText>
          </View>

          {item.isSplit ? (
            <View style={[styles.warningBox, { backgroundColor: theme.warning + "20" }]}>
              <MaterialCommunityIcons name="alert-outline" size={16} color={theme.warning} />
              <ThemedText type="small" style={{ marginLeft: Spacing.sm, color: theme.warning, flex: 1 }}>
                Το τμήμα θα χρειαστεί να χωριστεί σε πολλαπλές θέσεις
              </ThemedText>
            </View>
          ) : null}
        </View>

        {isExpanded ? (
          <View style={styles.hourlyContainer}>
            <ThemedText type="small" style={[styles.hourlyLabel, { color: theme.textSecondary }]}>
              Επιλέξτε ώρα έναρξης εξέτασης:
            </ThemedText>
            <View style={styles.hourlyGrid}>
              {(item.hourlySlots ?? []).map((hourSlot) => {
                const isSelected = currentSelectedHour === hourSlot.hour;
                const hasCapacity = hourSlot.availableCapacity >= candidateCount;
                
                return (
                  <Pressable
                    key={hourSlot.hour}
                    style={[
                      styles.hourButton,
                      {
                        backgroundColor: isSelected 
                          ? theme.primary 
                          : hasCapacity 
                            ? theme.backgroundDefault 
                            : theme.backgroundSecondary,
                        borderColor: isSelected 
                          ? theme.primary 
                          : hasCapacity 
                            ? theme.border 
                            : theme.border,
                        opacity: hasCapacity ? 1 : 0.5,
                      },
                    ]}
                    onPress={() => hasCapacity && selectHour(slotKey, hourSlot.hour)}
                    disabled={!hasCapacity}
                  >
                    <ThemedText
                      type="body"
                      style={{
                        color: isSelected ? "#FFFFFF" : theme.text,
                        fontWeight: "600",
                      }}
                    >
                      {hourSlot.hour.toString().padStart(2, "0")}:00
                    </ThemedText>
                    <ThemedText
                      type="caption"
                      style={{
                        color: isSelected ? "#FFFFFF" : theme.textSecondary,
                      }}
                    >
                      {hourSlot.availableCapacity} θέσεις
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            
            {currentSelectedHour !== null ? (
              <Button
                onPress={() => handleHoldSlot(item, currentSelectedHour)}
                disabled={isCurrentBooking}
                style={{ marginTop: Spacing.md }}
              >
                {isCurrentBooking ? "Κράτηση..." : `Κράτηση στις ${currentSelectedHour.toString().padStart(2, "0")}:00`}
              </Button>
            ) : (
              <View style={[styles.selectHourHint, { backgroundColor: theme.backgroundSecondary }]}>
                <MaterialCommunityIcons name="gesture-tap" size={16} color={theme.textSecondary} />
                <ThemedText type="small" style={{ marginLeft: Spacing.sm, color: theme.textSecondary }}>
                  Πατήστε σε μια ώρα για να συνεχίσετε
                </ThemedText>
              </View>
            )}
          </View>
        ) : null}
      </Card>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
        <MaterialCommunityIcons name="calendar-outline" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText type="h3" style={{ marginTop: Spacing.xl, textAlign: "center" }}>
        Δεν βρέθηκαν διαθέσιμες θέσεις
      </ThemedText>
      <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.sm }}>
        Δοκιμάστε διαφορετικές παραμέτρους αναζήτησης
      </ThemedText>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText type="body" style={{ marginTop: Spacing.lg, color: theme.textSecondary }}>
          Αναζήτηση διαθέσιμων θέσεων...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {error ? (
        <View style={[styles.errorBanner, { backgroundColor: theme.error + "20" }]}>
          <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.error} />
          <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.sm, flex: 1 }}>
            {error}
          </ThemedText>
        </View>
      ) : null}

      <FlatList
        data={slots}
        keyExtractor={(item) => item.date + item.shiftId}
        renderItem={renderSlotItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
          slots.length === 0 && styles.emptyListContent,
        ]}
        ListHeaderComponent={
          <Card elevation={1} style={styles.summaryCard}>
            <ThemedText type="h4">Αναζήτηση για:</ThemedText>
            <View style={styles.summaryRow}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>Τμήμα:</ThemedText>
              <ThemedText type="body">{departmentId}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>Υποψήφιοι:</ThemedText>
              <ThemedText type="body">{candidateCount}</ThemedText>
            </View>
          </Card>
        }
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              fetchSlots();
            }}
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
  centerContent: {
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
  },
  emptyListContent: {
    flex: 1,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    marginHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
  },
  summaryCard: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  slotCard: {
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  badge: {
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
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  hourlyContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  hourlyLabel: {
    marginBottom: Spacing.sm,
  },
  hourlyGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  hourButton: {
    width: "30%",
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  selectHourHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
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
