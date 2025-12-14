import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, View, Alert } from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withRepeat, withSequence } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuthenticatedFetch } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "HoldCountdown">;
type RoutePropType = RouteProp<RootStackParamList, "HoldCountdown">;

const HOLD_DURATION_SECONDS = 15 * 60;

export default function HoldCountdownScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const authFetch = useAuthenticatedFetch();

  const { bookingId } = route.params;

  const [timeLeft, setTimeLeft] = useState(HOLD_DURATION_SECONDS);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const pulseOpacity = useSharedValue(1);

  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    fetchBooking();
    
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (timeLeft <= 180) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1
      );
    }
  }, [timeLeft <= 180]);

  async function fetchBooking() {
    try {
      const bookings = await authFetch("/api/bookings");
      const found = bookings.find((b: any) => b.id === bookingId);
      if (found) {
        setBooking(found);
        if (found.holdExpiresAt) {
          const expiresAt = new Date(found.holdExpiresAt).getTime();
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
          setTimeLeft(remaining);
        }
      }
    } catch (error) {
      console.error("Failed to fetch booking:", error);
    }
  }

  function handleExpired() {
    Alert.alert(
      "Η Κράτηση Έληξε",
      "Ο χρόνος κράτησης έληξε. Η θέση είναι ξανά διαθέσιμη.",
      [{ text: "OK", onPress: () => navigation.goBack() }]
    );
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await authFetch(`/api/bookings/${bookingId}/submit`, {
        method: "PUT",
        body: JSON.stringify({ notes }),
      });

      Alert.alert(
        "Επιτυχής Υποβολή",
        "Η κράτησή σας υποβλήθηκε και αναμένει έγκριση από τον διαχειριστή.",
        [{ text: "OK", onPress: () => navigation.navigate("UserMain") }]
      );
    } catch (err: any) {
      Alert.alert("Σφάλμα", err.message || "Αποτυχία υποβολής κράτησης");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCancel() {
    Alert.alert(
      "Ακύρωση Κράτησης",
      "Είστε σίγουροι ότι θέλετε να ακυρώσετε την κράτηση;",
      [
        { text: "Όχι", style: "cancel" },
        {
          text: "Ναι, Ακύρωση",
          style: "destructive",
          onPress: async () => {
            setIsCancelling(true);
            try {
              await authFetch(`/api/bookings/${bookingId}/cancel`, { method: "PUT" });
              navigation.goBack();
            } catch (err: any) {
              Alert.alert("Σφάλμα", err.message || "Αποτυχία ακύρωσης");
            } finally {
              setIsCancelling(false);
            }
          },
        },
      ]
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getTimerColor = () => {
    if (timeLeft <= 180) return theme.error;
    if (timeLeft <= 300) return theme.warning;
    return theme.primary;
  };

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: timeLeft <= 180 ? pulseOpacity.value : 1,
  }));

  const progress = timeLeft / HOLD_DURATION_SECONDS;
  const strokeDashoffset = 377 * (1 - progress);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.timerContainer}>
          <Animated.View style={[styles.timerCircle, pulseStyle]}>
            <View style={[styles.progressBackground, { borderColor: theme.border }]} />
            <View style={styles.progressContainer}>
              {Array.from({ length: 60 }).map((_, index) => {
                const angle = (index * 6 - 90) * (Math.PI / 180);
                const isActive = index / 60 <= progress;
                return (
                  <View
                    key={index}
                    style={[
                      styles.progressDot,
                      {
                        backgroundColor: isActive ? getTimerColor() : theme.border,
                        transform: [
                          { translateX: Math.cos(angle) * 52 },
                          { translateY: Math.sin(angle) * 52 },
                        ],
                      },
                    ]}
                  />
                );
              })}
            </View>
            <ThemedText type="hero" style={{ color: getTimerColor() }}>
              {formatTime(timeLeft)}
            </ThemedText>
          </Animated.View>
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.lg, textAlign: "center" }}>
            Χρόνος που απομένει για επιβεβαίωση
          </ThemedText>
        </View>

        {booking ? (
          <Card elevation={1} style={styles.summaryCard}>
            <ThemedText type="h4">Στοιχεία Κράτησης</ThemedText>
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="pricetag-outline" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>Τμήμα: {booking.departmentId}</ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="calendar-outline" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>
                {new Date(booking.bookingDate).toLocaleDateString("el-GR")}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <MaterialCommunityIcons name="account-group-outline" size={16} color={theme.textSecondary} />
              <ThemedText type="body" style={{ marginLeft: Spacing.sm }}>{booking.candidateCount} υποψήφιοι</ThemedText>
            </View>
          </Card>
        ) : null}

        <View style={styles.notesSection}>
          <TextInput
            label="Σημειώσεις (προαιρετικά)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Προσθέστε τυχόν σημειώσεις για τον διαχειριστή..."
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.actionButtons}>
          <Button
            onPress={handleSubmit}
            disabled={isSubmitting || timeLeft === 0}
            style={{ backgroundColor: theme.success }}
          >
            {isSubmitting ? "Υποβολή..." : "Επιβεβαίωση Κράτησης"}
          </Button>
          
          <Button
            onPress={handleCancel}
            disabled={isCancelling}
            style={{ backgroundColor: theme.backgroundSecondary }}
          >
            <ThemedText type="button" style={{ color: theme.textSecondary }}>
              {isCancelling ? "Ακύρωση..." : "Ακύρωση"}
            </ThemedText>
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
  timerContainer: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  timerCircle: {
    width: 140,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
  },
  progressBackground: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
  },
  progressContainer: {
    position: "absolute",
    width: 140,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
  },
  progressDot: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  summaryCard: {
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  notesSection: {
    marginBottom: Spacing.xl,
  },
  actionButtons: {
    gap: Spacing.md,
  },
});
