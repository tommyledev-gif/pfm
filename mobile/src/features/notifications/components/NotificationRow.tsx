import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { colorForCategory } from "@/lib/category-color";
import { formatTime } from "@/lib/format-date";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { Notification } from "@/features/notifications/types";

// README: "Each row: colored icon circle, title + timestamp, body text.
// Unread rows get a 3px green left border."
export function NotificationRow({ notification }: { notification: Notification }) {
  return (
    <View style={[styles.row, !notification.is_read && styles.unread]}>
      <Avatar name={notification.title} color={colorForCategory(notification.type)} size={40} />
      <View style={styles.body}>
        <View style={styles.headerRow}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.time}>{formatTime(notification.created_at)}</Text>
        </View>
        <Text style={styles.text}>{notification.body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.listCard,
    borderLeftWidth: 3,
    borderLeftColor: "transparent",
  },
  unread: { borderLeftColor: colors.green, backgroundColor: "rgba(133,255,51,0.05)" },
  body: { flex: 1, gap: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  title: { flex: 1, ...typography.body, color: colors.textPrimary },
  time: { ...typography.tiny, color: colors.textMuted },
  text: { ...typography.caption, color: colors.textSecondary },
});
