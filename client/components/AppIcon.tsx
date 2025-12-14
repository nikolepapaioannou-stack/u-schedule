import React from "react";
import { Platform, Image, StyleSheet, View } from "react-native";
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

const iconUrls: Record<IconName, string> = {
  "magnify": "https://api.iconify.design/mdi/magnify.svg",
  "calendar-outline": "https://api.iconify.design/mdi/calendar-outline.svg",
  "bell-outline": "https://api.iconify.design/mdi/bell-outline.svg",
  "account-outline": "https://api.iconify.design/mdi/account-outline.svg",
  "view-grid-outline": "https://api.iconify.design/mdi/view-grid-outline.svg",
  "clock-outline": "https://api.iconify.design/mdi/clock-outline.svg",
  "cog-outline": "https://api.iconify.design/mdi/cog-outline.svg",
  "eye-outline": "https://api.iconify.design/mdi/eye-outline.svg",
  "eye-off-outline": "https://api.iconify.design/mdi/eye-off-outline.svg",
  "alert-circle-outline": "https://api.iconify.design/mdi/alert-circle-outline.svg",
  "cellphone": "https://api.iconify.design/mdi/cellphone.svg",
  "chevron-right": "https://api.iconify.design/mdi/chevron-right.svg",
  "chevron-left": "https://api.iconify.design/mdi/chevron-left.svg",
  "check": "https://api.iconify.design/mdi/check.svg",
  "close": "https://api.iconify.design/mdi/close.svg",
  "plus": "https://api.iconify.design/mdi/plus.svg",
  "minus": "https://api.iconify.design/mdi/minus.svg",
  "calendar": "https://api.iconify.design/mdi/calendar.svg",
  "calendar-check": "https://api.iconify.design/mdi/calendar-check.svg",
  "calendar-clock": "https://api.iconify.design/mdi/calendar-clock.svg",
  "calendar-remove": "https://api.iconify.design/mdi/calendar-remove.svg",
  "file-document-outline": "https://api.iconify.design/mdi/file-document-outline.svg",
  "school-outline": "https://api.iconify.design/mdi/school-outline.svg",
  "account-group-outline": "https://api.iconify.design/mdi/account-group-outline.svg",
  "timer-outline": "https://api.iconify.design/mdi/timer-outline.svg",
  "check-circle-outline": "https://api.iconify.design/mdi/check-circle-outline.svg",
  "close-circle-outline": "https://api.iconify.design/mdi/close-circle-outline.svg",
  "information-outline": "https://api.iconify.design/mdi/information-outline.svg",
  "logout": "https://api.iconify.design/mdi/logout.svg",
  "fingerprint": "https://api.iconify.design/mdi/fingerprint.svg",
  "shield-check-outline": "https://api.iconify.design/mdi/shield-check-outline.svg",
  "email-outline": "https://api.iconify.design/mdi/email-outline.svg",
  "lock-outline": "https://api.iconify.design/mdi/lock-outline.svg",
  "refresh": "https://api.iconify.design/mdi/refresh.svg",
};

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function AppIcon({ name, size = 24, color = "#000" }: AppIconProps) {
  if (Platform.OS === "android") {
    const url = iconUrls[name];
    if (url) {
      const colorParam = color.replace("#", "");
      const coloredUrl = `${url}?color=%23${colorParam}`;
      return (
        <View style={[styles.container, { width: size, height: size }]}>
          <Image
            source={{ uri: coloredUrl }}
            style={{ width: size, height: size }}
            resizeMode="contain"
          />
        </View>
      );
    }
  }

  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
});
