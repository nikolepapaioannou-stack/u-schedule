import React from "react";
import { Platform, Text, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type IconName = 
  | "magnify"
  | "calendar-outline"
  | "bell-outline"
  | "account-outline"
  | "view-grid-outline"
  | "clock-outline"
  | "cog-outline"
  | "eye-outline"
  | "eye-off-outline"
  | "alert-circle-outline"
  | "cellphone"
  | "chevron-right"
  | "chevron-left"
  | "check"
  | "close"
  | "plus"
  | "minus"
  | "calendar"
  | "calendar-check"
  | "calendar-clock"
  | "calendar-remove"
  | "file-document-outline"
  | "school-outline"
  | "account-group-outline"
  | "timer-outline"
  | "check-circle-outline"
  | "close-circle-outline"
  | "information-outline"
  | "logout"
  | "fingerprint"
  | "shield-check-outline"
  | "email-outline"
  | "lock-outline"
  | "refresh";

const unicodeFallback: Record<IconName, string> = {
  "magnify": "Q",
  "calendar-outline": "C",
  "bell-outline": "N",
  "account-outline": "U",
  "view-grid-outline": "#",
  "clock-outline": "T",
  "cog-outline": "*",
  "eye-outline": "o",
  "eye-off-outline": "-",
  "alert-circle-outline": "!",
  "cellphone": "M",
  "chevron-right": ">",
  "chevron-left": "<",
  "check": "V",
  "close": "X",
  "plus": "+",
  "minus": "-",
  "calendar": "C",
  "calendar-check": "V",
  "calendar-clock": "T",
  "calendar-remove": "X",
  "file-document-outline": "D",
  "school-outline": "S",
  "account-group-outline": "G",
  "timer-outline": "T",
  "check-circle-outline": "V",
  "close-circle-outline": "X",
  "information-outline": "i",
  "logout": ">",
  "fingerprint": "F",
  "shield-check-outline": "S",
  "email-outline": "@",
  "lock-outline": "L",
  "refresh": "R",
};

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function AppIcon({ name, size = 24, color = "#000" }: AppIconProps) {
  if (Platform.OS === "android") {
    const symbol = unicodeFallback[name] || "•";
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        <Text style={[styles.icon, { fontSize: size * 0.7, color }]}>
          {symbol}
        </Text>
      </View>
    );
  }

  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    textAlign: "center",
  },
});
