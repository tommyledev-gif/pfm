import { ComponentType, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BellIcon, TargetIcon, UserIcon, UsersIcon } from "@/components/ui/Icon";
import { IconProps } from "@/components/ui/icons/primitives";
import { formatTime } from "@/lib/format-date";
import { LIST_ROW_PADDING_X } from "@/components/ui/grouped-list/list-metrics";
import { withAlpha } from "@/lib/color";
import { colors as palette, spacing, typography, createStyles } from "@/lib/theme";
import { Notification } from "@/features/notifications/types";

const ICON_TILE = 36;
const UNREAD_DOT = 8;
// The unread dot's column, which is also the row's leading padding inside its
// group: every row keeps it, so icons and text line up whether or not a row
// is unread.
const GUTTER = 20;

interface TypeLook {
  Icon: ComponentType<IconProps>;
  readonly color: string;
}

// One glyph and tint per kind of notification, so the list reads by shape
// before any text. Getters: read at render time, so they follow a theme
// switch (src/theme/active-palette.ts).
const LOOK: Record<string, TypeLook> = {
  budget_exceeded: { Icon: TargetIcon, get color() { return palette.peach; } },
  access_request: { Icon: UserIcon, get color() { return palette.lavender; } },
  wallet_invite: { Icon: UsersIcon, get color() { return palette.green; } },
  wallet_member_joined: { Icon: UsersIcon, get color() { return palette.periwinkle; } },
};
const DEFAULT_LOOK: TypeLook = { Icon: BellIcon, get color() { return palette.periwinkle; } };

interface NotificationRowProps {
  notification: Notification;
  onPress: () => void;
  /** Under the body: an admin's access request carries "Duyệt yêu cầu" / "Từ chối" here. */
  action?: ReactNode;
  /** Draws the hairline above this row (every row of a day but its first). */
  separated: boolean;
  /** Overrides is_read for the dot: a row read on being seen keeps it for the visit. */
  unread?: boolean;
}

/**
 * One notification as a row of its day's inset group, the way Mail lists messages:
 * a tinted glyph for its kind, the title with the time at the far end, the
 * body under it in two lines, and a small green dot in the leading gutter
 * while it is unread. No card, no coloured edge: the dot is the one unread
 * mark, and rows are told apart by a hairline that starts where the text
 * does.
 */
export function NotificationRow({ notification, onPress, action, separated, unread: unreadOverride }: NotificationRowProps) {
  const styles = useStyles();
  const look = LOOK[notification.type] ?? DEFAULT_LOOK;
  const unread = unreadOverride ?? !notification.is_read;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "Chưa đọc. " : ""}${notification.title}. ${notification.body}`}
      testID={`row-notification-${notification.id}`}
    >
      <View style={styles.gutter}>{unread ? <View style={styles.dot} /> : null}</View>
      <View style={[styles.tile, { backgroundColor: withAlpha(look.color, 0.14) }]}>
        <look.Icon size={18} color={look.color} />
      </View>
      <View style={[styles.content, separated && styles.separated]}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.time}>{formatTime(notification.created_at)}</Text>
        </View>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
        {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "flex-start" },
  pressed: { backgroundColor: withAlpha(colors.overlayBase, 0.05) },
  gutter: { width: GUTTER, alignItems: "center", paddingTop: spacing.md + ICON_TILE / 2 - UNREAD_DOT / 2 },
  dot: { width: UNREAD_DOT, height: UNREAD_DOT, borderRadius: UNREAD_DOT / 2, backgroundColor: colors.green },
  tile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: ICON_TILE / 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
    marginRight: spacing.md,
  },
  // The hairline sits on the text column, so it starts where the text does.
  content: { flex: 1, gap: 2, paddingVertical: spacing.md, paddingRight: LIST_ROW_PADDING_X },
  separated: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.surfaceBorder },
  titleRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  title: { flex: 1, ...typography.body, color: colors.textPrimary },
  time: { ...typography.caption, fontWeight: "500", color: colors.textMuted },
  body: { ...typography.caption, fontWeight: "500", color: colors.textSecondary, lineHeight: 18 },
  action: { paddingTop: spacing.sm },
}));
