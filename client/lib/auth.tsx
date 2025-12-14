import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { apiRequest, getApiUrl } from "@/lib/query-client";

interface User {
  id: string;
  email: string;
  ugrId: string;
  isAdmin: boolean;
  biometricEnabled?: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, ugrId: string) => Promise<void>;
  logout: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const AUTH_TOKEN_KEY = "@exam_scheduler_token";
const BIOMETRIC_EMAIL_KEY = "exam_scheduler_biometric_email";
const BIOMETRIC_PASSWORD_KEY = "exam_scheduler_biometric_password";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
      if (storedToken) {
        setToken(storedToken);
        await fetchUser(storedToken);
      }
    } catch (error) {
      console.error("Failed to load auth:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUser(authToken: string) {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(new URL("/api/auth/me", baseUrl).toString(), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
    }
  }

  async function login(email: string, password: string) {
    const response = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await response.json();
    
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function register(email: string, password: string, ugrId: string) {
    const response = await apiRequest("POST", "/api/auth/register", { email, password, ugrId });
    const data = await response.json();
    
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }

  async function logout() {
    try {
      if (token) {
        const baseUrl = getApiUrl();
        await fetch(new URL("/api/auth/logout", baseUrl).toString(), {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    }
    
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  async function setBiometricEnabled(enabled: boolean) {
    if (!token) return;
    
    const baseUrl = getApiUrl();
    await fetch(new URL("/api/auth/biometric", baseUrl).toString(), {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ enabled }),
    });
    
    if (!enabled && Platform.OS !== "web") {
      await SecureStore.deleteItemAsync(BIOMETRIC_EMAIL_KEY);
      await SecureStore.deleteItemAsync(BIOMETRIC_PASSWORD_KEY);
    }
    
    if (user) {
      setUser({ ...user, biometricEnabled: enabled });
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
        setBiometricEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function useAuthenticatedFetch() {
  const { token } = useAuth();
  
  return async (path: string, options: RequestInit = {}) => {
    const baseUrl = getApiUrl();
    const response = await fetch(new URL(path, baseUrl).toString(), {
      ...options,
      headers: {
        ...options.headers,
        Authorization: token ? `Bearer ${token}` : "",
        "Content-Type": "application/json",
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Σφάλμα δικτύου" }));
      throw new Error(error.error || "Σφάλμα αιτήματος");
    }
    
    return response.json();
  };
}
