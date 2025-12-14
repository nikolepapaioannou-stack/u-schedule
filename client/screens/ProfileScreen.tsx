import React, { useState } from "react";
import { StyleSheet, View, Pressable, Switch, Platform, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { HeaderTitle } from "@/components/HeaderTitle";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function ProfileScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { user, logout, setBiometricEnabled } = useAuth();

  const [biometricEnabled, setBiometricEnabledLocal] = useState(user?.biometricEnabled || false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleBiometricToggle(enabled: boolean) {
    if (Platform.OS === "web") {
      Alert.alert("Μη διαθέσιμο", "Η βιομετρική σύνδεση διατίθεται μόνο σε κινητές συσκευές.");
      return;
    }

    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (!compatible || !enrolled) {
        Alert.alert(
          "Μη διαθέσιμο",
          "Η συσκευή σας δεν υποστηρίζει βιομετρική αυθεντικοποίηση ή δεν έχει ρυθμιστεί."
        );
        return;
      }

      if (enabled) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Επιβεβαιώστε για ενεργοποίηση βιομετρικής σύνδεσης",
          cancelLabel: "Ακύρωση",
        });

        if (!result.success) {
          return;
        }
      }

      await setBiometricEnabled(enabled);
      setBiometricEnabledLocal(enabled);
    } catch (error) {
      Alert.alert("Σφάλμα", "Αποτυχία ρύθμισης βιομετρικής σύνδεσης");
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
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
        <HeaderTitle title="Προφίλ" />

        <Card elevation={1} style={styles.profileCard}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.primary }]}>
            <Ionicons name="person-outline" size={32} color="#FFFFFF" />
          </View>
          <View style={styles.profileInfo}>
            <ThemedText type="h3">{user?.email}</ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              UGR ID: {user?.ugrId}
            </ThemedText>
          </View>
        </Card>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Ασφάλεια</ThemedText>
          
          <Card elevation={1}>
            <Pressable style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="phone-portrait-outline" size={20} color={theme.textSecondary} />
                <View style={{ marginLeft: Spacing.md, flex: 1 }}>
                  <ThemedText type="body">Βιομετρική Σύνδεση</ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Χρήση δαχτυλικού αποτυπώματος για γρήγορη σύνδεση
                  </ThemedText>
                </View>
              </View>
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: theme.border, true: theme.primary + "50" }}
                thumbColor={biometricEnabled ? theme.primary : theme.backgroundTertiary}
              />
            </Pressable>
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText type="h4" style={styles.sectionTitle}>Πληροφορίες Εφαρμογής</ThemedText>
          
          <Card elevation={1} style={styles.infoCard}>
            <View style={styles.infoRow}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>Έκδοση</ThemedText>
              <ThemedText type="body">1.0.0</ThemedText>
            </View>
            <View style={[styles.infoRow, { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: Spacing.md }]}>
              <ThemedText type="body" style={{ color: theme.textSecondary }}>Τύπος Λογαριασμού</ThemedText>
              <ThemedText type="body">{user?.isAdmin ? "Διαχειριστής" : "Χρήστης"}</ThemedText>
            </View>
          </Card>
        </View>

        <View style={styles.logoutSection}>
          <Button
            onPress={handleLogout}
            disabled={isLoggingOut}
            style={{ backgroundColor: theme.error }}
          >
            <View style={styles.logoutButtonContent}>
              <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
              <ThemedText type="button" style={{ color: "#FFFFFF", marginLeft: Spacing.sm }}>
                {isLoggingOut ? "Αποσύνδεση..." : "Αποσύνδεση"}
              </ThemedText>
            </View>
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
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
    gap: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.md,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: Spacing.md,
  },
  infoCard: {
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logoutSection: {
    marginTop: "auto",
    paddingTop: Spacing.xl,
  },
  logoutButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
});
