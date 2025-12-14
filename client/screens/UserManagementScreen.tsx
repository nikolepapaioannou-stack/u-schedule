import React, { useState, useCallback } from "react";
import { StyleSheet, View, Alert, Pressable, Modal, FlatList, ActivityIndicator, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { TextInput } from "@/components/TextInput";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, useAuthenticatedFetch } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";

type UserRole = "user" | "admin" | "superadmin";

interface User {
  id: string;
  email: string;
  ugrId: string;
  role: UserRole;
  isAdmin: boolean;
  createdAt: string;
}

const roleLabels: Record<UserRole, string> = {
  user: "Χρήστης",
  admin: "Διαχειριστής",
  superadmin: "Κεντρικός Διαχειριστής",
};

const roleColors: Record<UserRole, { bg: string; text: string }> = {
  user: { bg: "#E3F2FD", text: "#1565C0" },
  admin: { bg: "#FFF3E0", text: "#E65100" },
  superadmin: { bg: "#FCE4EC", text: "#C2185B" },
};

export default function UserManagementScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user: currentUser, isLoading: isAuthLoading } = useAuth();
  const authFetch = useAuthenticatedFetch();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newUgrId, setNewUgrId] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [isCreating, setIsCreating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isSuperAdmin = currentUser?.role === "superadmin";

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await authFetch("/api/admin/users");
      if (data) {
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users:", error);
      // Don't show alert if session is missing - user will be redirected to login
      if (error instanceof Error && !error.message.includes("συνεδρία") && !error.message.includes("Failed to fetch")) {
        Alert.alert("Σφάλμα", "Δεν ήταν δυνατή η φόρτωση των χρηστών");
      }
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  // Effect to handle initial loading state when no user is available
  React.useEffect(() => {
    if (!isAuthLoading && !currentUser) {
      // Auth finished loading but no user - stop loading
      setIsLoading(false);
    }
  }, [isAuthLoading, currentUser]);

  useFocusEffect(
    useCallback(() => {
      // Wait for auth to finish loading before fetching users
      if (!isAuthLoading && currentUser) {
        fetchUsers();
      }
    }, [fetchUsers, isAuthLoading, currentUser])
  );

  const handleCreateUser = async () => {
    if (!newEmail || !newPassword || !newUgrId) {
      Alert.alert("Σφάλμα", "Παρακαλώ συμπληρώστε όλα τα πεδία");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Σφάλμα", "Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες");
      return;
    }

    setIsCreating(true);
    try {
      const response = await authFetch("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          ugrId: newUgrId,
          role: newRole,
        }),
      });

      if (response) {
        Alert.alert("Επιτυχία", "Ο χρήστης δημιουργήθηκε επιτυχώς");
        setShowCreateModal(false);
        setNewEmail("");
        setNewPassword("");
        setNewUgrId("");
        setNewRole("user");
        fetchUsers();
      }
    } catch (error: any) {
      console.error("Failed to create user:", error);
      Alert.alert("Σφάλμα", error.message || "Δεν ήταν δυνατή η δημιουργία του χρήστη");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    try {
      await authFetch(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        body: JSON.stringify({ role }),
      });
      Alert.alert("Επιτυχία", "Ο ρόλος ενημερώθηκε");
      setShowRoleModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      console.error("Failed to update role:", error);
      Alert.alert("Σφάλμα", error.message || "Δεν ήταν δυνατή η ενημέρωση του ρόλου");
    }
  };

  const handleDeleteUser = (user: User) => {
    if (Platform.OS === "web") {
      setUserToDelete(user);
      setShowDeleteModal(true);
    } else {
      Alert.alert(
        "Διαγραφή Χρήστη",
        `Είστε σίγουροι ότι θέλετε να διαγράψετε τον χρήστη ${user.email};`,
        [
          { text: "Ακύρωση", style: "cancel" },
          {
            text: "Διαγραφή",
            style: "destructive",
            onPress: () => confirmDeleteUser(user),
          },
        ]
      );
    }
  };

  const confirmDeleteUser = async (user: User) => {
    setIsDeleting(true);
    try {
      await authFetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
      });
      if (Platform.OS !== "web") {
        Alert.alert("Επιτυχία", "Ο χρήστης διαγράφηκε");
      }
      fetchUsers();
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      if (Platform.OS !== "web") {
        Alert.alert("Σφάλμα", error.message || "Δεν ήταν δυνατή η διαγραφή του χρήστη");
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setUserToDelete(null);
    }
  };

  const renderRoleBadge = (role: UserRole) => {
    const colors = roleColors[role];
    return (
      <View style={[styles.roleBadge, { backgroundColor: colors.bg }]}>
        <ThemedText style={[styles.roleBadgeText, { color: colors.text }]}>
          {roleLabels[role]}
        </ThemedText>
      </View>
    );
  };

  const renderUserItem = ({ item }: { item: User }) => {
    const isCurrentUser = item.id === currentUser?.id;
    const canModify = isSuperAdmin && !isCurrentUser;

    return (
      <Card style={styles.userCard}>
        <View style={styles.userHeader}>
          <View style={styles.userInfo}>
            <ThemedText style={styles.userEmail}>{item.email}</ThemedText>
            <ThemedText style={[styles.userUgr, { color: theme.textSecondary }]}>
              UGR: {item.ugrId}
            </ThemedText>
          </View>
          {renderRoleBadge(item.role)}
        </View>

        {canModify ? (
          <View style={styles.userActions}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundSecondary }]}
              onPress={() => {
                setSelectedUser(item);
                setShowRoleModal(true);
              }}
            >
              <Feather name="edit-2" size={16} color={theme.primary} />
              <ThemedText style={[styles.actionText, { color: theme.primary }]}>
                Αλλαγή Ρόλου
              </ThemedText>
            </Pressable>

            <Pressable
              style={[styles.actionButton, { backgroundColor: "#FFEBEE" }]}
              onPress={() => handleDeleteUser(item)}
            >
              <Feather name="trash-2" size={16} color="#D32F2F" />
              <ThemedText style={[styles.actionText, { color: "#D32F2F" }]}>
                Διαγραφή
              </ThemedText>
            </Pressable>
          </View>
        ) : (
          isCurrentUser ? (
            <ThemedText style={[styles.currentUserLabel, { color: theme.textSecondary }]}>
              (Εσείς)
            </ThemedText>
          ) : null
        )}
      </Card>
    );
  };

  if (isLoading || isAuthLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText style={styles.title}>Διαχείριση Χρηστών</ThemedText>
            <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
              {users.length} χρήστες
            </ThemedText>
            {isSuperAdmin ? (
              <Button
                onPress={() => setShowCreateModal(true)}
                style={styles.createButton}
                icon={<Feather name="user-plus" size={18} color="#FFF" />}
              >
                Νέος Χρήστης
              </Button>
            ) : (
              <ThemedText style={[styles.permissionNote, { color: theme.textSecondary }]}>
                Μόνο ο κεντρικός διαχειριστής μπορεί να δημιουργήσει ή να τροποποιήσει χρήστες
              </ThemedText>
            )}
          </View>
        }
        ListEmptyComponent={
          <Card style={styles.emptyCard}>
            <Feather name="users" size={48} color={theme.textSecondary} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              Δεν υπάρχουν χρήστες
            </ThemedText>
          </Card>
        }
      />

      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <KeyboardAwareScrollViewCompat style={styles.modalScroll}>
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Νέος Χρήστης</ThemedText>
                <Pressable onPress={() => setShowCreateModal(false)}>
                  <Feather name="x" size={24} color={theme.text} />
                </Pressable>
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Email</ThemedText>
                <TextInput
                  value={newEmail}
                  onChangeText={setNewEmail}
                  placeholder="email@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Κωδικός</ThemedText>
                <TextInput
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Τουλάχιστον 6 χαρακτήρες"
                  secureTextEntry
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>UGR ID</ThemedText>
                <TextInput
                  value={newUgrId}
                  onChangeText={setNewUgrId}
                  placeholder="Εισάγετε UGR ID"
                />
              </View>

              <View style={styles.formGroup}>
                <ThemedText style={styles.label}>Ρόλος</ThemedText>
                <View style={styles.roleSelector}>
                  {(["user", "admin", "superadmin"] as UserRole[]).map((role) => {
                    const canSelectRole =
                      role === "user" || (isSuperAdmin && (role === "admin" || role === "superadmin"));
                    return (
                      <Pressable
                        key={role}
                        style={[
                          styles.roleOption,
                          newRole === role && { backgroundColor: theme.primary },
                          !canSelectRole && styles.roleOptionDisabled,
                        ]}
                        onPress={() => canSelectRole && setNewRole(role)}
                        disabled={!canSelectRole}
                      >
                        <ThemedText
                          style={[
                            styles.roleOptionText,
                            newRole === role && { color: "#FFF" },
                            !canSelectRole && { color: theme.textSecondary },
                          ]}
                        >
                          {roleLabels[role]}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <Button
                onPress={handleCreateUser}
                disabled={isCreating}
                style={styles.submitButton}
              >
                {isCreating ? "Δημιουργία..." : "Δημιουργία Χρήστη"}
              </Button>
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showRoleModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowRoleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.roleModalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Αλλαγή Ρόλου</ThemedText>
              <Pressable onPress={() => setShowRoleModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {selectedUser ? (
              <>
                <ThemedText style={[styles.selectedUserEmail, { color: theme.textSecondary }]}>
                  {selectedUser.email}
                </ThemedText>
                <View style={styles.roleList}>
                  {(["user", "admin", "superadmin"] as UserRole[]).map((role) => (
                    <Pressable
                      key={role}
                      style={[
                        styles.roleListItem,
                        { borderColor: theme.border },
                        selectedUser.role === role && { backgroundColor: theme.backgroundSecondary },
                      ]}
                      onPress={() => handleUpdateRole(selectedUser.id, role)}
                    >
                      {renderRoleBadge(role)}
                      {selectedUser.role === role ? (
                        <Feather name="check" size={20} color={theme.primary} />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.roleModalContent, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Διαγραφή Χρήστη</ThemedText>
              <Pressable onPress={() => {
                setShowDeleteModal(false);
                setUserToDelete(null);
              }}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {userToDelete ? (
              <>
                <ThemedText style={styles.deleteWarningText}>
                  Είστε σίγουροι ότι θέλετε να διαγράψετε τον χρήστη{"\n"}
                  <ThemedText style={styles.deleteUserEmail}>{userToDelete.email}</ThemedText>;
                </ThemedText>
                <View style={styles.deleteActions}>
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setShowDeleteModal(false);
                      setUserToDelete(null);
                    }}
                    style={styles.cancelButton}
                  >
                    Ακύρωση
                  </Button>
                  <Button
                    onPress={() => confirmDeleteUser(userToDelete)}
                    disabled={isDeleting}
                    style={[styles.deleteButton, { backgroundColor: "#D32F2F" }]}
                  >
                    {isDeleting ? "Διαγραφή..." : "Διαγραφή"}
                  </Button>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  createButton: {
    marginTop: Spacing.md,
  },
  permissionNote: {
    marginTop: Spacing.md,
    fontSize: 13,
    fontStyle: "italic",
  },
  userCard: {
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  userInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  userEmail: {
    fontSize: 16,
    fontWeight: "600",
  },
  userUgr: {
    fontSize: 13,
    marginTop: Spacing.xs,
  },
  roleBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  userActions: {
    flexDirection: "row",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  currentUserLabel: {
    marginTop: Spacing.sm,
    fontSize: 13,
    fontStyle: "italic",
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  emptyText: {
    marginTop: Spacing.md,
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    maxHeight: "80%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalScroll: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  formGroup: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  roleSelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  roleOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "#DDD",
  },
  roleOptionDisabled: {
    opacity: 0.5,
  },
  roleOptionText: {
    fontSize: 14,
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
  roleModalContent: {
    width: "85%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  selectedUserEmail: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  roleList: {
    gap: Spacing.sm,
  },
  roleListItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  deleteWarningText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: Spacing.lg,
    lineHeight: 24,
  },
  deleteUserEmail: {
    fontWeight: "700",
  },
  deleteActions: {
    flexDirection: "row",
    gap: Spacing.md,
    justifyContent: "center",
  },
  cancelButton: {
    flex: 1,
  },
  deleteButton: {
    flex: 1,
  },
});
