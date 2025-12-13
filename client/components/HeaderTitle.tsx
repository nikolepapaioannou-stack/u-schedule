import React from "react";
import { View, StyleSheet } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { LogoBrand } from "@/components/LogoBrand";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface HeaderTitleProps {
  title?: string;
  subtitle?: string;
  showLogo?: boolean;
}

export function HeaderTitle({ title, subtitle, showLogo = false }: HeaderTitleProps) {
  const { theme } = useTheme();

  if (showLogo || subtitle) {
    return (
      <View style={styles.columnContainer}>
        <LogoBrand size="small" />
        {subtitle ? (
          <ThemedText type="small" style={[styles.subtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LogoBrand size="small" />
      {title ? <ThemedText style={styles.title}>{title}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  columnContainer: {
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    marginLeft: Spacing.sm,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
});
