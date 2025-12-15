import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { useAuthenticatedFetch } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ClosedDate {
  id: string;
  date: string;
  reason?: string;
}

interface ApprovedBooking {
  id: string;
  bookingDate: string;
  departmentId: string;
  examStartHour: number | null;
  candidateCount: number;
  preferredShift: string;
}

const WEEKDAYS = ["Κυ", "Δε", "Τρ", "Τε", "Πε", "Πα", "Σα"];
const MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"
];

export default function UserExamCalendarScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const authFetch = useAuthenticatedFetch();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);
  const [approvedBookings, setApprovedBookings] = useState<ApprovedBooking[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCalendarData = useCallback(async () => {
    try {
      const [closedData, bookingsData] = await Promise.all([
        authFetch("/api/closed-dates"),
        authFetch("/api/approved-bookings"),
      ]);
      setClosedDates(closedData || []);
      setApprovedBookings(bookingsData || []);
    } catch (error) {
      console.error("Failed to fetch calendar data:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      fetchCalendarData();
    }, [fetchCalendarData])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchCalendarData();
  };

  const goToPrevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }
    return days;
  };

  const formatDateString = (day: number) => {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    return `${year}-${month}-${dayStr}`;
  };

  const isClosedDate = (dateStr: string) => {
    return closedDates.some((c) => c.date === dateStr);
  };

  const getBookingsForDate = (dateStr: string): ApprovedBooking[] => {
    return approvedBookings.filter((b) => b.bookingDate === dateStr);
  };

  const getBookingCount = (dateStr: string): number => {
    return getBookingsForDate(dateStr).length;
  };

  const formatExamTime = (hour: number | null): string => {
    if (hour === null) return "-";
    return `${hour.toString().padStart(2, "0")}:00`;
  };

  const renderCalendarHeader = () => (
    <View style={styles.calendarHeader}>
      <Pressable onPress={goToPrevMonth} style={styles.navButton}>
        <MaterialCommunityIcons name="chevron-left" size={24} color={theme.text} />
      </Pressable>
      <ThemedText type="h3">
        {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
      </ThemedText>
      <Pressable onPress={goToNextMonth} style={styles.navButton}>
        <MaterialCommunityIcons name="chevron-right" size={24} color={theme.text} />
      </Pressable>
    </View>
  );

  const renderWeekDays = () => (
    <View style={styles.weekDaysRow}>
      {WEEKDAYS.map((day) => (
        <View key={day} style={styles.weekDayCell}>
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>{day}</ThemedText>
        </View>
      ))}
    </View>
  );

  const renderCalendarDays = () => {
    const days = getDaysInMonth();
    const rows: (number | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }

    return (
      <View style={styles.calendarGrid}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.calendarRow}>
            {row.map((day, dayIndex) => {
              if (day === null) {
                return <View key={dayIndex} style={styles.dayCell} />;
              }

              const dateStr = formatDateString(day);
              const isClosed = isClosedDate(dateStr);
              const bookingCount = getBookingCount(dateStr);
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === new Date().toISOString().split("T")[0];

              return (
                <Pressable
                  key={dayIndex}
                  style={[
                    styles.dayCell,
                    isSelected && { backgroundColor: theme.primary + "20" },
                    isToday && { borderWidth: 2, borderColor: theme.primary },
                    isClosed && { backgroundColor: theme.error },
                  ]}
                  onPress={() => setSelectedDate(dateStr)}
                >
                  <ThemedText
                    type="body"
                    style={[
                      { textAlign: "center" },
                      isClosed && { color: "#FFFFFF", fontWeight: "600" },
                    ]}
                  >
                    {day}
                  </ThemedText>
                  {bookingCount > 0 ? (
                    <View style={[styles.bookingDot, { backgroundColor: theme.success }]}>
                      <ThemedText type="caption" style={{ color: "#fff", fontSize: 10 }}>
                        {bookingCount}
                      </ThemedText>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderSelectedDateDetails = () => {
    if (!selectedDate) return null;

    const isClosed = isClosedDate(selectedDate);
    const closedDateInfo = closedDates.find(c => c.date === selectedDate);
    const bookings = getBookingsForDate(selectedDate);

    return (
      <Card elevation={1} style={styles.selectedDateCard}>
        <ThemedText type="h4">
          {new Date(selectedDate).toLocaleDateString("el-GR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </ThemedText>

        {isClosed ? (
          <View style={styles.closedBadge}>
            <MaterialCommunityIcons name="close-circle-outline" size={16} color={theme.error} />
            <ThemedText type="body" style={{ color: theme.error, marginLeft: Spacing.xs }}>
              Κλειστό
            </ThemedText>
            {closedDateInfo?.reason ? (
              <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                - {closedDateInfo.reason}
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        {bookings.length > 0 ? (
          <View style={styles.bookingsSection}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
              Προγραμματισμένες Εξετάσεις ({bookings.length})
            </ThemedText>
            {bookings.map((booking) => (
              <View
                key={booking.id}
                style={[styles.bookingItem, { backgroundColor: theme.backgroundSecondary }]}
              >
                <View style={styles.bookingRow}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Τμήμα:</ThemedText>
                  <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>
                    {booking.departmentId}
                  </ThemedText>
                </View>
                <View style={styles.bookingRow}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Ώρα:</ThemedText>
                  <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>
                    {formatExamTime(booking.examStartHour)}
                  </ThemedText>
                </View>
                <View style={styles.bookingRow}>
                  <ThemedText type="caption" style={{ color: theme.textSecondary }}>Υποψήφιοι:</ThemedText>
                  <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>
                    {booking.candidateCount}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        ) : !isClosed ? (
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            Δεν υπάρχουν προγραμματισμένες εξετάσεις
          </ThemedText>
        ) : null}
      </Card>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={[]}
        keyExtractor={() => "calendar"}
        renderItem={null}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        ListHeaderComponent={
          <View>
            <HeaderTitle title="Ημερολόγιο Εξετάσεων" />

            <Card elevation={1} style={styles.calendarCard}>
              {renderCalendarHeader()}
              {renderWeekDays()}
              {renderCalendarDays()}
            </Card>

            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.error }]} />
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Κλειστό
                </ThemedText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.success }]} />
                <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                  Εξετάσεις
                </ThemedText>
              </View>
            </View>

            {renderSelectedDateDetails()}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
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
    paddingHorizontal: Spacing.xl,
  },
  calendarCard: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  navButton: {
    padding: Spacing.sm,
  },
  weekDaysRow: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  calendarGrid: {
    gap: Spacing.xs,
  },
  calendarRow: {
    flexDirection: "row",
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    position: "relative",
  },
  bookingDot: {
    position: "absolute",
    bottom: 2,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.xl,
    marginTop: Spacing.md,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  selectedDateCard: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  closedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    flexWrap: "wrap",
  },
  bookingsSection: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
  },
  bookingItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  bookingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
});
