import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#111827",
    textSecondary: "#6B7280",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#1E40AF",
    link: "#1E40AF",
    backgroundRoot: "#F9FAFB",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#F3F4F6",
    backgroundTertiary: "#E5E7EB",
    border: "#E5E7EB",
    disabled: "#D1D5DB",
    primary: "#1E40AF",
    secondary: "#059669",
    accent: "#DC2626",
    success: "#10B981",
    warning: "#FBBF24",
    error: "#EF4444",
    shiftMorning: "#10B981",
    shiftMidday: "#F59E0B",
    shiftAfternoon: "#8B5CF6",
    statusPending: "#FBBF24",
    statusApproved: "#10B981",
    statusRejected: "#EF4444",
    statusCompleted: "#6B7280",
    statusAvailable: "#3B82F6",
  },
  dark: {
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6B7280",
    tabIconSelected: "#60A5FA",
    link: "#60A5FA",
    backgroundRoot: "#0F172A",
    backgroundDefault: "#1E293B",
    backgroundSecondary: "#334155",
    backgroundTertiary: "#475569",
    border: "#475569",
    disabled: "#4B5563",
    primary: "#3B82F6",
    secondary: "#10B981",
    accent: "#EF4444",
    success: "#34D399",
    warning: "#FCD34D",
    error: "#F87171",
    shiftMorning: "#34D399",
    shiftMidday: "#FBBF24",
    shiftAfternoon: "#A78BFA",
    statusPending: "#FCD34D",
    statusApproved: "#34D399",
    statusRejected: "#F87171",
    statusCompleted: "#9CA3AF",
    statusAvailable: "#60A5FA",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  "3xl": 48,
  inputHeight: 48,
  buttonHeight: 48,
  listItemMinHeight: 72,
  touchTarget: 44,
  fabSize: 56,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  "2xl": 32,
  full: 9999,
};

export const Typography = {
  hero: {
    fontSize: 32,
    fontWeight: "700" as const,
  },
  h1: {
    fontSize: 24,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  button: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  link: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
};

export const Shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  fab: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 4,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
