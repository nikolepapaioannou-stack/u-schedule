import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "@/lib/auth";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";

import LoginScreen from "@/screens/LoginScreen";
import RegisterScreen from "@/screens/RegisterScreen";
import UserTabNavigator from "@/navigation/UserTabNavigator";
import AdminTabNavigator from "@/navigation/AdminTabNavigator";
import AvailableSlotsScreen from "@/screens/AvailableSlotsScreen";
import HoldCountdownScreen from "@/screens/HoldCountdownScreen";
import BookingDetailsScreen from "@/screens/BookingDetailsScreen";

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  UserMain: undefined;
  AdminMain: undefined;
  AvailableSlots: {
    departmentId: string;
    candidateCount: number;
    courseEndDate: string;
    preferredShift: string;
  };
  HoldCountdown: {
    bookingId: string;
  };
  BookingDetails: {
    bookingId: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const { user, isLoading } = useAuth();
  const { theme } = useTheme();
  const screenOptions = useScreenOptions();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: theme.backgroundRoot }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!user ? (
        <>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerTitle: "Εγγραφή" }}
          />
        </>
      ) : user.isAdmin ? (
        <>
          <Stack.Screen
            name="AdminMain"
            component={AdminTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="BookingDetails"
            component={BookingDetailsScreen}
            options={{ headerTitle: "Λεπτομέρειες Κράτησης" }}
          />
        </>
      ) : (
        <>
          <Stack.Screen
            name="UserMain"
            component={UserTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="AvailableSlots"
            component={AvailableSlotsScreen}
            options={{ headerTitle: "Διαθέσιμες Θέσεις" }}
          />
          <Stack.Screen
            name="HoldCountdown"
            component={HoldCountdownScreen}
            options={{ 
              headerTitle: "Επιβεβαίωση Κράτησης",
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="BookingDetails"
            component={BookingDetailsScreen}
            options={{ headerTitle: "Λεπτομέρειες Κράτησης" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
