import React from "react";
import { View, StyleSheet, Text, Image, Platform } from "react-native";
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
    small: { iconSize: 28, textSize: 16, gap: -4 },
    medium: { iconSize: 42, textSize: 24, gap: -6 },
    large: { iconSize: 60, textSize: 34, gap: -8 },
  };

  const { iconSize, textSize, gap } = sizes[size];

  const serifFont = Platform.select({
    ios: "Times New Roman",
    android: "serif",
    web: "'Times New Roman', Georgia, serif",
  });

  return (
    <View style={styles.container}>
      <View style={styles.logoRow}>
        <Image
          source={require("../../assets/images/u-icon.png")}
          style={{ width: iconSize, height: iconSize }}
          resizeMode="contain"
        />
        <Text style={[
          styles.scheduleText, 
          { 
            fontSize: textSize,
            marginLeft: gap,
            marginTop: textSize * 0.3,
            fontFamily: serifFont,
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
    alignItems: "flex-end",
  },
  scheduleText: {
    fontWeight: "400",
    color: "#6B7B8C",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  subtitle: {
    marginTop: Spacing.sm,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
});
