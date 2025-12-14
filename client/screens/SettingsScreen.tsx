import React, { useState, useCallback } from "react";
import { StyleSheet, View, Alert, Switch, Pressable, Platform, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

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
  candidatesPerProctor: number;
  reservePercentage: number;
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
  const [candidatesPerProctor, setCandidatesPerProctor] = useState("25");
  const [reservePercentage, setReservePercentage] = useState("15");
  const [isUploadingRosters, setIsUploadingRosters] = useState(false);
  const [showProctorModal, setShowProctorModal] = useState(false);
  const [proctorJsonInput, setProctorJsonInput] = useState("");

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
        setCandidatesPerProctor(String(settingsData.candidatesPerProctor || 25));
        setReservePercentage(String(settingsData.reservePercentage || 15));
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
    const candidatesPerProctorNum = parseInt(candidatesPerProctor, 10);
    const reservePercentageNum = parseInt(reservePercentage, 10);

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
    if (isNaN(candidatesPerProctorNum) || candidatesPerProctorNum < 1 || candidatesPerProctorNum > 100) {
      Alert.alert("Σφάλμα", "Οι υποψήφιοι ανά επιτηρητή πρέπει να είναι μεταξύ 1 και 100");
      return;
    }
    if (isNaN(reservePercentageNum) || reservePercentageNum < 0 || reservePercentageNum > 50) {
      Alert.alert("Σφάλμα", "Το ποσοστό εφεδρικών πρέπει να είναι μεταξύ 0 και 50");
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
          candidatesPerProctor: candidatesPerProctorNum,
          reservePercentage: reservePercentageNum,
        }),
      });
      Alert.alert("Επιτυχία", "Οι ρυθμίσεις αποθηκεύτηκαν");
    } catch (err: any) {
      Alert.alert("Σφάλμα", err.message || "Αποτυχία αποθήκευσης");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadProctorSchedule = () => {
    setProctorJsonInput("");
    setShowProctorModal(true);
  };

  const handleSubmitProctorData = async () => {
    if (!proctorJsonInput.trim()) {
      Alert.alert("Σφάλμα", "Εισάγετε δεδομένα JSON");
      return;
    }
    
    setIsUploadingRosters(true);
    try {
      const parsedData = JSON.parse(proctorJsonInput);
      const result = await authFetch("/api/proctor-rosters/upload", {
        method: "POST",
        body: JSON.stringify({ data: parsedData }),
      });
      setShowProctorModal(false);
      Alert.alert(
        "Επιτυχία",
        `Εισήχθησαν ${result.count} εγγραφές επιτηρητών από ${result.dateRange.start} έως ${result.dateRange.end}`
      );
    } catch (err: any) {
      Alert.alert("Σφάλμα", err.message || "Αποτυχία εισαγωγής δεδομένων");
    } finally {
      setIsUploadingRosters(false);
    }
  };

  const handleExcelUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel"],
      });
      
      if (result.canceled) return;
      
      setIsUploadingRosters(true);
      const file = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      const response = await authFetch("/api/proctor-rosters/upload-excel", {
        method: "POST",
        body: JSON.stringify({ excelData: base64 }),
      });
      
      let message = `Εισήχθησαν ${response.count} εγγραφές επιτηρητών`;
      if (response.dateRange) {
        message += ` από ${response.dateRange.start} έως ${response.dateRange.end}`;
      }
      if (response.skippedRows && response.skippedRows.length > 0) {
        message += `\n\nΠαραλείφθηκαν ${response.skippedRows.length} γραμμές με σφάλματα.`;
      }
      
      Alert.alert("Επιτυχία", message);
    } catch (err: any) {
      Alert.alert("Σφάλμα", err.message || "Αποτυχία μεταφόρτωσης Excel");
    } finally {
      setIsUploadingRosters(false);
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
          <ThemedText type="h4">Ρυθμίσεις Επιτηρητών</ThemedText>

          <TextInput
            label="Υποψήφιοι ανά Επιτηρητή"
            value={candidatesPerProctor}
            onChangeText={setCandidatesPerProctor}
            keyboardType="number-pad"
            placeholder="25"
          />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Μέγιστος αριθμός υποψηφίων που επιτηρεί κάθε επιτηρητής
          </ThemedText>

          <TextInput
            label="Ποσοστό Εφεδρικών (%)"
            value={reservePercentage}
            onChangeText={setReservePercentage}
            keyboardType="number-pad"
            placeholder="15"
          />
          <ThemedText type="caption" style={{ color: theme.textSecondary }}>
            Ποσοστό επιτηρητών που κρατείται ως εφεδρεία
          </ThemedText>

          <View style={styles.proctorUploadSection}>
            <ThemedText type="body" style={{ marginBottom: Spacing.sm }}>
              Πρόγραμμα Επιτηρητών
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
              Ανεβάστε αρχείο Excel με στήλες: Ημερομηνία, Βάρδια (morning/midday/afternoon), Αριθμός Επιτηρητών
            </ThemedText>
            <View style={{ flexDirection: "row", gap: Spacing.sm }}>
              <Button
                onPress={handleExcelUpload}
                disabled={isUploadingRosters}
                style={{ flex: 1 }}
              >
                {isUploadingRosters ? "Μεταφόρτωση..." : "Ανέβασμα Excel"}
              </Button>
              <Button
                onPress={handleUploadProctorSchedule}
                disabled={isUploadingRosters}
                variant="secondary"
                style={{ flex: 1 }}
              >
                JSON
              </Button>
            </View>
          </View>
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
            <MaterialCommunityIcons name="log-out" size={20} color={theme.error} />
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

      <Modal
        visible={showProctorModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowProctorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText type="h4" style={{ marginBottom: Spacing.md }}>
              Εισαγωγή Προγράμματος Επιτηρητών
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.textSecondary, marginBottom: Spacing.md }}>
              Μορφή: [{"{"}"date": "2025-01-15", "shift": "morning", "proctorCount": 10{"}"}]
            </ThemedText>
            <TextInput
              label="Δεδομένα JSON"
              value={proctorJsonInput}
              onChangeText={setProctorJsonInput}
              multiline
              numberOfLines={6}
              placeholder='[{"date": "2025-01-15", "shift": "morning", "proctorCount": 10}]'
            />
            <View style={styles.modalButtons}>
              <Button
                onPress={() => setShowProctorModal(false)}
                variant="secondary"
                style={{ flex: 1, marginRight: Spacing.sm }}
              >
                Ακύρωση
              </Button>
              <Button
                onPress={handleSubmitProctorData}
                disabled={isUploadingRosters}
                style={{ flex: 1 }}
              >
                {isUploadingRosters ? "Αποθήκευση..." : "Αποθήκευση"}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
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
  proctorUploadSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.2)",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalButtons: {
    flexDirection: "row",
    marginTop: Spacing.lg,
  },
});
