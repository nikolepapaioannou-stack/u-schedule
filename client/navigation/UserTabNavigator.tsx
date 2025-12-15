import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { AppIcon } from "@/components/AppIcon";
import { useAuthenticatedFetch } from "@/lib/auth";

import SearchScreen from "@/screens/SearchScreen";
import MyBookingsScreen from "@/screens/MyBookingsScreen";
import UserExamCalendarScreen from "@/screens/UserExamCalendarScreen";
import NotificationsScreen from "@/screens/NotificationsScreen";
import ProfileScreen from "@/screens/ProfileScreen";

export type UserTabParamList = {
  Search: undefined;
  MyBookings: undefined;
  ExamCalendar: undefined;
  Notifications: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<UserTabParamList>();

export default function UserTabNavigator() {
  const { theme, isDark } = useTheme();
  const authFetch = useAuthenticatedFetch();
  
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: () => authFetch("/api/notifications/unread-count"),
    refetchInterval: 30000,
  });
  const unreadCount = unreadData?.count || 0;

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
            <AppIcon name="file-document-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ExamCalendar"
        component={UserExamCalendarScreen}
        options={{
          title: "Ημερολόγιο",
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
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.primary },
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
