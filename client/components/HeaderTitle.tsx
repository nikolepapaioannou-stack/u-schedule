import React from "react";
import { View, StyleSheet, Image } from "react-native";

import { ThemedText } from "@/components/ThemedText";
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
        <View style={styles.row}>
          <Image
            source={require("../../assets/images/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
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
      <Image
        source={require("../../assets/images/logo.png")}
        style={styles.logoSmall}
        resizeMode="contain"
      />
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
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 140,
    height: 40,
  },
  logoSmall: {
    width: 100,
    height: 28,
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
