import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { apiRequest, getApiUrl, queryClient } from "@/lib/query-client";

interface User {
  id: string;
  email: string;
  ugrId: string;
  isAdmin: boolean;
  role: string;
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
    
    // Clear all cached queries so they refetch with new auth token
    queryClient.clear();
  }

  async function register(email: string, password: string, ugrId: string) {
    const response = await apiRequest("POST", "/api/auth/register", { email, password, ugrId });
    const data = await response.json();
    
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    
    // Clear all cached queries so they refetch with new auth token
    queryClient.clear();
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
    
    // Clear all cached queries when logging out
    queryClient.clear();
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
  const { logout, token: contextToken, isLoading } = useAuth();
  
  return useCallback(async (path: string, options: RequestInit = {}, retries = 2) => {
    console.log("[authFetch] Starting request to:", path, "method:", options.method || "GET");
    
    // Wait briefly if auth is still loading
    if (isLoading) {
      console.log("[authFetch] Auth still loading, waiting...");
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Try context token first, fall back to AsyncStorage for fresh reads
    let currentToken = contextToken;
    if (!currentToken) {
      console.log("[authFetch] No context token, trying AsyncStorage...");
      try {
        currentToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        console.log("[authFetch] AsyncStorage token:", currentToken ? "found" : "not found");
      } catch (e) {
        console.error("[authFetch] Failed to read token from storage:", e);
      }
    }
    
    if (!currentToken) {
      console.error("[authFetch] No token available!");
      throw new Error("Δεν υπάρχει συνεδρία - παρακαλώ συνδεθείτε ξανά");
    }
    
    const baseUrl = getApiUrl();
    const fullUrl = new URL(path, baseUrl).toString();
    console.log("[authFetch] Making request to:", fullUrl);
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(fullUrl, {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json",
          },
        });
        
        console.log("[authFetch] Response status:", response.status);
        
        // Handle 401 - session expired or invalid
        if (response.status === 401) {
          await logout();
          throw new Error("Η συνεδρία έληξε - παρακαλώ συνδεθείτε ξανά");
        }
        
        // Handle 403 - permission denied (don't logout, just show error)
        if (response.status === 403) {
          const error = await response.json().catch(() => ({ error: "Δεν έχετε δικαιώματα για αυτή την ενέργεια" }));
          throw new Error(error.error || "Δεν έχετε δικαιώματα για αυτή την ενέργεια");
        }
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: "Σφάλμα δικτύου" }));
          console.error("[authFetch] Error response:", error);
          throw new Error(error.error || "Σφάλμα αιτήματος");
        }
        
        const data = await response.json();
        console.log("[authFetch] Success, data received");
        return data;
      } catch (e) {
        console.error("[authFetch] Caught error:", e);
        lastError = e instanceof Error ? e : new Error(String(e));
        // Retry on network errors (different messages on web vs native)
        const isNetworkError = 
          e instanceof TypeError ||
          lastError.message.includes("Failed to fetch") ||
          lastError.message.includes("Network request failed") ||
          lastError.message.includes("network");
        if (attempt < retries && isNetworkError) {
          console.log("[authFetch] Network error, retrying...", attempt + 1);
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }
    }
    
    throw lastError || new Error("Σφάλμα αιτήματος");
  }, [logout, contextToken, isLoading]);
}
