import React from "react";
import { View, StyleSheet, Image } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing } from "@/constants/theme";

interface LogoBrandProps {
  size?: "small" | "medium" | "large";
  showSubtitle?: boolean;
  subtitle?: string;
}

export function LogoBrand({ 
  size = "medium", 
  showSubtitle = false,
  subtitle = "Σύστημα Προγραμματισμού Εξετάσεων"
}: LogoBrandProps) {
  const sizes = {
    small: { uSize: 20, textSize: 18, iconSize: 16, gap: 2 },
    medium: { uSize: 28, textSize: 24, iconSize: 22, gap: 4 },
    large: { uSize: 40, textSize: 34, iconSize: 30, gap: 6 },
  };

  const { uSize, textSize, iconSize, gap } = sizes[size];

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <ThemedText style={[styles.uLetter, { fontSize: uSize }]}>U</ThemedText>
        <ThemedText style={[styles.separator, { fontSize: textSize }]}>-</ThemedText>
        <View style={styles.scheduleContainer}>
          <ThemedText style={[styles.schedule, { fontSize: textSize }]}>SCHEDULE</ThemedText>
        </View>
      </View>
      {showSubtitle ? (
        <ThemedText type="small" style={styles.subtitle}>
          {subtitle}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  uLetter: {
    fontWeight: "800",
    color: Colors.light.primary,
    letterSpacing: -1,
  },
  separator: {
    fontWeight: "300",
    color: Colors.light.secondary,
    marginHorizontal: 2,
  },
  scheduleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  schedule: {
    fontWeight: "600",
    color: Colors.light.secondary,
    letterSpacing: 1,
  },
  subtitle: {
    marginTop: Spacing.sm,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
});
