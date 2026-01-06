import React, { useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { AppIcon } from "@/components/AppIcon";
import { Image } from "expo-image";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { LogoBrand } from "@/components/LogoBrand";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, GradientColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type LoginScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Login">;

const BIOMETRIC_EMAIL_KEY = "exam_scheduler_biometric_email";
const BIOMETRIC_PASSWORD_KEY = "exam_scheduler_biometric_password";

export default function LoginScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [hasSavedCredentials, setHasSavedCredentials] = useState(false);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  async function checkBiometricAvailability() {
    if (Platform.OS === "web") {
      setBiometricAvailable(false);
      return;
    }
    
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(compatible && enrolled);
      
      const storedEmail = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
      const storedPassword = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY);
      setHasSavedCredentials(!!storedEmail && !!storedPassword);
    } catch (err) {
      setBiometricAvailable(false);
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      setError("Συμπληρώστε όλα τα πεδία");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await login(email, password);
      if (Platform.OS !== "web") {
        await SecureStore.setItemAsync(BIOMETRIC_EMAIL_KEY, email);
        await SecureStore.setItemAsync(BIOMETRIC_PASSWORD_KEY, password);
      }
    } catch (err: any) {
      setError(err.message || "Σφάλμα σύνδεσης");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleBiometricLogin() {
    if (Platform.OS === "web") return;
    
    setIsLoading(true);
    setError("");

    try {
      const storedEmail = await SecureStore.getItemAsync(BIOMETRIC_EMAIL_KEY);
      const storedPassword = await SecureStore.getItemAsync(BIOMETRIC_PASSWORD_KEY);
      
      if (!storedEmail || !storedPassword) {
        setError("Συνδεθείτε πρώτα με email για να ενεργοποιήσετε το δαχτυλικό αποτύπωμα");
        setIsLoading(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Σύνδεση με δαχτυλικό αποτύπωμα",
        cancelLabel: "Ακύρωση",
      });

      if (result.success) {
        await login(storedEmail, storedPassword);
      }
    } catch (err: any) {
      setError(err.message || "Σφάλμα βιομετρικού ελέγχου");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.logoContainer}>
          <LogoBrand size="large" showSubtitle subtitle="Σύστημα Προγραμματισμού Εξετάσεων" />
        </View>

        <View style={styles.formContainer}>
          {error ? (
            <View style={[styles.errorContainer, { backgroundColor: theme.error + "20" }]}>
              <AppIcon name="alert-circle-outline" size={16} color={theme.error} />
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
            label="Κωδικός"
            value={password}
            onChangeText={setPassword}
            placeholder="Εισάγετε τον κωδικό σας"
            secureTextEntry={!showPassword}
            rightIcon={
              <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={8}>
                <AppIcon name={showPassword ? "eye-off-outline" : "eye-outline"} size={24} color={theme.textSecondary} />
              </Pressable>
            }
          />

          <Button onPress={handleLogin} disabled={isLoading}>
            {isLoading ? "Σύνδεση..." : "Σύνδεση"}
          </Button>

          {biometricAvailable && hasSavedCredentials ? (
            <Pressable
              style={[styles.biometricButton, { borderColor: theme.border }]}
              onPress={handleBiometricLogin}
            >
              <AppIcon name="cellphone" size={24} color={theme.primary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.md, color: theme.primary }}>
                Σύνδεση με δαχτυλικό αποτύπωμα
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={styles.registerContainer}>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Δεν έχετε λογαριασμό;
            </ThemedText>
            <Pressable onPress={() => navigation.navigate("Register")}>
              <ThemedText type="link" style={{ marginLeft: Spacing.sm }}>
                Εγγραφή
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </KeyboardAwareScrollViewCompat>
      
      <View style={[styles.groupLogoContainer, { bottom: insets.bottom + Spacing.lg }]}>
        <Image
          source={require("../../assets/images/group-logo.png")}
          style={styles.groupLogo}
          contentFit="contain"
        />
      </View>
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
  logoContainer: {
    alignItems: "center",
    marginTop: Spacing["3xl"],
    marginBottom: Spacing["2xl"],
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
  biometricButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderWidth: 2,
    borderRadius: BorderRadius.md,
  },
  registerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  groupLogoContainer: {
    position: "absolute",
    left: Spacing.lg,
  },
  groupLogo: {
    width: 80,
    height: 80,
  },
});
