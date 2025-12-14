import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { AppIcon } from "@/components/AppIcon";

import SearchScreen from "@/screens/SearchScreen";
import MyBookingsScreen from "@/screens/MyBookingsScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import ProfileScreen from "@/screens/ProfileScreen";

export type UserTabParamList = {
  Search: undefined;
  MyBookings: undefined;
  Notifications: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<UserTabParamList>();

export default function UserTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Search"
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
        name="Search"
        component={SearchScreen}
        options={{
          title: "Αναζήτηση",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="magnify" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MyBookings"
        component={MyBookingsScreen}
        options={{
          title: "Κρατήσεις",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          title: "Ειδοποιήσεις",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="bell-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: "Προφίλ",
          tabBarIcon: ({ color, size }) => (
            <AppIcon name="account-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
