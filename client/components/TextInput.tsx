import React, { useState } from "react";
import {
  StyleSheet,
  View,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
  Platform,
} from "react-native";
import { BlurView } from "expo-blur";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, BlurIntensity } from "@/constants/theme";

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  rightIcon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  variant?: "default" | "glass";
}

export function TextInput({
  label,
  error,
  rightIcon,
  leftIcon,
  variant = "default",
  style,
  onFocus,
  onBlur,
  ...props
}: TextInputProps) {
  const { theme, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  const handleFocus = (e: any) => {
    setIsFocused(true);
    onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    setIsFocused(false);
    onBlur?.(e);
  };

  const getBorderColor = () => {
    if (error) return theme.error;
    if (isFocused) return theme.primary;
    return theme.inputBorder;
  };

  const getBorderWidth = () => {
    if (error || isFocused) return 2;
    return 1.5;
  };

  const isGlass = variant === "glass";
  const backgroundColor = isGlass ? theme.inputBackground : theme.backgroundDefault;

  const inputContent = (
    <>
      {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
      <RNTextInput
        style={[
          styles.input,
          { color: theme.text },
          leftIcon ? { paddingLeft: 0 } : null,
          style,
        ]}
        placeholderTextColor={theme.textSecondary}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
    </>
  );

  return (
    <View style={styles.container}>
      {label ? (
        <ThemedText type="small" style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </ThemedText>
      ) : null}
      <View
        style={[
          styles.inputContainer,
          {
            borderColor: getBorderColor(),
            borderWidth: getBorderWidth(),
            backgroundColor: isGlass && Platform.OS !== "web" ? "transparent" : backgroundColor,
          },
          isFocused && !error && styles.focusedGlow,
        ]}
      >
        {isGlass && Platform.OS !== "web" ? (
          <BlurView
            intensity={BlurIntensity.subtle}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : null}
        {inputContent}
      </View>
      {error ? (
        <ThemedText type="small" style={[styles.error, { color: theme.error }]}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    marginBottom: Spacing.xs,
    fontWeight: "500",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  leftIcon: {
    marginRight: Spacing.sm,
  },
  rightIcon: {
    marginLeft: Spacing.sm,
  },
  error: {
    marginTop: Spacing.xs,
  },
  focusedGlow: {
    shadowColor: "#5B8DEF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
