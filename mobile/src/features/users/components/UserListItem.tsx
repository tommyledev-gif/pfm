import { View } from "react-native";
import { useTranslation } from "react-i18next";

import { Avatar } from "@/components/ui/Avatar";
import { ListRow } from "@/components/ui/grouped-list";
import { PillTag } from "@/components/ui/PillTag";
import { colorForCategory } from "@/lib/category-color";
import { TranslationKey } from "@/lib/i18n";
import { colors, createStyles } from "@/lib/theme";
import { User } from "@/features/users/types";
import { AccessRequestActions } from "@/features/users/components/AccessRequestActions";
import { ResendInviteButton } from "@/features/users/components/ResendInviteButton";
import { RevokeSessionsButton } from "@/features/users/components/RevokeSessionsButton";
import { useCurrentUserId } from "@/stores/use-current-user-id";

const AVATAR_SIZE = 44;
const STATUS_DOT = 12;

// Getters, not values: read at render time so they follow a theme switch
// (see src/theme/active-palette.ts).
export const STATUS_COLOR: Record<User["status"], string> = {
  get requested() { return colors.lavender; },
  get active() { return colors.green; },
  get pending() { return colors.mustard; },
  get disabled() { return colors.peach; },
};

export const STATUS_LABEL: Record<User["status"], TranslationKey> = {
  requested: "common.status.awaitingApproval",
  pending: "users.status.pending",
  active: "users.status.active",
  disabled: "users.status.disabled",
};

// Only admins are tagged: on the members screen every other row is a member,
// and a tag on every row says nothing.

/**
 * One member as a row of the screen's grouped list: their photo (or initial
 * on their own colour) with a status dot, name, @tên đăng nhập and email,
 * and the actions their status calls for under it. The status itself is the
 * section the row sits in (users.tsx); the dot repeats it at a glance.
 */
export function UserListItem({ user }: { user: User }) {
  const { t } = useTranslation();
  const styles = useStyles();
  const currentUserId = useCurrentUserId();
  const displayName = user.full_name ?? user.email.split("@")[0];
  const isSelf = user.id === currentUserId;

  return (
    <ListRow
      title={isSelf ? t("users.row.selfTitle", { name: displayName }) : displayName}
      titleLines={1}
      subtitle={user.username ? `@${user.username} · ${user.email}` : user.email}
      subtitleLines={1}
      subtitleEllipsizeMode="middle"
      leading={
        <View>
          <Avatar
            name={displayName}
            color={colorForCategory(user.id)}
            iconUrl={user.avatar_url}
            size={AVATAR_SIZE}
            fallback="initial"
          />
          <View style={[styles.dot, { backgroundColor: STATUS_COLOR[user.status] }]} />
        </View>
      }
      leadingWidth={AVATAR_SIZE}
      trailing={user.role === "admin" ? <PillTag color="success" label={t("common.role.admin")} /> : undefined}
      accessibilityLabel={t(user.role === "admin" ? "users.row.a11yAdmin" : "users.row.a11y", { name: displayName, status: t(STATUS_LABEL[user.status]) })}
      testID={`row-user-${user.id}`}
    >
      {/* A request from the login screen: approving sends the activation
          email, rejecting removes the request. */}
      {user.status === "requested" ? <AccessRequestActions userId={user.id} email={user.email} /> : null}
      {user.status === "pending" && user.invite_resend_available_at ? (
        <ResendInviteButton userId={user.id} availableAt={user.invite_resend_available_at} />
      ) : null}
      {/* Active Users other than yourself only (spec AC-42); you sign
          yourself out from the Security screen. */}
      {user.status === "active" && !isSelf ? <RevokeSessionsButton userId={user.id} email={user.email} /> : null}
    </ListRow>
  );
}

const useStyles = createStyles((c) => ({
  // On the avatar's lower-right edge, ringed in the row's own colour so it
  // reads as a separate mark over a photo.
  dot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: STATUS_DOT,
    height: STATUS_DOT,
    borderRadius: STATUS_DOT / 2,
    borderWidth: 2,
    borderColor: c.surface,
  },
}));
