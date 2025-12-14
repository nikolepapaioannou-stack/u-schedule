import React from "react";
import { Platform, Image, StyleSheet, View, ImageSourcePropType } from "react-native";
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

const localIcons: Partial<Record<IconName, ImageSourcePropType>> = {
  "eye-outline": require("../../assets/images/eye-open.jpg"),
  "eye-off-outline": require("../../assets/images/eye-closed.jpg"),
};

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function AppIcon({ name, size = 24, color = "#000" }: AppIconProps) {
  if (Platform.OS === "android") {
    const localIcon = localIcons[name];
    if (localIcon) {
      return (
        <View style={[styles.container, { width: size, height: size }]}>
          <Image
            source={localIcon}
            style={{ width: size, height: size, tintColor: color }}
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
