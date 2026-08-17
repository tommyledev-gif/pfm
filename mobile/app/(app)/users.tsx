import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ChevronLeftIcon, PlusIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useUsersQuery } from "@/features/users/api/use-users-query";
import { UserListItem } from "@/features/users/components/UserListItem";
import { InviteUserModal } from "@/features/users/components/InviteUserModal";

// Household Members screen — backend enforces admin-only access on
// GET/POST /admin/users* (403 for members); mobile does not add a
// client-side gate, same precedent as frontend/src/app/app/users/page.tsx.
export default function UsersScreen() {
  const router = useRouter();
  const users = useUsersQuery();
  const [inviteOpen, setInviteOpen] = useState(false);

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>Household Members</Text>
        <Pressable style={styles.addButton} onPress={() => setInviteOpen(true)} hitSlop={8}>
          <PlusIcon size={16} color={colors.onGreen} />
        </Pressable>
      </View>

      {users.isLoading ? (
        <ActivityIndicator color={colors.green} style={styles.loader} />
      ) : (
        <FlatList
          data={users.data?.data ?? []}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          renderItem={({ item }) => <UserListItem user={item} />}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {users.isError ? "Failed to load members." : "No members yet — tap + to invite one."}
            </Text>
          }
        />
      )}

      <InviteUserModal visible={inviteOpen} onClose={() => setInviteOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: { flex: 1, ...typography.title, color: colors.textPrimary },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  loader: { marginTop: spacing.xxl },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
