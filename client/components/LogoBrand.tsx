import React from "react";
import { View, StyleSheet, Text, Platform } from "react-native";
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
    small: { uSize: 22, certSize: 16, gap: 1 },
    medium: { uSize: 32, certSize: 22, gap: 2 },
    large: { uSize: 48, certSize: 32, gap: 3 },
  };

  const { uSize, certSize, gap } = sizes[size];

  const serifFont = Platform.select({
    ios: "Georgia",
    android: "serif",
    web: "Georgia, 'Times New Roman', serif",
  });

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <Text style={[
          styles.uLetter, 
          { 
            fontSize: uSize, 
            fontFamily: serifFont,
          }
        ]}>
          U
        </Text>
        <Text style={[
          styles.separator, 
          { 
            fontSize: certSize,
            marginHorizontal: gap,
          }
        ]}>
          -
        </Text>
        <Text style={[
          styles.certText, 
          { 
            fontSize: certSize,
          }
        ]}>
          SCHEDULE
        </Text>
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
    alignItems: "baseline",
  },
  uLetter: {
    fontWeight: "700",
    color: "#1D3557",
    letterSpacing: -0.5,
  },
  separator: {
    fontWeight: "300",
    color: "#6B7B8C",
  },
  certText: {
    fontWeight: "400",
    color: "#6B7B8C",
    letterSpacing: 2,
  },
  subtitle: {
    marginTop: Spacing.sm,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
});
