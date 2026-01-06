import React, { useState, useCallback, useMemo, useRef } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, TextInput, ActivityIndicator, Platform, Alert, TextInput as TextInputType } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, useAuthenticatedFetch } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface DashboardStats {
  todayBookings: number;
  pendingApprovals: number;
  weekBookings: number;
  totalApproved: number;
}

interface RecentBooking {
  id: string;
  departmentId: string;
  candidateCount: number;
  bookingDate: string;
  status: string;
  createdAt: string;
}

const STATUS_CONFIG = {
  holding: { label: "Σε Αναμονή", color: "statusPending", icon: "clock" },
  pending: { label: "Υποβλήθηκε", color: "warning", icon: "send" },
  approved: { label: "Εγκρίθηκε", color: "statusApproved", icon: "check-circle" },
  rejected: { label: "Απορρίφθηκε", color: "statusRejected", icon: "x-circle" },
} as const;

export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const authFetch = useAuthenticatedFetch();

  const [stats, setStats] = useState<DashboardStats>({
    todayBookings: 0,
    pendingApprovals: 0,
    weekBookings: 0,
    totalApproved: 0,
  });
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchType, setSearchType] = useState<'auto' | 'confirmationNumber' | 'departmentId' | 'centerId'>('auto');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const searchInputRef = useRef<TextInputType>(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [bookingsData, statsData] = await Promise.all([
        authFetch("/api/bookings"),
        authFetch("/api/admin/stats").catch(() => null),
      ]);

      const allBookings = bookingsData || [];

      if (statsData) {
        setStats({
          todayBookings: statsData.todayBookings,
          pendingApprovals: statsData.pendingApprovals,
          weekBookings: statsData.weekBookings,
          totalApproved: statsData.totalApproved,
        });
      } else {
        const today = new Date().toISOString().split("T")[0];
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekStartStr = weekStart.toISOString().split("T")[0];
        const weekEndStr = weekEnd.toISOString().split("T")[0];

        const todayBookings = allBookings.filter((b: any) => b.bookingDate === today && b.status === "approved").length;
        const pendingApprovals = allBookings.filter((b: any) => b.status === "pending").length;
        const weekBookings = allBookings.filter((b: any) => b.bookingDate >= weekStartStr && b.bookingDate <= weekEndStr && b.status === "approved").length;
        const totalApproved = allBookings.filter((b: any) => b.status === "approved").length;

        setStats({ todayBookings, pendingApprovals, weekBookings, totalApproved });
      }
      
      const recent = allBookings
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      setRecentBookings(recent);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authFetch]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [fetchDashboardData])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  const handleSearch = async () => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) return;
    
    setIsSearching(true);
    setSearchResults(null);
    try {
      // Use /find endpoint (renamed from /search to bypass cached responses)
      const result = await authFetch(`/api/admin/bookings/find?query=${encodeURIComponent(trimmedQuery)}&type=${searchType}`);
      
      // Check if we got multiple results
      if (result && result.bookings && Array.isArray(result.bookings)) {
        if (result.bookings.length === 1) {
          // Single result, navigate directly
          setSearchQuery("");
          navigation.navigate("BookingDetails", { bookingId: result.bookings[0].id });
        } else {
          // Multiple results, show in list
          setSearchResults(result.bookings);
        }
      } else if (result && result.id) {
        // Single booking returned
        setSearchQuery("");
        navigation.navigate("BookingDetails", { bookingId: result.id });
      }
    } catch (error: any) {
      const message = error?.message || "Δεν βρέθηκαν κρατήσεις";
      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Αποτέλεσμα Αναζήτησης", message);
      }
    } finally {
      setIsSearching(false);
    }
  };
  
  const clearSearchResults = () => {
    setSearchResults(null);
    setSearchQuery("");
  };

  const searchTypeLabels = {
    auto: 'Αυτόματη',
    confirmationNumber: 'Αρ. Επιβεβαίωσης',
    departmentId: 'Κωδ. Τμήματος',
    centerId: 'Κωδ. Κέντρου',
  };
  
  const searchPlaceholders = {
    auto: 'Αναζήτηση...',
    confirmationNumber: 'π.χ. 000001',
    departmentId: 'π.χ. 75023',
    centerId: 'π.χ. 0454',
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("el-GR", {
      day: "2-digit",
      month: "short",
    });
  };

  const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) => (
    <Card elevation={1} style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <MaterialCommunityIcons name={icon as any} size={24} color={color} />
      </View>
      <ThemedText type="hero" style={{ marginTop: Spacing.sm }}>{value}</ThemedText>
      <ThemedText type="small" style={{ color: theme.textSecondary }}>{label}</ThemedText>
    </Card>
  );

  const renderBookingItem = ({ item }: { item: RecentBooking }) => {
    const statusConfig = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    const statusColor = theme[statusConfig.color as keyof typeof theme] as string;

    return (
      <Pressable
        onPress={() => navigation.navigate("BookingDetails", { bookingId: item.id })}
        style={({ pressed }) => [
          styles.bookingItem,
          { backgroundColor: pressed ? theme.backgroundSecondary : theme.backgroundDefault },
        ]}
      >
        <View style={styles.bookingInfo}>
          <ThemedText type="h4">Τμήμα {item.departmentId}</ThemedText>
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {formatDate(item.bookingDate)} - {item.candidateCount} υποψήφιοι
          </ThemedText>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
          <MaterialCommunityIcons name={statusConfig.icon as any} size={12} color={statusColor} />
          <ThemedText type="caption" style={{ color: statusColor, marginLeft: 4 }}>
            {statusConfig.label}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  const ListHeader = useMemo(() => (
    <View style={styles.header}>
      <View style={styles.statsGrid}>
        <StatCard icon="calendar" label="Σήμερα" value={stats.todayBookings} color={theme.primary} />
        <StatCard icon="clock" label="Εκκρεμείς" value={stats.pendingApprovals} color={theme.warning} />
        <StatCard icon="trending-up" label="Εβδομάδα" value={stats.weekBookings} color={theme.secondary} />
        <StatCard icon="check-circle" label="Εγκεκριμένες" value={stats.totalApproved} color={theme.success} />
      </View>

      <View style={styles.sectionHeader}>
        <ThemedText type="h3">Πρόσφατες Κρατήσεις</ThemedText>
      </View>
    </View>
  ), [stats, theme]);

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialCommunityIcons name="inbox" size={48} color={theme.textSecondary} />
      <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.lg, textAlign: "center" }}>
        Δεν υπάρχουν πρόσφατες κρατήσεις
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.fixedSearchContainer, { paddingTop: insets.top + Spacing.xl }]}>
        <View style={styles.headerTop}>
          <HeaderTitle title="ExamScheduler" />
          <ThemedText type="body" style={{ color: theme.textSecondary, marginTop: Spacing.sm }}>
            Καλώς ήρθατε, Διαχειριστή
          </ThemedText>
        </View>
        <Card elevation={1} style={styles.searchCard}>
          <View style={styles.searchHeader}>
            <Feather name="search" size={16} color={theme.primary} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>Αναζήτηση Κράτησης</ThemedText>
          </View>
          <View style={styles.searchTypeRow}>
            {(['auto', 'confirmationNumber', 'departmentId', 'centerId'] as const).map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.searchTypeButton,
                  { 
                    backgroundColor: searchType === type ? theme.primary : theme.backgroundSecondary,
                    borderColor: searchType === type ? theme.primary : theme.border,
                  }
                ]}
                onPress={() => setSearchType(type)}
              >
                <ThemedText 
                  type="caption" 
                  style={{ color: searchType === type ? '#fff' : theme.text }}
                >
                  {searchTypeLabels[type]}
                </ThemedText>
              </Pressable>
            ))}
          </View>
          <View style={styles.searchRow}>
            <TextInput
              ref={searchInputRef}
              style={[
                styles.searchInput,
                { 
                  backgroundColor: theme.backgroundSecondary, 
                  color: theme.text,
                  borderColor: theme.border,
                }
              ]}
              placeholder={searchPlaceholders[searchType]}
              placeholderTextColor={theme.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable
              style={[
                styles.searchButton,
                { backgroundColor: theme.primary, opacity: isSearching || !searchQuery.trim() ? 0.6 : 1 }
              ]}
              onPress={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="arrow-right" size={18} color="#fff" />
              )}
            </Pressable>
          </View>
        </Card>
        
        {searchResults && searchResults.length > 0 ? (
          <Card elevation={1} style={styles.searchResultsCard}>
            <View style={styles.searchResultsHeader}>
              <ThemedText type="h4">Αποτελέσματα ({searchResults.length})</ThemedText>
              <Pressable onPress={clearSearchResults}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            {searchResults.map((booking) => {
              const statusConfig = STATUS_CONFIG[booking.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
              const statusColor = theme[statusConfig.color as keyof typeof theme] as string;
              return (
                <Pressable
                  key={booking.id}
                  style={({ pressed }) => [
                    styles.searchResultItem,
                    { backgroundColor: pressed ? theme.backgroundSecondary : 'transparent' }
                  ]}
                  onPress={() => {
                    clearSearchResults();
                    navigation.navigate("BookingDetails", { bookingId: booking.id });
                  }}
                >
                  <View style={styles.searchResultInfo}>
                    <ThemedText type="body" style={{ fontWeight: '600' }}>
                      {booking.confirmationNumber ? `#${booking.confirmationNumber}` : 'Χωρίς αριθμό'}
                    </ThemedText>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Τμ: {booking.departmentId} {booking.centerId ? `| Κέντρο: ${booking.centerId}` : ''}
                    </ThemedText>
                    <ThemedText type="caption" style={{ color: theme.textSecondary }}>
                      {formatDate(booking.bookingDate)} - {booking.candidateCount} υποψ.
                    </ThemedText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                    <MaterialCommunityIcons name={statusConfig.icon as any} size={12} color={statusColor} />
                    <ThemedText type="caption" style={{ color: statusColor, marginLeft: 4 }}>
                      {statusConfig.label}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </Card>
        ) : null}
      </View>
      <FlatList
        data={recentBookings}
        keyExtractor={(item) => item.id}
        renderItem={renderBookingItem}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={!isLoading ? renderEmptyState : null}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={theme.primary}
          />
        }
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: theme.border }]} />}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fixedSearchContainer: {
    paddingHorizontal: Spacing.xl,
  },
  headerTop: {
    marginBottom: Spacing.sm,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.xl,
    marginHorizontal: -Spacing.xs,
  },
  statCard: {
    width: "48%",
    marginHorizontal: "1%",
    marginBottom: Spacing.md,
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeader: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  bookingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  bookingInfo: {
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  separator: {
    height: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  searchCard: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    fontSize: 16,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  searchTypeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  searchTypeButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  searchResultsCard: {
    marginTop: Spacing.md,
  },
  searchResultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  searchResultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  searchResultInfo: {
    flex: 1,
    gap: 2,
  },
});
