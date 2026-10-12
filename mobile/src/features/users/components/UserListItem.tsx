import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { PillTag } from "@/components/ui/PillTag";
import { colors, radii, spacing, typography, createStyles } from "@/lib/theme";
import { User } from "@/features/users/types";
import { AccessRequestActions } from "@/features/users/components/AccessRequestActions";
import { ResendInviteButton } from "@/features/users/components/ResendInviteButton";
import { RevokeSessionsButton } from "@/features/users/components/RevokeSessionsButton";
import { useCurrentUserId } from "@/stores/use-current-user-id";

// Getters, not values: read at render time so they follow a theme switch
// (see src/theme/active-palette.ts).
const STATUS_COLOR: Record<User["status"], string> = {
  get requested() { return colors.lavender; },
  get active() { return colors.green; },
  get pending() { return colors.mustard; },
  get disabled() { return colors.peach; },
};

const STATUS_LABEL: Record<User["status"], string> = {
  requested: "Chờ duyệt",
  pending: "Chờ kích hoạt",
  active: "Đang dùng",
  disabled: "Đã khóa",
};

export function UserListItem({ user }: { user: User }) {
  const styles = useStyles();
  const currentUserId = useCurrentUserId();
  const displayName = user.full_name ?? user.email.split("@")[0];

  return (
    <View style={styles.row}>
      <Avatar name={displayName} size={40} fallback="initial" />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
        {/* A request from the login screen: approving sends the activation
            email, rejecting removes the request. */}
        {user.status === "requested" ? <AccessRequestActions userId={user.id} email={user.email} /> : null}
        {user.status === "pending" && user.invite_resend_available_at ? (
          <ResendInviteButton userId={user.id} availableAt={user.invite_resend_available_at} />
        ) : null}
        {/* Active Users other than yourself only (spec AC-42); you sign
            yourself out from the Security screen. */}
        {user.status === "active" && user.id !== currentUserId ? (
          <RevokeSessionsButton userId={user.id} email={user.email} />
        ) : null}
      </View>
      <View style={styles.tags}>
        <PillTag color={user.role === "admin" ? "success" : "info"} label={user.role === "admin" ? "Admin" : "Member"} />
        <Text style={[styles.status, { color: STATUS_COLOR[user.status] }]}>{STATUS_LABEL[user.status]}</Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
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
  status: { ...typography.tiny },
}));
