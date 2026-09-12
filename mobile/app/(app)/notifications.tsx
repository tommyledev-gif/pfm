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
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { Notification } from "@/features/notifications/types";

export default function NotificationsScreen() {
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const notifications = useNotificationsQuery(unreadOnly);
  const markRead = useMarkNotificationReadMutation();
  // A notification names the Budget it was raised for, but Insights selects by
  // category — this is the hop between the two. Budgets are already cached by
  // Home/Insights in practice, so this rarely costs a request.
  const budgets = useBudgetsQuery();

  const categoryIdByBudgetId = useMemo(
    () => new Map((budgets.data ?? []).map((b) => [b.id, b.category_id])),
    [budgets.data],
  );

  // Tapping a budget alert marks it read and opens Insights' Spending tab with
  // that budget's category selected, which is what pops its donut tooltip.
  // `focusedAt` is a nonce: expo-router keeps params across pushes, so without
  // something changing every time, re-tapping the same notification after
  // deselecting the segment would hand Insights an unchanged param and do
  // nothing.
  const openNotification = (item: Notification) => {
    if (!item.is_read) markRead.mutate(item.id);

    const categoryId = item.related_budget_id ? categoryIdByBudgetId.get(item.related_budget_id) : undefined;
    if (!categoryId) return;

    router.push({ pathname: "/insights", params: { categoryId, focusedAt: String(Date.now()) } });
  };

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
            <Pressable onPress={() => openNotification(item)}>
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
