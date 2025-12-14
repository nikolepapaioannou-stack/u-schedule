import React from "react";
import { Ionicons } from "@expo/vector-icons";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

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

const iconMapping: Record<IconName, IoniconsName> = {
  "magnify": "search-outline",
  "calendar-outline": "calendar-outline",
  "bell-outline": "notifications-outline",
  "account-outline": "person-outline",
  "view-grid-outline": "grid-outline",
  "clock-outline": "time-outline",
  "cog-outline": "settings-outline",
  "eye-outline": "eye-outline",
  "eye-off-outline": "eye-off-outline",
  "alert-circle-outline": "alert-circle-outline",
  "cellphone": "phone-portrait-outline",
  "chevron-right": "chevron-forward-outline",
  "chevron-left": "chevron-back-outline",
  "check": "checkmark-outline",
  "close": "close-outline",
  "plus": "add-outline",
  "minus": "remove-outline",
  "calendar": "calendar",
  "calendar-check": "checkmark-circle-outline",
  "calendar-clock": "time-outline",
  "calendar-remove": "close-circle-outline",
  "file-document-outline": "document-text-outline",
  "school-outline": "school-outline",
  "account-group-outline": "people-outline",
  "timer-outline": "timer-outline",
  "check-circle-outline": "checkmark-circle-outline",
  "close-circle-outline": "close-circle-outline",
  "information-outline": "information-circle-outline",
  "logout": "log-out-outline",
  "fingerprint": "finger-print-outline",
  "shield-check-outline": "shield-checkmark-outline",
  "email-outline": "mail-outline",
  "lock-outline": "lock-closed-outline",
  "refresh": "refresh-outline",
};

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function AppIcon({ name, size = 24, color = "#000" }: AppIconProps) {
  const ioniconsName = iconMapping[name] || "help-circle-outline";
  return <Ionicons name={ioniconsName} size={size} color={color} />;
}
