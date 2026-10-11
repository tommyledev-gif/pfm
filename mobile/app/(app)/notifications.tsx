import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { ChevronLeftIcon, SearchIcon } from "@/components/ui/Icon";
import { Screen } from "@/components/shared/Screen";
import { NotificationRow } from "@/features/notifications/components/NotificationRow";
import { dayLabel } from "@/lib/format-date";
import { useRequireOnline } from "@/lib/connectivity";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useNotificationsQuery } from "@/features/notifications/api/use-notifications-query";
import { useMarkNotificationReadMutation } from "@/features/notifications/api/use-mark-notification-read-mutation";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { Notification } from "@/features/notifications/types";
import { useUsersQuery } from "@/features/users/api/use-users-query";
import { ApproveRequestButton } from "@/features/users/components/ApproveRequestButton";
import { useSessionStore } from "@/stores/session-store";

export default function NotificationsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const router = useRouter();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const notifications = useNotificationsQuery(unreadOnly);
  const markRead = useMarkNotificationReadMutation();
  // A notification names the Budget it was raised for, but Insights selects by
  // category — this is the hop between the two. Budgets are already cached by
  // Home/Insights in practice, so this rarely costs a request.
  const budgets = useBudgetsQuery();
  // Admins only (the endpoint 403s for members): which access requests are
  // still waiting, so only those notifications offer "Duyệt yêu cầu".
  const isAdmin = useSessionStore((s) => s.role) === "admin";
  const users = useUsersQuery({ enabled: isAdmin });
  const waitingRequestEmailById = useMemo(
    () => new Map((users.data?.data ?? []).filter((u) => u.status === "requested").map((u) => [u.id, u.email])),
    [users.data],
  );

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
    if (!item.is_read) requireOnline(() => markRead.mutate(item.id));

    // An access request opens Thành viên, where the requester's row is.
    if (item.type === "access_request" && isAdmin) {
      router.push("/users");
      return;
    }

    const categoryId = item.related_budget_id ? categoryIdByBudgetId.get(item.related_budget_id) : undefined;
    if (!categoryId) return;

    router.push({ pathname: "/insights", params: { categoryId, focusedAt: String(Date.now()) } });
  };

  // No server-side search endpoint for notifications (unlike Transactions'
  // own `search` query param) — filtered client-side over the page already
  // fetched, matching either the title or the body text.
  const filteredNotifications = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    const all = notifications.data?.data ?? [];
    if (!query) return all;
    return all.filter(
      (n) => n.title.toLowerCase().includes(query) || n.body.toLowerCase().includes(query),
    );
  }, [notifications.data, searchInput]);

  const approveActionFor = (item: Notification) => {
    const requesterEmail = item.related_user_id ? waitingRequestEmailById.get(item.related_user_id) : undefined;
    if (item.type !== "access_request" || !item.related_user_id || !requesterEmail) return undefined;
    return <ApproveRequestButton userId={item.related_user_id} email={requesterEmail} />;
  };

  const sections = useMemo(() => {
    const grouped: { title: string; data: NonNullable<typeof notifications.data>["data"] }[] = [];
    filteredNotifications.forEach((n) => {
      const label = dayLabel(n.created_at);
      const section = grouped.find((g) => g.title === label);
      if (section) section.data.push(n);
      else grouped.push({ title: label, data: [n] });
    });
    return grouped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNotifications]);

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeftIcon size={24} />
        </Pressable>
        <Text style={styles.title}>Thông báo</Text>
        <Pressable
          onPress={() => setUnreadOnly((v) => !v)}
          style={[styles.toggle, unreadOnly && styles.toggleActive]}
        >
          <Text style={[styles.toggleLabel, unreadOnly && styles.toggleLabelActive]}>Chưa đọc</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <SearchIcon size={16} color={colors.textSecondary} />
        {/* multiline (not a fixed single-line TextInput) so a search term long
            enough to wrap grows the box downward instead of scrolling
            sideways inside a one-row field. */}
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Tìm thông báo..."
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          multiline
        />
        {searchInput ? (
          <Pressable onPress={() => setSearchInput("")} hitSlop={8}>
            <Text style={styles.clearSearch}>✕</Text>
          </Pressable>
        ) : null}
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
              <NotificationRow notification={item} action={approveActionFor(item)} />
            </Pressable>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {searchInput ? "Không tìm thấy thông báo nào." : "Không có thông báo nào."}
            </Text>
          }
        />
      )}
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
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
  searchRow: {
    flexDirection: "row",
    // flex-start (not center) — once the input grows past one line for a
    // long search phrase, centering would keep re-centering the icon/clear
    // button against a taller box instead of pinning them to its first line.
    alignItems: "flex-start",
    gap: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.listCard,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  // maxHeight caps growth at ~4 lines — long enough for any realistic search
  // phrase without a runaway box swallowing the screen.
  searchInput: { flex: 1, maxHeight: 96, ...typography.body, color: colors.textPrimary, padding: 0 },
  clearSearch: { ...typography.body, color: colors.textSecondary },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  sectionHeader: { ...typography.caption, color: colors.textMuted, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  loader: { marginTop: spacing.xxl },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
}));
