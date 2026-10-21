import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { ListRow } from "@/components/ui/grouped-list";
import { PillTag } from "@/components/ui/PillTag";
import { colors, spacing, typography, createStyles } from "@/lib/theme";
import { User } from "@/features/users/types";
import { AccessRequestActions } from "@/features/users/components/AccessRequestActions";
import { ResendInviteButton } from "@/features/users/components/ResendInviteButton";
import { RevokeSessionsButton } from "@/features/users/components/RevokeSessionsButton";
import { useCurrentUserId } from "@/stores/use-current-user-id";

const AVATAR_SIZE = 36;

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

// Only admins are tagged: on the members screen every other row is a member,
// and a tag on every row says nothing.
const ADMIN_LABEL = "Quản trị";

/** One member as a row of the screen's grouped list; actions sit under the email. */
export function UserListItem({ user }: { user: User }) {
  const styles = useStyles();
  const currentUserId = useCurrentUserId();
  const displayName = user.full_name ?? user.email.split("@")[0];

  return (
    <ListRow
      title={displayName}
      titleLines={1}
      subtitle={user.email}
      subtitleLines={1}
      subtitleEllipsizeMode="middle"
      leading={<Avatar name={displayName} size={AVATAR_SIZE} fallback="initial" />}
      leadingWidth={AVATAR_SIZE}
      trailing={
        <View style={styles.tags}>
          {user.role === "admin" ? <PillTag color="success" label={ADMIN_LABEL} /> : null}
          <Text style={[styles.status, { color: STATUS_COLOR[user.status] }]}>{STATUS_LABEL[user.status]}</Text>
        </View>
      }
    >
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
    </ListRow>
  );
}

const useStyles = createStyles(() => ({
  tags: { alignItems: "flex-end", gap: spacing.xs },
  status: { ...typography.tiny },
}));
