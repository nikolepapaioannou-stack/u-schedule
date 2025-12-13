import React, { ReactNode } from "react";
import { StyleSheet, Pressable, ViewStyle, StyleProp, Platform, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Shadows, GradientColors } from "@/constants/theme";

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "success" | "danger";
  size?: "default" | "small" | "large";
  icon?: ReactNode;
  haptics?: boolean;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
  energyThreshold: 0.001,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({
  onPress,
  children,
  style,
  disabled = false,
  variant = "primary",
  size = "default",
  icon,
  haptics = true,
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98, springConfig);
      opacity.value = withSpring(0.7, springConfig);
      if (haptics && Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, springConfig);
      opacity.value = withSpring(1, springConfig);
    }
  };

  const getHeight = () => {
    switch (size) {
      case "small":
        return 36;
      case "large":
        return 56;
      default:
        return Spacing.buttonHeight;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case "small":
        return 14;
      case "large":
        return 18;
      default:
        return 16;
    }
  };

  const getGradientColors = () => {
    if (disabled) return ["#E5E7EB", "#E5E7EB"] as const;
    switch (variant) {
      case "success":
        return GradientColors.success;
      case "danger":
        return GradientColors.error;
      default:
        return GradientColors.primary;
    }
  };

  const getTextColor = () => {
    if (disabled) return theme.disabledText;
    switch (variant) {
      case "secondary":
      case "ghost":
        return theme.primary;
      default:
        return theme.buttonText;
    }
  };

  const isPrimaryVariant = variant === "primary" || variant === "success" || variant === "danger";

  const buttonContent = (
    <View style={styles.contentContainer}>
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <ThemedText
        type="body"
        style={[
          styles.buttonText,
          { color: getTextColor(), fontSize: getFontSize() },
        ]}
      >
        {children}
      </ThemedText>
    </View>
  );

  if (isPrimaryVariant && !disabled) {
    return (
      <AnimatedPressable
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.button,
          { height: getHeight() },
          !disabled && Shadows.button,
          animatedStyle,
          style,
        ]}
      >
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, { borderRadius: BorderRadius.md }]}
        >
          {buttonContent}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.button,
        {
          height: getHeight(),
          backgroundColor: disabled ? "#E5E7EB" : "transparent",
          borderWidth: variant === "secondary" ? 2 : 0,
          borderColor: variant === "secondary" ? theme.primary : undefined,
        },
        animatedStyle,
        style,
      ]}
    >
      {buttonContent}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  gradient: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  contentContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  iconContainer: {
    marginRight: Spacing.sm,
  },
  buttonText: {
    fontWeight: "600",
  },
});
