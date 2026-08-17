import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { PillTag } from "@/components/ui/PillTag";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { User } from "@/features/users/types";

const STATUS_COLOR: Record<User["status"], string> = {
  active: colors.green,
  pending: colors.mustard,
  disabled: colors.peach,
};

export function UserListItem({ user }: { user: User }) {
  const displayName = user.full_name ?? user.email.split("@")[0];

  return (
    <View style={styles.row}>
      <Avatar name={displayName} size={40} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
      </View>
      <View style={styles.tags}>
        <PillTag label={user.role === "admin" ? "Admin" : "Member"} />
        <Text style={[styles.status, { color: STATUS_COLOR[user.status] }]}>{user.status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: radii.listCard,
  },
  info: { flex: 1, gap: 2 },
  name: { ...typography.body, color: colors.textPrimary },
  email: { ...typography.tiny, color: colors.textSecondary },
  tags: { alignItems: "flex-end", gap: spacing.xs },
  status: { ...typography.tiny, textTransform: "capitalize" },
});
