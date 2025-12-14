import React, { useState } from "react";
import { StyleSheet, View, Pressable, Platform } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { useAuthenticatedFetch } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const SHIFTS = [
  { id: "morning", label: "Πρωί", time: "08:00-12:00" },
  { id: "midday", label: "Μεσημέρι", time: "12:00-16:00" },
  { id: "afternoon", label: "Απόγευμα", time: "16:00-19:00" },
];

export default function SearchScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const authFetch = useAuthenticatedFetch();

  const [departmentId, setDepartmentId] = useState("");
  const [candidateCount, setCandidateCount] = useState("");
  const [courseEndDate, setCourseEndDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [preferredShift, setPreferredShift] = useState("morning");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("el-GR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  async function handleSearch() {
    if (!departmentId || !candidateCount) {
      setError("Συμπληρώστε όλα τα υποχρεωτικά πεδία");
      return;
    }

    const count = parseInt(candidateCount);
    if (isNaN(count) || count < 1 || count > 50) {
      setError("Ο αριθμός υποψηφίων πρέπει να είναι μεταξύ 1 και 50");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await authFetch("/api/slots/search", {
        method: "POST",
        body: JSON.stringify({
          departmentId,
          candidateCount: count,
          courseEndDate: courseEndDate.toISOString().split("T")[0],
          preferredShift,
        }),
      });

      navigation.navigate("AvailableSlots", {
        departmentId,
        candidateCount: count,
        courseEndDate: courseEndDate.toISOString().split("T")[0],
        preferredShift,
      });
    } catch (err: any) {
      setError(err.message || "Σφάλμα αναζήτησης");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
      >
        <HeaderTitle showLogo subtitle="Αναζήτηση Διαθέσιμων Θέσεων" />

        <Card variant="glass" style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="information-outline" size={20} color={theme.primary} />
            <ThemedText type="small" style={{ flex: 1, marginLeft: Spacing.md, color: theme.textSecondary }}>
              Η πρώτη διαθέσιμη ημερομηνία εξέτασης είναι 6 εργάσιμες μέρες μετά τη λήξη των μαθημάτων κατάρτισης.
            </ThemedText>
          </View>
        </Card>

        <View style={styles.formContainer}>
          {error ? (
            <View style={[styles.errorContainer, { backgroundColor: theme.error + "20" }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.error} />
              <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.sm, flex: 1 }}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          <TextInput
            label="Κωδικός Τμήματος *"
            value={departmentId}
            onChangeText={setDepartmentId}
            placeholder="π.χ. 75006"
            keyboardType="numeric"
          />

          <TextInput
            label="Αριθμός Υποψηφίων *"
            value={candidateCount}
            onChangeText={setCandidateCount}
            placeholder="1-50"
            keyboardType="numeric"
          />

          <View style={styles.dateContainer}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
              Ημερομηνία Λήξης Μαθημάτων *
            </ThemedText>
            <Pressable
              style={[styles.dateButton, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialCommunityIcons name="calendar-outline" size={20} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.md }}>
                {formatDate(courseEndDate)}
              </ThemedText>
            </Pressable>
          </View>

          {showDatePicker ? (
            <DateTimePicker
              value={courseEndDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => {
                setShowDatePicker(Platform.OS === "ios");
                if (selectedDate) {
                  setCourseEndDate(selectedDate);
                }
              }}
            />
          ) : null}

          <View style={styles.shiftContainer}>
            <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
              Προτιμώμενη Βάρδια
            </ThemedText>
            <View style={styles.shiftButtons}>
              {SHIFTS.map((shift) => (
                <Pressable
                  key={shift.id}
                  style={[
                    styles.shiftButton,
                    {
                      backgroundColor:
                        preferredShift === shift.id ? theme.primary : theme.backgroundDefault,
                      borderColor: preferredShift === shift.id ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setPreferredShift(shift.id)}
                >
                  <ThemedText
                    type="small"
                    style={{
                      color: preferredShift === shift.id ? "#FFFFFF" : theme.text,
                      fontWeight: "600",
                    }}
                  >
                    {shift.label}
                  </ThemedText>
                  <ThemedText
                    type="caption"
                    style={{
                      color: preferredShift === shift.id ? "#FFFFFF" : theme.textSecondary,
                      marginTop: 2,
                    }}
                  >
                    {shift.time}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <Button onPress={handleSearch} disabled={isLoading}>
            {isLoading ? "Αναζήτηση..." : "Εύρεση Διαθέσιμων Θέσεων"}
          </Button>
        </View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
  },
  infoCard: {
    marginBottom: Spacing.xl,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  formContainer: {
    gap: Spacing.lg,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  label: {
    marginBottom: Spacing.xs,
  },
  dateContainer: {
    gap: Spacing.xs,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
  },
  shiftContainer: {
    gap: Spacing.xs,
  },
  shiftButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  shiftButton: {
    flex: 1,
    padding: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
});
