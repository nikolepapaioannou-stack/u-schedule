import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { AppIcon } from "@/components/AppIcon";

import AdminDashboardScreen from "@/screens/AdminDashboardScreen";
import PendingApprovalsScreen from "@/screens/PendingApprovalsScreen";
import CalendarScreen from "@/screens/CalendarScreen";
import SettingsScreen from "@/screens/SettingsScreen";
import UserManagementScreen from "@/screens/UserManagementScreen";

export type AdminTabParamList = {
  Dashboard: undefined;
  Pending: undefined;
  Calendar: undefined;
  Users: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

export default function AdminTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={AdminDashboardScreen}
        options={{
          title: "Πίνακας",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="view-grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Pending"
        component={PendingApprovalsScreen}
        options={{
          title: "Εκκρεμείς",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="clock-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Calendar"
        component={CalendarScreen}
        options={{
          title: "Ημερολόγιο",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Users"
        component={UserManagementScreen}
        options={{
          title: "Χρήστες",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="account-group-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "Ρυθμίσεις",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="cog-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
