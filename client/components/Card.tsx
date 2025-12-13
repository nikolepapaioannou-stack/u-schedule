import React from "react";
import { StyleSheet, Pressable, ViewStyle, Platform, View } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows, BlurIntensity } from "@/constants/theme";

interface CardProps {
  elevation?: number;
  variant?: "default" | "glass" | "outlined";
  title?: string;
  description?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  haptics?: boolean;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const getBackgroundColorForElevation = (
  elevation: number,
  theme: any,
): string => {
  switch (elevation) {
    case 1:
      return theme.backgroundDefault;
    case 2:
      return theme.backgroundSecondary;
    case 3:
      return theme.backgroundTertiary;
    default:
      return theme.backgroundRoot;
  }
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Card({
  elevation = 1,
  variant = "default",
  title,
  description,
  children,
  onPress,
  style,
  haptics = true,
}: CardProps) {
  const { theme, isDark } = useTheme();
  const scale = useSharedValue(1);

  const isGlass = variant === "glass";
  const isOutlined = variant === "outlined";
  const cardBackgroundColor = isGlass
    ? theme.glassSurface
    : isOutlined
      ? "transparent"
      : getBackgroundColorForElevation(elevation, theme);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, springConfig);
    if (haptics && Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springConfig);
  };

  const cardContent = (
    <>
      {title ? (
        <ThemedText type="h4" style={styles.cardTitle}>
          {title}
        </ThemedText>
      ) : null}
      {description ? (
        <ThemedText type="small" style={styles.cardDescription}>
          {description}
        </ThemedText>
      ) : null}
      {children}
    </>
  );

  const cardStyles = [
    styles.card,
    isGlass ? Shadows.glass : elevation >= 1 ? Shadows.cardSmall : null,
    isOutlined && {
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: "transparent",
    },
    isGlass && {
      borderWidth: 1,
      borderColor: theme.glassBorder,
      overflow: "hidden" as const,
    },
    !isGlass && !isOutlined && { backgroundColor: cardBackgroundColor },
    animatedStyle,
    style,
  ];

  if (isGlass && Platform.OS !== "web") {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={cardStyles}
      >
        <BlurView
          intensity={BlurIntensity.glass}
          tint={isDark ? "dark" : "light"}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardContentContainer}>{cardContent}</View>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        cardStyles,
        isGlass && { backgroundColor: cardBackgroundColor },
      ]}
    >
      {cardContent}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  cardContentContainer: {
    padding: Spacing.lg,
  },
  cardTitle: {
    marginBottom: Spacing.sm,
  },
  cardDescription: {
    opacity: 0.7,
  },
});
