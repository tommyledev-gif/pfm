import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { BellIcon } from "@/components/ui/Icon";
import { SearchField } from "@/components/ui/SearchField";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { Screen } from "@/components/shared/Screen";
import { ScreenHeader } from "@/components/shared/ScreenHeader";
import { ScreenLoader } from "@/components/shared/ScreenLoader";
import { NotificationRow } from "@/features/notifications/components/NotificationRow";
import { dayLabel } from "@/lib/format-date";
import { useRequireOnline } from "@/lib/connectivity";
import { matchesSearch } from "@/lib/search-text";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useNotificationsInfiniteQuery } from "@/features/notifications/api/use-notifications-query";
import { useMarkNotificationReadMutation } from "@/features/notifications/api/use-mark-notification-read-mutation";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { Notification } from "@/features/notifications/types";
import { useUsersQuery } from "@/features/users/api/use-users-query";
import { AccessRequestActions } from "@/features/users/components/AccessRequestActions";
import { useSessionStore } from "@/stores/session-store";

type Filter = "all" | "unread";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "unread", label: "Chưa đọc" },
];

interface DaySection {
  title: string;
  data: Notification[];
}

// A plain list grouped by day, as Mail does it: large title, a two-way
// filter and a search field over the rows, quiet day headers, and rows on the
// page itself (NotificationRow) rather than a stack of tinted cards.
export default function NotificationsScreen() {
  const colors = useColors();
  const styles = useStyles();
  const requireOnline = useRequireOnline();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  // Paged as the list scrolls: the server sends 20 at a time, and reading
  // only the first page left anything older out of reach.
  const notifications = useNotificationsInfiniteQuery(filter === "unread");
  const items = useMemo(() => notifications.data?.pages.flatMap((page) => page.data) ?? [], [notifications.data]);
  const markRead = useMarkNotificationReadMutation();
  // A notification names the Budget it was raised for, but Insights selects by
  // category — this is the hop between the two. Budgets are already cached by
  // Home/Insights in practice, so this rarely costs a request.
  const budgets = useBudgetsQuery();
  // Admins only (the endpoint 403s for members): which access requests are
  // still waiting, so only those notifications offer "Duyệt yêu cầu" and
  // "Từ chối". A rejected request leaves this list, taking both buttons.
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

    // Shared wallets (specs/shared-wallets US-02): the invitation card, or
    // the wallet someone just joined, are both on the Wallets screen.
    if (item.type === "wallet_invite" || item.type === "wallet_member_joined") {
      router.push("/wallets");
      return;
    }

    const categoryId = item.related_budget_id ? categoryIdByBudgetId.get(item.related_budget_id) : undefined;
    if (!categoryId) return;

    router.push({ pathname: "/insights", params: { categoryId, focusedAt: String(Date.now()) } });
  };

  const approveActionFor = (item: Notification) => {
    const requesterEmail = item.related_user_id ? waitingRequestEmailById.get(item.related_user_id) : undefined;
    if (item.type !== "access_request" || !item.related_user_id || !requesterEmail) return undefined;
    return <AccessRequestActions userId={item.related_user_id} email={requesterEmail} />;
  };

  // No server-side search endpoint for notifications (unlike Transactions'
  // own `search` query param) — filtered client-side over the pages already
  // fetched, title or body, ignoring case and accents.
  const sections = useMemo<DaySection[]>(() => {
    const grouped: DaySection[] = [];
    for (const n of items) {
      if (search.trim() && !matchesSearch(`${n.title} ${n.body}`, search)) continue;
      const label = dayLabel(n.created_at);
      const section = grouped.find((g) => g.title === label);
      if (section) section.data.push(n);
      else grouped.push({ title: label, data: [n] });
    }
    return grouped;
  }, [items, search]);

  const empty = notifications.isError ? (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Chưa tải được thông báo.</Text>
      <Pressable onPress={() => void notifications.refetch()} hitSlop={8} accessibilityRole="button">
        <Text style={styles.retry}>Thử lại</Text>
      </Pressable>
    </View>
  ) : search.trim() ? (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Không tìm thấy thông báo</Text>
      <Text style={styles.emptyHint}>Thử từ khóa khác.</Text>
    </View>
  ) : (
    <View style={styles.empty}>
      <BellIcon size={28} color={colors.textMuted} />
      <Text style={styles.emptyTitle}>
        {filter === "unread" ? "Không có thông báo chưa đọc." : "Chưa có thông báo."}
      </Text>
    </View>
  );

  return (
    <Screen style={styles.screen}>
      <ScreenHeader title="Thông báo" />

      <View style={styles.controls}>
        <SegmentedTabs options={FILTERS} value={filter} onChange={setFilter} testID="tabs-notifications-filter" />
        <SearchField value={search} onChangeText={setSearch} placeholder="Tìm thông báo" testID="input-notifications-search" />
      </View>

      {notifications.isLoading ? (
        <ScreenLoader />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => <Text style={styles.sectionHeader}>{section.title}</Text>}
          renderItem={({ item, index }) => (
            <NotificationRow
              notification={item}
              onPress={() => openNotification(item)}
              action={approveActionFor(item)}
              separated={index > 0}
            />
          )}
          ListEmptyComponent={empty}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (notifications.hasNextPage && !notifications.isFetchingNextPage) void notifications.fetchNextPage();
          }}
          ListFooterComponent={
            notifications.isFetchingNextPage ? <ActivityIndicator color={colors.textMuted} style={styles.more} /> : null
          }
        />
      )}
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  controls: { gap: spacing.md, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
  list: { paddingBottom: spacing.xxl * 2 },
  sectionHeader: {
    ...typography.label,
    color: colors.textSecondary,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  empty: { alignItems: "center", gap: spacing.sm, paddingTop: spacing.xxl * 2, paddingHorizontal: spacing.xl },
  emptyTitle: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  emptyHint: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  retry: { ...typography.body, color: colors.green },
  more: { paddingVertical: spacing.lg },
}));
