import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#1E293B",
    textSecondary: "#64748B",
    buttonText: "#FFFFFF",
    tabIconDefault: "#64748B",
    tabIconSelected: "#5B8DEF",
    link: "#5B8DEF",
    backgroundRoot: "#F0F4FF",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#F8FAFF",
    backgroundTertiary: "#EEF2FF",
    border: "rgba(91, 141, 239, 0.15)",
    borderLight: "rgba(255, 255, 255, 0.2)",
    disabled: "#CBD5E1",
    disabledText: "#9CA3AF",
    primary: "#5B8DEF",
    primaryDark: "#4169E1",
    secondary: "#8B7FD8",
    accent: "#4169E1",
    success: "#34D399",
    warning: "#FBBF24",
    error: "#F87171",
    info: "#60A5FA",
    shiftMorning: "#10B981",
    shiftMidday: "#F59E0B",
    shiftAfternoon: "#8B5CF6",
    statusPending: "#FBBF24",
    statusApproved: "#34D399",
    statusRejected: "#F87171",
    statusCompleted: "#64748B",
    statusAvailable: "#5B8DEF",
    glassSurface: "rgba(255, 255, 255, 0.7)",
    glassBorder: "rgba(255, 255, 255, 0.2)",
    inputBackground: "rgba(255, 255, 255, 0.5)",
    inputBorder: "rgba(91, 141, 239, 0.2)",
    segmentedBackground: "rgba(91, 141, 239, 0.1)",
    separator: "rgba(91, 141, 239, 0.1)",
  },
  dark: {
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#64748B",
    tabIconSelected: "#60A5FA",
    link: "#60A5FA",
    backgroundRoot: "#0F172A",
    backgroundDefault: "#1E293B",
    backgroundSecondary: "#334155",
    backgroundTertiary: "#475569",
    border: "rgba(96, 165, 250, 0.2)",
    borderLight: "rgba(255, 255, 255, 0.1)",
    disabled: "#4B5563",
    disabledText: "#6B7280",
    primary: "#60A5FA",
    primaryDark: "#3B82F6",
    secondary: "#A78BFA",
    accent: "#3B82F6",
    success: "#34D399",
    warning: "#FCD34D",
    error: "#F87171",
    info: "#60A5FA",
    shiftMorning: "#34D399",
    shiftMidday: "#FBBF24",
    shiftAfternoon: "#A78BFA",
    statusPending: "#FCD34D",
    statusApproved: "#34D399",
    statusRejected: "#F87171",
    statusCompleted: "#9CA3AF",
    statusAvailable: "#60A5FA",
    glassSurface: "rgba(30, 41, 59, 0.8)",
    glassBorder: "rgba(255, 255, 255, 0.1)",
    inputBackground: "rgba(30, 41, 59, 0.6)",
    inputBorder: "rgba(96, 165, 250, 0.3)",
    segmentedBackground: "rgba(96, 165, 250, 0.15)",
    separator: "rgba(96, 165, 250, 0.1)",
  },
};

export const GradientColors = {
  primary: ["#5B8DEF", "#4169E1"] as const,
  secondary: ["#8B7FD8", "#6366F1"] as const,
  success: ["#34D399", "#10B981"] as const,
  warning: ["#FBBF24", "#F59E0B"] as const,
  error: ["#F87171", "#EF4444"] as const,
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
  badgeHeight: 24,
  segmentedHeight: 40,
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
    shadowColor: "#5B8DEF",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  cardSmall: {
    shadowColor: "#5B8DEF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  fab: {
    shadowColor: "#4169E1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  button: {
    shadowColor: "#5B8DEF",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  glass: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
};

export const BlurIntensity = {
  glass: 20,
  subtle: 10,
  strong: 40,
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
