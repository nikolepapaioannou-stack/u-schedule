import React, { useState, useCallback } from "react";
import { StyleSheet, View, Alert, Switch, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { HeaderTitle } from "@/components/HeaderTitle";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, useAuthenticatedFetch } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";

interface Settings {
  id: string;
  workingDaysRule: number;
  holdDurationMinutes: number;
  maxCandidatesPerDay: number;
}

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  maxCandidates: number;
  isActive: boolean;
}

export default function SettingsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const authFetch = useAuthenticatedFetch();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [workingDays, setWorkingDays] = useState("6");
  const [holdDuration, setHoldDuration] = useState("15");
  const [maxCandidates, setMaxCandidates] = useState("100");

  const fetchSettings = useCallback(async () => {
    try {
      const [settingsData, shiftsData] = await Promise.all([
        authFetch("/api/admin/settings"),
        authFetch("/api/admin/shifts"),
      ]);

      if (settingsData) {
        setSettings(settingsData);
        setWorkingDays(String(settingsData.workingDaysRule));
        setHoldDuration(String(settingsData.holdDurationMinutes));
        setMaxCandidates(String(settingsData.maxCandidatesPerDay));
      }
      setShifts(shiftsData || []);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      fetchSettings();
    }, [fetchSettings])
  );

  const handleSaveSettings = async () => {
    const workingDaysNum = parseInt(workingDays, 10);
    const holdDurationNum = parseInt(holdDuration, 10);
    const maxCandidatesNum = parseInt(maxCandidates, 10);

    if (isNaN(workingDaysNum) || workingDaysNum < 1 || workingDaysNum > 30) {
      Alert.alert("Σφάλμα", "Οι εργάσιμες ημέρες πρέπει να είναι μεταξύ 1 και 30");
      return;
    }
    if (isNaN(holdDurationNum) || holdDurationNum < 5 || holdDurationNum > 60) {
      Alert.alert("Σφάλμα", "Η διάρκεια κράτησης πρέπει να είναι μεταξύ 5 και 60 λεπτά");
      return;
    }
    if (isNaN(maxCandidatesNum) || maxCandidatesNum < 10 || maxCandidatesNum > 500) {
      Alert.alert("Σφάλμα", "Το μέγιστο υποψηφίων πρέπει να είναι μεταξύ 10 και 500");
      return;
    }

    setIsSaving(true);
    try {
      await authFetch("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          workingDaysRule: workingDaysNum,
          holdDurationMinutes: holdDurationNum,
          maxCandidatesPerDay: maxCandidatesNum,
        }),
      });
      Alert.alert("Επιτυχία", "Οι ρυθμίσεις αποθηκεύτηκαν");
    } catch (err: any) {
      Alert.alert("Σφάλμα", err.message || "Αποτυχία αποθήκευσης");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleShift = async (shift: Shift) => {
    try {
      await authFetch(`/api/admin/shifts/${shift.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: !shift.isActive }),
      });
      setShifts((prev) =>
        prev.map((s) => (s.id === shift.id ? { ...s, isActive: !s.isActive } : s))
      );
    } catch (err: any) {
      Alert.alert("Σφάλμα", err.message || "Αποτυχία ενημέρωσης");
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Αποσύνδεση",
      "Είστε σίγουροι ότι θέλετε να αποσυνδεθείτε;",
      [
        { text: "Ακύρωση", style: "cancel" },
        {
          text: "Αποσύνδεση",
          style: "destructive",
          onPress: logout,
        },
      ]
    );
  };

  const getShiftLabel = (name: string) => {
    const labels: Record<string, string> = {
      morning: "Πρωινή Βάρδια",
      midday: "Μεσημεριανή Βάρδια",
      afternoon: "Απογευματινή Βάρδια",
    };
    return labels[name] || name;
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <HeaderTitle title="Ρυθμίσεις" />

        <Card elevation={1} style={styles.section}>
          <ThemedText type="h4">Γενικές Ρυθμίσεις</ThemedText>

          <TextInput
            label="Κανόνας Εργάσιμων Ημερών"
            value={workingDays}
            onChangeText={setWorkingDays}
            keyboardType="number-pad"
            placeholder="6"
          />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Ελάχιστες εργάσιμες ημέρες μεταξύ λήξης μαθήματος και εξέτασης
          </ThemedText>

          <TextInput
            label="Διάρκεια Κράτησης (λεπτά)"
            value={holdDuration}
            onChangeText={setHoldDuration}
            keyboardType="number-pad"
            placeholder="15"
          />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Χρόνος που έχει ο χρήστης για να επιβεβαιώσει την κράτηση
          </ThemedText>

          <TextInput
            label="Μέγιστοι Υποψήφιοι ανά Ημέρα"
            value={maxCandidates}
            onChangeText={setMaxCandidates}
            keyboardType="number-pad"
            placeholder="100"
          />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Μέγιστος αριθμός υποψηφίων που μπορούν να εξεταστούν ανά ημέρα
          </ThemedText>

          <Button
            onPress={handleSaveSettings}
            disabled={isSaving}
            style={{ marginTop: Spacing.lg }}
          >
            {isSaving ? "Αποθήκευση..." : "Αποθήκευση Ρυθμίσεων"}
          </Button>
        </Card>

        <Card elevation={1} style={styles.section}>
          <ThemedText type="h4">Βάρδιες Εξετάσεων</ThemedText>

          {shifts.map((shift) => (
            <View key={shift.id} style={styles.shiftRow}>
              <View style={styles.shiftInfo}>
                <ThemedText type="body">{getShiftLabel(shift.name)}</ThemedText>
                <ThemedText type="small" style={{ color: theme.textSecondary }}>
                  {shift.startTime} - {shift.endTime} ({shift.maxCandidates} θέσεις)
                </ThemedText>
              </View>
              <Switch
                value={shift.isActive}
                onValueChange={() => handleToggleShift(shift)}
                trackColor={{ false: theme.disabled, true: theme.success + "80" }}
                thumbColor={shift.isActive ? theme.success : theme.backgroundDefault}
              />
            </View>
          ))}

          {shifts.length === 0 ? (
            <ThemedText type="body" style={{ color: theme.textSecondary, textAlign: "center" }}>
              Δεν υπάρχουν διαθέσιμες βάρδιες
            </ThemedText>
          ) : null}
        </Card>

        <Card elevation={1} style={styles.section}>
          <ThemedText type="h4">Λογαριασμός</ThemedText>

          <Pressable
            style={[styles.logoutButton, { borderColor: theme.error }]}
            onPress={handleLogout}
          >
            <Feather name="log-out" size={20} color={theme.error} />
            <ThemedText type="button" style={{ color: theme.error, marginLeft: Spacing.sm }}>
              Αποσύνδεση
            </ThemedText>
          </Pressable>
        </Card>

        <View style={styles.versionInfo}>
          <ThemedText type="caption" style={{ color: theme.textSecondary, textAlign: "center" }}>
            ExamScheduler v1.0.0
          </ThemedText>
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
    paddingHorizontal: Spacing.xl,
  },
  section: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  shiftRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  shiftInfo: {
    flex: 1,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
  },
  versionInfo: {
    marginTop: Spacing["3xl"],
    marginBottom: Spacing.xl,
  },
});
