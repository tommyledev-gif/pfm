import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { CheckIcon, HistoryIcon, PlusIcon } from "@/components/ui/Icon";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { LiquidCircle } from "@/components/shared/LiquidCircle";
import { Screen } from "@/components/shared/Screen";
import { SnapshotCardSkeleton } from "@/components/shared/SnapshotCardSkeleton";
import { TopBar } from "@/components/shared/TopBar";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { WalletCard } from "@/components/shared/WalletCard";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { currentPeriodRange, monthRange, previousPeriodLabel, previousPeriodRange } from "@/lib/date-range";
import { colors, radii, spacing, typography } from "@/lib/theme";
import { useRefresh } from "@/lib/use-refresh";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { primaryCurrency } from "@/features/wallets/wallet-totals";
import { WalletCardSkeleton } from "@/features/wallets/components/WalletCardSkeleton";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { Transaction } from "@/features/transactions/types";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { budgetTotals } from "@/features/budgets/budget-totals";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";
import { useUiPrefsStore, HomePeriod } from "@/stores/ui-prefs-store";
import { useChatStore } from "@/stores/chat-store";

const WALLET_SKELETON_COUNT = 3;
const RECENT_TRANSACTION_SKELETON_COUNT = 4;
const TOP_CATEGORIES_COUNT = 3;

const PERIODS: { label: string; value: HomePeriod }[] = [
  { label: "Tuần", value: "week" },
  { label: "Tháng", value: "month" },
  { label: "Năm", value: "year" },
];

export default function HomeScreen() {
  const router = useRouter();
  const wallets = useWalletsQuery();
  const recent = useTransactionsQuery({ limit: 4 });
  const categories = useCategoriesQuery();
  const budgets = useBudgetsQuery();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const homePeriod = useUiPrefsStore((s) => s.homePeriod);
  const setHomePeriod = useUiPrefsStore((s) => s.setHomePeriod);
  // Select the raw, referentially-stable `thread` array and derive the
  // filtered list via useMemo, rather than filtering inline inside the
  // Zustand selector — a selector that returns a brand-new array on every
  // call (as `.filter()` does) makes useSyncExternalStore see a "changed"
  // snapshot on every render and re-render again to check, forever
  // ("Maximum update depth exceeded" — reproduced live on the Home screen).
  const thread = useChatStore((s) => s.thread);
  const allPendingConfirmations = useMemo(
    () => thread.filter((m) => m.action && !m.confirmed && !m.superseded),
    [thread],
  );
  // "Bỏ qua" only hides the banner for the session, it never mutates
  // chat-store — a message dropping off this set (edited, confirmed, or a
  // fresh one arriving) means there's something new to review, so the
  // dismissal for that id no longer applies.
  const [dismissedPendingIds, setDismissedPendingIds] = useState<Set<string>>(new Set());
  const pendingConfirmations = useMemo(
    () => allPendingConfirmations.filter((m) => !dismissedPendingIds.has(m.id)),
    [allPendingConfirmations, dismissedPendingIds],
  );

  const walletCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    wallets.data?.forEach((w) => map.set(w.id, w.currency));
    return map;
  }, [wallets.data]);

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);

  const periodRange = useMemo(() => currentPeriodRange(homePeriod), [homePeriod]);
  const periodSummary = useReportSummaryQuery(periodRange);
  // Top Categories always reflects the calendar month, independent of the
  // Week/Month/Year snapshot selector above (a "top categories this week"
  // list would mostly be empty/noisy) — same range this screen already used
  // before the trend badge existed.
  const thisMonthRange = useMemo(() => monthRange(0), []);
  const thisMonthSummary = useReportSummaryQuery(thisMonthRange);
  // Trend badge, by contrast, DOES track the selected period — "more/less
  // than last week" only makes sense while Week is selected.
  const previousRange = useMemo(() => previousPeriodRange(homePeriod), [homePeriod]);
  const previousPeriodSummary = useReportSummaryQuery(previousRange);

  // The report's own currency is the source of truth for the whole snapshot
  // (matches SpendingTab.tsx's `totals[0]` convention) — fall back to the
  // wallets' primary currency only while the report hasn't loaded yet / has
  // no transactions in range at all.
  const currency =
    periodSummary.data?.totals[0]?.currency ?? (wallets.data ? primaryCurrency(wallets.data) : undefined) ?? "VND";
  const periodSpent = periodSummary.data?.totals[0]?.total_expense ?? 0;
  const previousPeriodSpent = previousPeriodSummary.data?.totals[0]?.total_expense ?? 0;
  const spentDelta = periodSpent - previousPeriodSpent;
  const budgetSnapshot = budgets.data ? budgetTotals(budgets.data, currency) : null;
  const isOverBudget = Boolean(budgetSnapshot && periodSpent > budgetSnapshot.limit);

  const topCategories = useMemo(() => {
    const expenseCategories = thisMonthSummary.data?.by_category.filter((c) => c.type === "expense") ?? [];
    return [...expenseCategories].sort((a, b) => b.amount - a.amount).slice(0, TOP_CATEGORIES_COUNT);
  }, [thisMonthSummary.data]);

  const recentTransactions = recent.data?.pages[0]?.data.slice(0, 4) ?? [];

  // Every input this Card renders defaults to 0/[] before its own query
  // resolves — without this, the very first render showed "Đã chi 0 ₫" and
  // an empty categories column instead of a loading state.
  const snapshotLoading = wallets.isLoading || periodSummary.isLoading || thisMonthSummary.isLoading || budgets.isLoading;

  // Home is the widest fan-out of queries in the app — the snapshot alone is
  // three separate report calls (selected period, this month, previous
  // period). Refreshing anything less than all of them would leave the trend
  // badge comparing a fresh number against a stale one.
  const { refreshControl } = useRefresh([
    wallets,
    recent,
    categories,
    budgets,
    periodSummary,
    thisMonthSummary,
    previousPeriodSummary,
  ]);

  return (
    <Screen>
      <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={recentTransactions}
      keyExtractor={(t) => t.id}
      refreshControl={refreshControl}
      ListHeaderComponent={
        <View style={styles.header}>
          <TopBar userName="Me" />

          <SegmentedTabs
            style={styles.periodRow}
            options={PERIODS}
            value={homePeriod}
            onChange={setHomePeriod}
          />

          <Card style={styles.snapshotCard} radius={radii.hero}>
            {snapshotLoading ? (
              <SnapshotCardSkeleton />
            ) : (
              <>
                {/* In-flow and right-aligned, not absolutely pinned to the
                    corner — the trend text's length varies with the amount and
                    a fixed absolute overlay collided with the categories column
                    below it for any but the shortest amounts. */}
                <View
                  style={[
                    styles.trendBadge,
                    spentDelta > 0 ? styles.trendBadgeNegative : styles.trendBadgePositive,
                  ]}
                >
                  <Text
                    style={[styles.trendBadgeLabel, { color: spentDelta > 0 ? colors.peach : colors.green }]}
                    numberOfLines={1}
                  >
                    {spentDelta > 0 ? "Nhiều hơn " : spentDelta < 0 ? "Ít hơn " : "Bằng "}
                    {formatCurrency(Math.abs(spentDelta), currency)} so với {previousPeriodLabel(homePeriod)}
                  </Text>
                </View>
                <View style={styles.snapshotRow}>
                  <View style={styles.snapshotLeft}>
                    <LiquidCircle
                      size={132}
                      progress={budgetSnapshot && budgetSnapshot.limit > 0 ? periodSpent / budgetSnapshot.limit : 0}
                      topLabel="Đã chi"
                      topValue={formatCurrency(periodSpent, currency)}
                    />
                    <Text style={styles.snapshotRemaining}>
                      Còn lại:{" "}
                      <Text style={styles.snapshotRemainingValue}>
                        {budgetSnapshot ? formatCurrency(budgetSnapshot.remaining, currency) : "—"}
                      </Text>
                    </Text>
                    {budgetSnapshot ? (
                      <Text style={[styles.snapshotStatus, { color: isOverBudget ? colors.peach : colors.green }]}>
                        {isOverBudget ? "Vượt ngân sách" : "Trong ngân sách"}
                      </Text>
                    ) : null}
                  </View>

                  {topCategories.length > 0 ? (
                    <View style={styles.snapshotRight}>
                      <View style={styles.compactHeaderRow}>
                        <Text style={styles.compactSectionTitle} numberOfLines={1}>
                          Chi nhiều nhất
                        </Text>
                        <Pressable onPress={() => router.push("/insights")} hitSlop={8}>
                          <Text style={styles.compactSeeAll} numberOfLines={1}>
                            Xem tất cả
                          </Text>
                        </Pressable>
                      </View>
                      {topCategories.map((c) => (
                        <View key={c.category_id} style={styles.categoryRow}>
                          <Avatar
                            name={c.category_name}
                            color={colorForCategory(c.category_id)}
                            size={24}
                            icon={categoryById.get(c.category_id)?.icon}
                            iconUrl={categoryById.get(c.category_id)?.icon_url}
                          />
                          <Text style={styles.categoryName} numberOfLines={1}>
                            {c.category_name}
                          </Text>
                          <Text style={styles.categoryAmount} numberOfLines={1}>
                            {formatCurrency(c.amount, currency)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </>
            )}
          </Card>

          {pendingConfirmations.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitleUppercase}>Chờ xác nhận</Text>
                  <View style={styles.pendingCountBadge}>
                    <Text style={styles.pendingCountBadgeLabel}>{pendingConfirmations.length}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setDismissedPendingIds((prev) => new Set([...prev, ...pendingConfirmations.map((m) => m.id)]))}
                  hitSlop={8}
                >
                  <Text style={styles.sectionAction}>Bỏ qua</Text>
                </Pressable>
              </View>
              {pendingConfirmations.map((m) => (
                <Pressable key={m.id} style={styles.pendingRow} onPress={() => router.push("/ai-chat")}>
                  <View style={styles.pendingIconTile}>
                    <HistoryIcon size={18} color={colors.mustard} />
                  </View>
                  <View style={styles.pendingTextCol}>
                    <Text style={styles.pendingLabel} numberOfLines={1}>
                      {m.action?.payload.note || categoryById.get(m.action?.payload.category_id ?? "")?.name || "Giao dịch"}
                    </Text>
                    <Text style={styles.pendingHint} numberOfLines={1}>
                      Chạm để duyệt mục {m.action?.payload.type === "income" ? "thu" : "chi"}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.pendingAmount,
                      { color: m.action?.payload.type === "income" ? colors.green : colors.peach },
                    ]}
                    numberOfLines={1}
                  >
                    {formatCurrency(m.action?.payload.amount ?? 0, currency)}
                  </Text>
                  <View style={styles.pendingCheckButton}>
                    <CheckIcon size={16} color={colors.onGreen} />
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitleUppercase}>Ví của bạn</Text>
                <Text style={styles.sectionCountHint}>{wallets.data?.length ?? 0} nguồn tiền</Text>
              </View>
              <Pressable onPress={() => router.push("/wallets")} hitSlop={8} style={styles.addWalletAction}>
                <PlusIcon size={12} color={colors.green} />
                <Text style={styles.sectionAction}>Thêm ví</Text>
              </Pressable>
            </View>
            {wallets.isLoading ? (
              <View style={[styles.walletRow, styles.walletRowStatic]}>
                {Array.from({ length: WALLET_SKELETON_COUNT }).map((_, i) => (
                  <WalletCardSkeleton key={i} />
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.walletRow}>
                {wallets.data?.map((w) => (
                  <WalletCard key={w.id} wallet={w} />
                ))}
              </ScrollView>
            )}
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitleUppercase}>Giao dịch gần đây</Text>
            <Pressable onPress={() => router.push("/transactions")} hitSlop={8}>
              <Text style={styles.sectionAction}>Xem tất cả →</Text>
            </Pressable>
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => setEditingTransaction(item)}>
          <TransactionRow
            transaction={item}
            currency={walletCurrencyMap.get(item.wallet_id)}
            category={categoryById.get(item.category_id)}
          />
        </Pressable>
      )}
      ListEmptyComponent={
        recent.isLoading ? (
          <View>
            {Array.from({ length: RECENT_TRANSACTION_SKELETON_COUNT }).map((_, i) => (
              <TransactionRowSkeleton key={i} />
            ))}
          </View>
        ) : (
          <Text style={styles.empty}>Chưa có giao dịch nào.</Text>
        )
      }
      />

      <TransactionFormModal
        visible={Boolean(editingTransaction)}
        onClose={() => setEditingTransaction(null)}
        editingTransaction={editingTransaction}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingBottom: 140, paddingHorizontal: spacing.xl, gap: spacing.md },
  header: { gap: spacing.lg },
  section: { gap: spacing.sm },
  periodRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  snapshotCard: { gap: spacing.md },
  // Translucent tinted pill (same convention as profile.tsx's logout row),
  // not a solid fill — a loud solid-color block read as jarring against the
  // rest of this dark, low-saturation card.
  trendBadge: {
    alignSelf: "flex-end",
    maxWidth: "100%",
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  trendBadgeNegative: { backgroundColor: "rgba(255,158,150,0.12)", borderColor: "rgba(255,158,150,0.35)" },
  trendBadgePositive: { backgroundColor: "rgba(133,255,51,0.1)", borderColor: "rgba(133,255,51,0.3)" },
  trendBadgeLabel: { ...typography.tiny },
  snapshotRow: { flexDirection: "row", gap: spacing.lg, alignItems: "flex-start" },
  snapshotLeft: { alignItems: "center", gap: spacing.xs },
  snapshotRight: { flex: 1, gap: 2, minWidth: 0 },
  compactHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs },
  compactSectionTitle: { ...typography.label, color: colors.textPrimary, flexShrink: 1 },
  compactSeeAll: { ...typography.tiny, color: colors.green, flexShrink: 0 },
  snapshotRemaining: { ...typography.caption, color: colors.textSecondary },
  snapshotRemainingValue: { ...typography.label, color: colors.textPrimary },
  snapshotStatus: { ...typography.label },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  addButtonLabel: { ...typography.body, color: colors.green },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs },
  categoryName: { flex: 1, ...typography.caption, color: colors.textPrimary },
  categoryAmount: { ...typography.tiny, color: colors.textSecondary },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // Uppercase + letter-spacing label, muted rather than full-white — the
  // section-title register the design reference uses for "CHỜ XÁC NHẬN" /
  // "VÍ CỦA BẠN" / "GIAO DỊCH GẦN ĐÂY", distinct from a card's own
  // full-weight title (styles.compactSectionTitle above).
  sectionTitleUppercase: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionCountHint: { ...typography.tiny, color: colors.textMuted },
  sectionAction: { ...typography.caption, color: colors.green },
  addWalletAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  pendingCountBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.mustard,
    alignItems: "center",
    justifyContent: "center",
  },
  pendingCountBadgeLabel: { fontSize: 10, fontWeight: "800", color: colors.onGreen },
  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    // A gold outline (not the neutral surfaceBorder every other card uses)
    // is this row's own visual cue that it's awaiting action, not just
    // another list item.
    borderColor: "rgba(242,201,76,0.4)",
    borderRadius: radii.listCard,
  },
  pendingIconTile: {
    width: 40,
    height: 40,
    borderRadius: radii.listCard - 2,
    backgroundColor: "rgba(242,201,76,0.12)",
    borderWidth: 1,
    borderColor: "rgba(242,201,76,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingTextCol: { flex: 1, minWidth: 0, gap: 2 },
  pendingLabel: { ...typography.body, color: colors.textPrimary },
  pendingHint: { ...typography.tiny, color: colors.textSecondary },
  pendingAmount: { ...typography.body, fontWeight: "700" },
  pendingCheckButton: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.green,
    alignItems: "center",
    justifyContent: "center",
  },
  walletRow: { gap: spacing.md, paddingBottom: spacing.xs },
  walletRowStatic: { flexDirection: "row" },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
});
