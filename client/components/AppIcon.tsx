import React from "react";
import { Feather } from "@expo/vector-icons";

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

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

const iconMapping: Record<IconName, FeatherIconName> = {
  "magnify": "search",
  "calendar-outline": "calendar",
  "bell-outline": "bell",
  "account-outline": "user",
  "view-grid-outline": "grid",
  "clock-outline": "clock",
  "cog-outline": "settings",
  "eye-outline": "eye",
  "eye-off-outline": "eye-off",
  "alert-circle-outline": "alert-circle",
  "cellphone": "smartphone",
  "chevron-right": "chevron-right",
  "chevron-left": "chevron-left",
  "check": "check",
  "close": "x",
  "plus": "plus",
  "minus": "minus",
  "calendar": "calendar",
  "calendar-check": "check-square",
  "calendar-clock": "clock",
  "calendar-remove": "x-square",
  "file-document-outline": "file-text",
  "school-outline": "book",
  "account-group-outline": "users",
  "timer-outline": "clock",
  "check-circle-outline": "check-circle",
  "close-circle-outline": "x-circle",
  "information-outline": "info",
  "logout": "log-out",
  "fingerprint": "lock",
  "shield-check-outline": "shield",
  "email-outline": "mail",
  "lock-outline": "lock",
  "refresh": "refresh-cw",
};

interface AppIconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function AppIcon({ name, size = 24, color = "#000" }: AppIconProps) {
  const featherName = iconMapping[name] || "help-circle";
  return <Feather name={featherName} size={size} color={color} />;
}
