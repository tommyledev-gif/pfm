import { memo, useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";

import { MotionStagger } from "@/components/motion/MotionStagger";
import { LateSkeleton } from "@/components/motion/SkeletonSwap";
import { useListEntrance } from "@/components/motion/MotionView";
import { layoutSpring } from "@/components/motion/motion-tokens";
import { BankIcon, PlusIcon } from "@/components/ui/Icon";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { EmptyInlineCard } from "@/components/shared/EmptyState";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { Screen } from "@/components/shared/Screen";
import { TopBar } from "@/components/shared/TopBar";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { TranslationKey } from "@/lib/i18n";
import { isAwaitingFirstData, isWaitingForNetwork } from "@/lib/query-status";
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
import { HomeRecentEmpty } from "@/features/transactions/components/HomeRecentEmpty";
import { useCategoriesQuery } from "@/features/categories/api/use-categories-query";
import { Category } from "@/features/categories/types";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { HomeOnboardingCard } from "@/features/onboarding/components/HomeOnboardingCard";
import { useOpenWalletCreator } from "@/features/wallets/use-open-wallet-creator";
import { useWalletLookups } from "@/features/wallets/use-wallet-lookups";
import { touchesSharedWallet } from "@/features/wallets/wallet-access";
import { useUiPrefsStore, HomePeriod } from "@/stores/ui-prefs-store";

const RECENT_TRANSACTION_COUNT = 4;
// Over-fetched on purpose: rows dated ahead of today are dropped below, and
// asking for exactly four would leave the list short by however many there are.
const RECENT_FETCH_LIMIT = 10;
const NO_WALLETS: Wallet[] = [];
// The header's staggered blocks (MotionStagger); the recent rows continue after them.
const HEADER_BLOCKS = 5;

const PERIODS: { labelKey: TranslationKey; value: HomePeriod }[] = [
  { labelKey: "home.period.day", value: "day" },
  { labelKey: "home.period.month", value: "month" },
  { labelKey: "home.period.year", value: "year" },
];

interface RecentRowProps {
  transaction: Transaction;
  currency: string | undefined;
  category: Category | undefined;
  shared: boolean;
  onPress: (transaction: Transaction) => void;
}

const RecentRow = memo(function RecentRow({ transaction, onPress, ...row }: RecentRowProps) {
  return <TransactionRow transaction={transaction} {...row} onPress={() => onPress(transaction)} />;
});

/**
 * ⚠️ Performance, the same way the AI chat screen does it: Home stays mounted
 * behind every other tab and re-renders whenever any query it reads changes,
 * so each piece is memoized and handed stable callbacks (useLatestCallback),
 * and the chat thread is read only by the pending block that shows it. A
 * re-render here used to rebuild the whole screen — the wallet carousel's
 * native animation graph included — and that work landed on the same JS
 * thread that had to answer the tap back to Home, which is what made the
 * switch take half a second or more to happen.
 *
 * One column, not a FlatList: blocks land at different times (pending
 * proposals after the wallets), and each carries a layout spring, so a late
 * one fades in while everything under it slides down instead of jumping.
 */
export default function HomeScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();

  const homePeriod = useUiPrefsStore((s) => s.homePeriod);
  const setHomePeriod = useUiPrefsStore((s) => s.setHomePeriod);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [creatingTransaction, setCreatingTransaction] = useState(false);
  const wallets = useWalletsQuery();
  const recent = useTransactionsQuery({ limit: RECENT_FETCH_LIMIT });
  const categories = useCategoriesQuery();
  const budgets = useBudgetsQuery();
  const snapshot = useHomeSnapshot(homePeriod);
  const openWalletCreator = useOpenWalletCreator();

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);
  const { currencyById: walletCurrencyMap, sharedIds } = useWalletLookups(wallets.data);

  // "Recent" means recent, and the list is ordered newest first — so a
  // transaction booked for next month would sit above things that have
  // actually happened. Those rows are not lost; the Transactions screen
  // surfaces them behind its own upcoming card.
  const firstPage = recent.data?.pages[0]?.data;
  const recentTransactions = useMemo(
    () => splitFutureTransactions(firstPage ?? []).upToToday.slice(0, RECENT_TRANSACTION_COUNT),
    [firstPage],
  );
  // A fresh account — not one transaction ever, future-dated included — gets
  // the onboarding journey in place of a snapshot of zeros. Decided once all
  // three answers are in; until then the snapshot stays a skeleton, so a new
  // User never sees it flash in before the onboarding card replaces it.
  const isFresh = recent.isSuccess && wallets.isSuccess && budgets.isSuccess && (firstPage?.length ?? 0) === 0;
  const deciding = [recent, wallets, budgets].some(isAwaitingFirstData);

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
  const openWallets = useCallback(() => router.push("/wallets"), [router]);
  const openTransactions = useCallback(() => router.push("/transactions"), [router]);
  const closeEditor = useCallback(() => {
    setEditingTransaction(null);
    setCreatingTransaction(false);
  }, []);
  const startTransaction = useCallback(() => setCreatingTransaction(true), []);

  const periods = useMemo(() => PERIODS.map((p) => ({ label: t(p.labelKey), value: p.value })), [t]);

  // The header's blocks enter first (MotionStagger below), the rows after them.
  const rowEntrance = useListEntrance();

  return (
    <Screen>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={refreshControl}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          {/* Blocks enter top to bottom on Home's first mount (Home then
              stays mounted), and slide when a block above them lands. */}
          <MotionStagger animateLayout>
            <TopBar />
            {isFresh ? (
              <HomeOnboardingCard
                hasWallet={(wallets.data?.length ?? 0) > 0}
                hasTransaction={false}
                hasBudget={(budgets.data?.length ?? 0) > 0}
                onAddTransaction={startTransaction}
              />
            ) : (
              <SegmentedTabs style={styles.periodRow} options={periods} value={homePeriod} onChange={setHomePeriod} />
            )}
            {isFresh ? null : (
              <HomeSnapshotCard
                loading={snapshot.loading || deciding}
                periodIndex={PERIODS.findIndex((p) => p.value === snapshot.period)}
                isDay={snapshot.period === "day"}
                currency={snapshot.currency}
                currencies={snapshot.currencies}
                onChangeCurrency={snapshot.setCurrency}
                periodSpent={snapshot.periodSpent}
                spentDelta={snapshot.spentDelta}
                period={snapshot.period}
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
            )}
          </MotionStagger>

          {/* Outside the stagger: either may render nothing (no empty gap). */}
          <HomePendingProposals categoryById={categoryById} walletCurrencyById={walletCurrencyMap} />

          <HomePendingSyncSection />

          <MotionStagger startIndex={3} animateLayout>
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>{t("home.wallets.title")}</Text>
                  {wallets.data ? <Text style={styles.sectionCountHint}>{t("common.count.wallets", { count: wallets.data.length })}</Text> : null}
                </View>
                <Pressable onPress={openWallets} hitSlop={8} style={styles.addWalletAction}>
                  <PlusIcon size={12} color={colors.green} />
                  <Text style={styles.sectionAction}>{t("home.wallets.add")}</Text>
                </Pressable>
              </View>
              {isAwaitingFirstData(wallets) ? (
                <LateSkeleton><WalletCardSkeleton /></LateSkeleton>
              ) : isWaitingForNetwork(wallets) ? (
                <OfflinePlaceholder />
              ) : wallets.data?.length === 0 ? (
                <EmptyInlineCard
                  icon={<BankIcon size={18} color={colors.textSecondary} />}
                  text={t("common.empty.noWallet")}
                  onPress={openWalletCreator}
                  testID="empty-home-wallets"
                />
              ) : (
                <WalletCarousel wallets={wallets.data ?? NO_WALLETS} onPressWallet={openWallet} />
              )}
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{t("home.recent.title")}</Text>
              <Pressable onPress={openTransactions} hitSlop={8}>
                <Text style={styles.sectionAction}>{t("home.recent.seeAll")}</Text>
              </Pressable>
            </View>
          </MotionStagger>
        </View>

        <View style={styles.recent}>
          {recentTransactions.length === 0 ? (
            <Animated.View layout={layoutSpring()}>
              <HomeRecentEmpty query={recent} />
            </Animated.View>
          ) : (
            recentTransactions.map((item, index) => (
              // The entrance wrapper sits outside RecentRow, so its memo still holds.
              <Animated.View key={item.id} entering={rowEntrance(index + HEADER_BLOCKS)} layout={layoutSpring()}>
                <RecentRow
                  transaction={item}
                  currency={walletCurrencyMap.get(item.wallet_id)}
                  category={categoryById.get(item.category_id)}
                  shared={touchesSharedWallet(sharedIds, item)}
                  onPress={setEditingTransaction}
                />
              </Animated.View>
            ))
          )}
        </View>
      </ScrollView>

      <TransactionFormModal
        visible={Boolean(editingTransaction) || creatingTransaction}
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
  recent: { gap: spacing.md },
  section: { gap: spacing.md },
  periodRow: { flexDirection: "row", gap: spacing.sm },
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
}));
