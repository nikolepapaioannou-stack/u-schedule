import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { useAuthenticatedFetch } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";

interface ClosedDate {
  id: string;
  date: string;
  reason?: string;
  createdAt: string;
}

interface DayBookings {
  date: string;
  count: number;
  shifts: { morning: number; midday: number; afternoon: number };
}

interface BookingDetail {
  id: string;
  departmentId: string;
  candidateCount: number;
  examStartHour: number | null;
  preferredShift: string;
  bookingDate: string;
  status: string;
  user: { email: string; ugrId: string } | null;
}

const WEEKDAYS = ["Κυ", "Δε", "Τρ", "Τε", "Πε", "Πα", "Σα"];
const MONTHS = [
  "Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος",
  "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"
];

export default function CalendarScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const authFetch = useAuthenticatedFetch();

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [closedDates, setClosedDates] = useState<ClosedDate[]>([]);
  const [dayBookings, setDayBookings] = useState<DayBookings[]>([]);
  const [allBookings, setAllBookings] = useState<BookingDetail[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCalendarData = useCallback(async () => {
    try {
      const [closedData, bookingsData] = await Promise.all([
        authFetch("/api/closed-dates"),
        authFetch("/api/admin/bookings"),
      ]);

      setClosedDates(closedData || []);
      setAllBookings(bookingsData || []);

      const bookingsByDate: Record<string, DayBookings> = {};
      (bookingsData || []).forEach((b: any) => {
        if (!bookingsByDate[b.bookingDate]) {
          bookingsByDate[b.bookingDate] = {
            date: b.bookingDate,
            count: 0,
            shifts: { morning: 0, midday: 0, afternoon: 0 },
          };
        }
        bookingsByDate[b.bookingDate].count += b.candidateCount;
        if (b.preferredShift in bookingsByDate[b.bookingDate].shifts) {
          bookingsByDate[b.bookingDate].shifts[b.preferredShift as keyof typeof bookingsByDate[string]["shifts"]] += b.candidateCount;
        }
      });
      setDayBookings(Object.values(bookingsByDate));
    } catch (error) {
      console.error("Failed to fetch calendar data:", error);
    } finally {
      setIsLoading(false);
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

  const handleAddClosedDate = () => {
    if (!selectedDate) {
      Alert.alert("Επιλογή", "Επιλέξτε πρώτα μια ημερομηνία από το ημερολόγιο");
      return;
    }

    Alert.prompt(
      "Κλείσιμο Ημερομηνίας",
      `Λόγος κλεισίματος για ${new Date(selectedDate).toLocaleDateString("el-GR")}:`,
      [
        { text: "Ακύρωση", style: "cancel" },
        {
          text: "Κλείσιμο",
          onPress: async (reason?: string) => {
            try {
              await authFetch("/api/closed-dates", {
                method: "POST",
                body: JSON.stringify({ date: selectedDate, reason }),
              });
              fetchCalendarData();
              setSelectedDate(null);
              Alert.alert("Επιτυχία", "Η ημερομηνία έκλεισε");
            } catch (err: any) {
              Alert.alert("Σφάλμα", err.message || "Αποτυχία κλεισίματος");
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const handleRemoveClosedDate = (closedDate: ClosedDate) => {
    Alert.alert(
      "Άνοιγμα Ημερομηνίας",
      `Θέλετε να ανοίξετε ξανά την ${new Date(closedDate.date).toLocaleDateString("el-GR")};`,
      [
        { text: "Ακύρωση", style: "cancel" },
        {
          text: "Άνοιγμα",
          onPress: async () => {
            try {
              await authFetch(`/api/closed-dates/${closedDate.id}`, { method: "DELETE" });
              fetchCalendarData();
              Alert.alert("Επιτυχία", "Η ημερομηνία άνοιξε");
            } catch (err: any) {
              Alert.alert("Σφάλμα", err.message || "Αποτυχία ανοίγματος");
            }
          },
        },
      ]
    );
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

  const getBookingsForDate = (dateStr: string) => {
    return dayBookings.find((b) => b.date === dateStr);
  };

  const getApprovedBookingsForDate = (dateStr: string): BookingDetail[] => {
    return allBookings.filter(b => b.bookingDate === dateStr && b.status === 'approved');
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
              const bookings = getBookingsForDate(dateStr);
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === new Date().toISOString().split("T")[0];

              return (
                <Pressable
                  key={dayIndex}
                  style={[
                    styles.dayCell,
                    isSelected && { backgroundColor: theme.primary + "20" },
                    isToday && { borderWidth: 2, borderColor: theme.primary },
                    isClosed && { backgroundColor: theme.error + "20" },
                  ]}
                  onPress={() => setSelectedDate(dateStr)}
                >
                  <ThemedText
                    type="body"
                    style={[
                      { textAlign: "center" },
                      isClosed && { color: theme.error, textDecorationLine: "line-through" },
                    ]}
                  >
                    {day}
                  </ThemedText>
                  {bookings ? (
                    <View style={[styles.bookingDot, { backgroundColor: theme.success }]}>
                      <ThemedText type="caption" style={{ color: "#fff", fontSize: 10 }}>
                        {bookings.count}
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

  const renderClosedDatesList = () => {
    const upcoming = closedDates
      .filter((c) => new Date(c.date) >= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (upcoming.length === 0) return null;

    return (
      <View style={styles.closedDatesSection}>
        <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>Κλειστές Ημερομηνίες</ThemedText>
        {upcoming.map((closedDate) => (
          <Pressable
            key={closedDate.id}
            style={[styles.closedDateItem, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => handleRemoveClosedDate(closedDate)}
          >
            <View style={styles.closedDateInfo}>
              <MaterialCommunityIcons name="close-circle-outline" size={16} color={theme.error} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {new Date(closedDate.date).toLocaleDateString("el-GR")}
              </ThemedText>
              {closedDate.reason ? (
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                  - {closedDate.reason}
                </ThemedText>
              ) : null}
            </View>
            <MaterialCommunityIcons name="delete-outline" size={16} color={theme.textSecondary} />
          </Pressable>
        ))}
      </View>
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
            <HeaderTitle title="Ημερολόγιο" />
            
            <Card elevation={1} style={styles.calendarCard}>
              {renderCalendarHeader()}
              {renderWeekDays()}
              {renderCalendarDays()}
            </Card>

            {selectedDate ? (
              <Card elevation={1} style={styles.selectedDateCard}>
                <ThemedText type="h4">
                  {new Date(selectedDate).toLocaleDateString("el-GR", { 
                    weekday: "long", 
                    day: "numeric", 
                    month: "long" 
                  })}
                </ThemedText>
                {isClosedDate(selectedDate) ? (
                  <View style={styles.closedBadge}>
                    <MaterialCommunityIcons name="close-circle-outline" size={16} color={theme.error} />
                    <ThemedText type="body" style={{ color: theme.error, marginLeft: Spacing.xs }}>
                      Κλειστό
                    </ThemedText>
                  </View>
                ) : (
                  <Button onPress={handleAddClosedDate} style={{ marginTop: Spacing.md }}>
                    Κλείσιμο Ημερομηνίας
                  </Button>
                )}
                
                {(() => {
                  const approvedBookings = getApprovedBookingsForDate(selectedDate);
                  if (approvedBookings.length === 0) return null;
                  return (
                    <View style={styles.approvedBookingsSection}>
                      <ThemedText type="h4" style={{ marginBottom: Spacing.sm }}>
                        Εγκεκριμένες Κρατήσεις ({approvedBookings.length})
                      </ThemedText>
                      {approvedBookings.map((booking) => (
                        <View 
                          key={booking.id} 
                          style={[styles.bookingItem, { backgroundColor: theme.backgroundSecondary }]}
                        >
                          <View style={styles.bookingRow}>
                            <ThemedText type="caption" style={{ color: theme.textSecondary }}>UGR:</ThemedText>
                            <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>
                              {booking.user?.ugrId || "-"}
                            </ThemedText>
                          </View>
                          <View style={styles.bookingRow}>
                            <ThemedText type="caption" style={{ color: theme.textSecondary }}>Ώρα:</ThemedText>
                            <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>
                              {formatExamTime(booking.examStartHour)}
                            </ThemedText>
                          </View>
                          <View style={styles.bookingRow}>
                            <ThemedText type="caption" style={{ color: theme.textSecondary }}>Τμήμα:</ThemedText>
                            <ThemedText type="body" style={{ marginLeft: Spacing.xs }}>
                              {booking.departmentId}
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
                  );
                })()}
              </Card>
            ) : null}

            {renderClosedDatesList()}
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
  selectedDateCard: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  closedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  closedDatesSection: {
    marginTop: Spacing.xl,
  },
  closedDateItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  closedDateInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  approvedBookingsSection: {
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
