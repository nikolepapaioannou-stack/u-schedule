import React from "react";
import { View, StyleSheet, Text, Image } from "react-native";
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
    small: { iconSize: 28, textSize: 18, gap: 6 },
    medium: { iconSize: 40, textSize: 26, gap: 8 },
    large: { iconSize: 56, textSize: 36, gap: 10 },
  };

  const { iconSize, textSize, gap } = sizes[size];

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
    alignItems: "center",
  },
  scheduleText: {
    fontWeight: "400",
    color: "#6B7B8C",
    letterSpacing: 3,
    textTransform: "uppercase",
  },
  subtitle: {
    marginTop: Spacing.sm,
    color: Colors.light.textSecondary,
    textAlign: "center",
  },
});
