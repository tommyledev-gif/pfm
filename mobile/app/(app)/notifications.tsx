import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { ChevronLeftIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { NotificationRow } from "@/features/notifications/components/NotificationRow";
import { dayLabel } from "@/lib/format-date";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useNotificationsQuery } from "@/features/notifications/api/use-notifications-query";
import { useMarkNotificationReadMutation } from "@/features/notifications/api/use-mark-notification-read-mutation";

export default function NotificationsScreen() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notifications = useNotificationsQuery(unreadOnly);
  const markRead = useMarkNotificationReadMutation();

  const sections = useMemo(() => {
    const grouped: { title: string; data: NonNullable<typeof notifications.data>["data"] }[] = [];
    (notifications.data?.data ?? []).forEach((n) => {
      const label = dayLabel(n.created_at);
      const section = grouped.find((g) => g.title === label);
      if (section) section.data.push(n);
      else grouped.push({ title: label, data: [n] });
    });
    return grouped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.data]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <Pressable
          onPress={() => setUnreadOnly((v) => !v)}
          style={[styles.toggle, unreadOnly && styles.toggleActive]}
        >
          <Text style={[styles.toggleLabel, unreadOnly && styles.toggleLabelActive]}>Unread only</Text>
        </Pressable>
      </View>

      {notifications.isLoading ? (
        <ActivityIndicator color={colors.green} style={styles.loader} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => !item.is_read && markRead.mutate(item.id)}>
              <NotificationRow notification={item} />
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No notifications.</Text>}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: { flex: 1, ...typography.title, color: colors.textPrimary },
  toggle: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  toggleActive: { backgroundColor: colors.green, borderColor: colors.green },
  toggleLabel: { ...typography.tiny, color: colors.textSecondary },
  toggleLabelActive: { color: colors.onGreen },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  sectionHeader: { ...typography.caption, color: colors.textMuted, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  loader: { marginTop: spacing.xxl },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
