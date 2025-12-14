import React, { useState } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export default function RegisterScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ugrId, setUgrId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRegister() {
    if (!email || !password || !confirmPassword || !ugrId) {
      setError("Συμπληρώστε όλα τα πεδία");
      return;
    }

    if (password.length < 6) {
      setError("Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες");
      return;
    }

    if (password !== confirmPassword) {
      setError("Οι κωδικοί δεν ταιριάζουν");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await register(email, password, ugrId);
    } catch (err: any) {
      setError(err.message || "Σφάλμα εγγραφής");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.headerContainer}>
          <ThemedText type="h1">Δημιουργία Λογαριασμού</ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Συμπληρώστε τα στοιχεία σας για να δημιουργήσετε λογαριασμό
          </ThemedText>
        </View>

        <View style={styles.formContainer}>
          {error ? (
            <View style={[styles.errorContainer, { backgroundColor: theme.error + "20" }]}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.error} />
              <ThemedText type="small" style={{ color: theme.error, marginLeft: Spacing.sm }}>
                {error}
              </ThemedText>
            </View>
          ) : null}

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="example@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <TextInput
            label="UGR ID"
            value={ugrId}
            onChangeText={setUgrId}
            placeholder="Εισάγετε το UGR ID σας"
            autoCapitalize="none"
          />

          <TextInput
            label="Κωδικός"
            value={password}
            onChangeText={setPassword}
            placeholder="Τουλάχιστον 6 χαρακτήρες"
            secureTextEntry={!showPassword}
            rightIcon={
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color={theme.textSecondary} />
              </Pressable>
            }
          />

          <TextInput
            label="Επιβεβαίωση Κωδικού"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Επαναλάβετε τον κωδικό"
            secureTextEntry={!showPassword}
          />

          <Button onPress={handleRegister} disabled={isLoading}>
            {isLoading ? "Εγγραφή..." : "Εγγραφή"}
          </Button>

          <View style={styles.loginContainer}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Έχετε ήδη λογαριασμό;
            </ThemedText>
            <Pressable onPress={() => navigation.goBack()}>
              <ThemedText type="link" style={{ marginLeft: Spacing.sm }}>
                Σύνδεση
              </ThemedText>
            </Pressable>
          </View>
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
  headerContainer: {
    marginBottom: Spacing["2xl"],
  },
  subtitle: {
    marginTop: Spacing.sm,
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
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.lg,
  },
});
