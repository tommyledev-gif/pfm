import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, ListRenderItemInfo, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { PlusIcon } from "@/components/ui/Icon";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { Screen } from "@/components/shared/Screen";
import { TopBar } from "@/components/shared/TopBar";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { previousPeriodLabel } from "@/lib/date-range";
import { isWaitingForNetwork } from "@/lib/query-status";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useLatestCallback } from "@/lib/use-latest-callback";
import { useRefresh } from "@/lib/use-refresh";
import { HomePendingProposals } from "@/features/ai-chat/components/HomePendingProposals";
import { HomePendingSyncSection } from "@/features/transactions/components/HomePendingSyncSection";
import { HomeSnapshotCard } from "@/features/reports/components/HomeSnapshotCard";
import { useHomeSnapshot } from "@/features/reports/hooks/use-home-snapshot";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { Wallet } from "@/features/wallets/types";
import { WalletCarousel } from "@/features/wallets/components/WalletCarousel";
import { WalletCardSkeleton } from "@/features/wallets/components/WalletCardSkeleton";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { Transaction } from "@/features/transactions/types";
import { splitFutureTransactions } from "@/features/transactions/future";
import { TransactionFormModal } from "@/features/transactions/components/TransactionFormModal";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { Category } from "@/features/categories/types";
import { useUiPrefsStore, HomePeriod } from "@/stores/ui-prefs-store";

const RECENT_TRANSACTION_SKELETON_COUNT = 4;
const RECENT_TRANSACTION_COUNT = 4;
// Over-fetched on purpose: rows dated ahead of today are dropped below, and
// asking for exactly four would leave the list short by however many there are.
const RECENT_FETCH_LIMIT = 10;
const NO_WALLETS: Wallet[] = [];

const PERIODS: { label: string; value: HomePeriod }[] = [
  { label: "Ngày", value: "day" },
  { label: "Tháng", value: "month" },
  { label: "Năm", value: "year" },
];

interface RecentRowProps {
  transaction: Transaction;
  currency: string | undefined;
  category: Category | undefined;
  onPress: (transaction: Transaction) => void;
}

const RecentRow = memo(function RecentRow({ transaction, currency, category, onPress }: RecentRowProps) {
  return (
    <Pressable onPress={() => onPress(transaction)}>
      <TransactionRow transaction={transaction} currency={currency} category={category} />
    </Pressable>
  );
});

// The edit sheet runs its whole form hook on every render, even closed — kept
// out of Home's re-renders unless its own props change.
const EditTransactionSheet = memo(TransactionFormModal);

/**
 * ⚠️ Performance, the same way the AI chat screen does it: Home stays mounted
 * behind every other tab and re-renders whenever any query it reads changes,
 * so each piece is memoized and handed stable callbacks (useLatestCallback),
 * and the chat thread is read only by the pending block that shows it. A
 * re-render here used to rebuild the whole screen — the wallet carousel's
 * native animation graph included — and that work landed on the same JS
 * thread that had to answer the tap back to Home, which is what made the
 * switch take half a second or more to happen.
 */
export default function HomeScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();

  const homePeriod = useUiPrefsStore((s) => s.homePeriod);
  const setHomePeriod = useUiPrefsStore((s) => s.setHomePeriod);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const wallets = useWalletsQuery();
  const recent = useTransactionsQuery({ limit: RECENT_FETCH_LIMIT });
  const categories = useCategoriesQuery();
  const snapshot = useHomeSnapshot(homePeriod);

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);
  const walletCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    wallets.data?.forEach((w) => map.set(w.id, w.currency));
    return map;
  }, [wallets.data]);

  // "Recent" means recent, and the list is ordered newest first — so a
  // transaction booked for next month would sit above things that have
  // actually happened. Those rows are not lost; the Transactions screen
  // surfaces them behind its own upcoming card.
  const firstPage = recent.data?.pages[0]?.data;
  const recentTransactions = useMemo(
    () => splitFutureTransactions(firstPage ?? []).upToToday.slice(0, RECENT_TRANSACTION_COUNT),
    [firstPage],
  );

  const { refreshControl } = useRefresh([wallets, recent, categories, ...snapshot.queries]);

  // Opens the Wallets screen on the tapped wallet, which flashes a border on
  // it. The nonce lets tapping the same card twice still replay it.
  const openWallet = useLatestCallback((wallet: Wallet) =>
    router.push({ pathname: "/wallets", params: { focusWalletId: wallet.id, focusedAt: String(Date.now()) } }),
  );

  // Hands the exact window the user is looking at to the Budgets tab, so the
  // limits there are prorated to the same period rather than the whole month.
  const openBudgetsForPeriod = useLatestCallback(() =>
    router.push({
      pathname: "/insights",
      params: { tab: "Budgets", from: snapshot.periodRange.from, to: snapshot.periodRange.to },
    }),
  );
  const openInsights = useCallback(() => router.push("/insights"), [router]);
  const closeEditor = useCallback(() => setEditingTransaction(null), []);

  const renderRecent = useCallback(
    ({ item }: ListRenderItemInfo<Transaction>) => (
      <RecentRow
        transaction={item}
        currency={walletCurrencyMap.get(item.wallet_id)}
        category={categoryById.get(item.category_id)}
        onPress={setEditingTransaction}
      />
    ),
    [walletCurrencyMap, categoryById],
  );

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

            <SegmentedTabs style={styles.periodRow} options={PERIODS} value={homePeriod} onChange={setHomePeriod} />

            <HomeSnapshotCard
              loading={snapshot.loading}
              isDay={homePeriod === "day"}
              currency={snapshot.currency}
              periodSpent={snapshot.periodSpent}
              spentDelta={snapshot.spentDelta}
              previousPeriodLabel={previousPeriodLabel(homePeriod)}
              budgetSnapshot={snapshot.budgetSnapshot}
              remainingToday={snapshot.remainingToday}
              todayAllowance={snapshot.todayAllowance}
              daysLeft={snapshot.daysLeft}
              atRiskBudgets={snapshot.atRiskBudgets}
              topCategories={snapshot.topCategories}
              topCategoriesExpenseTotal={snapshot.topCategoriesExpenseTotal}
              categoryById={categoryById}
              onOpenBudgets={openBudgetsForPeriod}
              onOpenInsights={openInsights}
            />

            <HomePendingProposals categoryById={categoryById} walletCurrencyById={walletCurrencyMap} />

            <HomePendingSyncSection />

            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>Ví của bạn</Text>
                  <Text style={styles.sectionCountHint}>{wallets.data?.length ?? 0} nguồn tiền</Text>
                </View>
                <Pressable onPress={() => router.push("/wallets")} hitSlop={8} style={styles.addWalletAction}>
                  <PlusIcon size={12} color={colors.green} />
                  <Text style={styles.sectionAction}>Thêm ví</Text>
                </Pressable>
              </View>
              {wallets.isLoading ? (
                <WalletCardSkeleton />
              ) : isWaitingForNetwork(wallets) ? (
                <OfflinePlaceholder />
              ) : (
                <WalletCarousel wallets={wallets.data ?? NO_WALLETS} onPressWallet={openWallet} />
              )}
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Giao dịch gần đây</Text>
              <Pressable onPress={() => router.push("/transactions")} hitSlop={8}>
                <Text style={styles.sectionAction}>Xem tất cả →</Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={renderRecent}
        ListEmptyComponent={
          recent.isLoading ? (
            <View>
              {Array.from({ length: RECENT_TRANSACTION_SKELETON_COUNT }).map((_, i) => (
                <TransactionRowSkeleton key={i} />
              ))}
            </View>
          ) : isWaitingForNetwork(recent) ? (
            <OfflinePlaceholder />
          ) : (
            <Text style={styles.empty}>Chưa có giao dịch nào.</Text>
          )
        }
      />

      <EditTransactionSheet
        visible={Boolean(editingTransaction)}
        onClose={closeEditor}
        editingTransaction={editingTransaction}
      />
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bgApp },
  content: { paddingBottom: 140, paddingHorizontal: spacing.xl, gap: spacing.md },
  header: { gap: spacing.xl },
  section: { gap: spacing.md },
  periodRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  // No bottom margin: the section's own gap owns the space under a header,
  // so adding one here stacked two spacings and left the carousel floating
  // further from its title than from the block below it.
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  // Uppercase, letter-spaced and muted — the section-title register, distinct
  // from a card's own full-weight title.
  sectionTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionCountHint: { ...typography.tiny, color: colors.textMuted },
  sectionAction: { ...typography.caption, color: colors.green },
  addWalletAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  empty: { ...typography.label, color: colors.textSecondary, textAlign: "center", marginTop: spacing.xl },
}));
