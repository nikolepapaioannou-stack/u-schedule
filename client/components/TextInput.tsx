import React from "react";
import {
  StyleSheet,
  View,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
} from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface TextInputProps extends RNTextInputProps {
  label?: string;
  error?: string;
  rightIcon?: React.ReactNode;
}

export function TextInput({
  label,
  error,
  rightIcon,
  style,
  ...props
}: TextInputProps) {
  const { theme } = useTheme();

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
            borderColor: error ? theme.error : theme.border,
            backgroundColor: theme.backgroundDefault,
          },
        ]}
      >
        <RNTextInput
          style={[
            styles.input,
            { color: theme.text },
            style,
          ]}
          placeholderTextColor={theme.textSecondary}
          {...props}
        />
        {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
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
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  rightIcon: {
    marginLeft: Spacing.sm,
  },
  error: {
    marginTop: Spacing.xs,
  },
});
