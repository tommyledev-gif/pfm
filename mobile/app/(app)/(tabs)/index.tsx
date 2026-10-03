import { useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { PlusIcon } from "@/components/ui/Icon";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Screen } from "@/components/shared/Screen";
import { TopBar } from "@/components/shared/TopBar";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { previousPeriodLabel } from "@/lib/date-range";
import { spacing, typography, createStyles, useColors } from "@/lib/theme";
import { useRefresh } from "@/lib/use-refresh";
import { PendingConfirmationsSection } from "@/features/ai-chat/components/PendingConfirmationsSection";
import { useTransactionRemoval } from "@/features/ai-chat/components/use-transaction-removal";
import { removalDialogCopy } from "@/features/ai-chat/removal-copy";
import { isPendingProposal } from "@/features/ai-chat/pending";
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
import { useUiPrefsStore, HomePeriod } from "@/stores/ui-prefs-store";
import { useChatStore } from "@/stores/chat-store";

const RECENT_TRANSACTION_SKELETON_COUNT = 4;
const RECENT_TRANSACTION_COUNT = 4;
// Over-fetched on purpose: rows dated ahead of today are dropped below, and
// asking for exactly four would leave the list short by however many there are.
const RECENT_FETCH_LIMIT = 10;
const FALLBACK_CURRENCY = "VND";

const PERIODS: { label: string; value: HomePeriod }[] = [
  { label: "Ngày", value: "day" },
  { label: "Tháng", value: "month" },
  { label: "Năm", value: "year" },
];

export default function HomeScreen() {
  const colors = useColors();
  const styles = useStyles();
  const router = useRouter();

  const thread = useChatStore((s) => s.thread);
  const homePeriod = useUiPrefsStore((s) => s.homePeriod);
  const setHomePeriod = useUiPrefsStore((s) => s.setHomePeriod);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const wallets = useWalletsQuery();
  const recent = useTransactionsQuery({ limit: RECENT_FETCH_LIMIT });
  const categories = useCategoriesQuery();
  const snapshot = useHomeSnapshot(homePeriod);
  const removal = useTransactionRemoval();

  const categoryById = useMemo(() => new Map(categories.data?.map((c) => [c.id, c])), [categories.data]);
  const walletCurrencyMap = useMemo(() => {
    const map = new Map<string, string>();
    wallets.data?.forEach((w) => map.set(w.id, w.currency));
    return map;
  }, [wallets.data]);

  // Selecting the raw, referentially stable thread and filtering in a memo —
  // a selector returning a fresh array every call makes the store see a
  // changed snapshot on every render and re-render forever.
  const pendingConfirmations = useMemo(() => thread.filter(isPendingProposal), [thread]);

  // "Recent" means recent, and the list is ordered newest first — so a
  // transaction booked for next month would sit above things that have
  // actually happened. Those rows are not lost; the Transactions screen
  // surfaces them behind its own upcoming card.
  const recentTransactions = splitFutureTransactions(recent.data?.pages[0]?.data ?? []).upToToday.slice(
    0,
    RECENT_TRANSACTION_COUNT,
  );

  const { refreshControl } = useRefresh([wallets, recent, categories, ...snapshot.queries]);

  const removalCopy = removalDialogCopy(removal.target, removal.targetIsPersisted, {
    currency:
      walletCurrencyMap.get(removal.target?.action?.payload.wallet_id ?? "") ?? FALLBACK_CURRENCY,
    resolveCategoryName: (id) => categoryById.get(id)?.name,
  });

  // Deep-links into the chat at the exact message, instead of the chat's own
  // default of landing on the newest one. The nonce lets the same item be
  // re-opened twice in a row.
  const goToPendingMessage = (messageId: string, openEdit?: boolean) =>
    router.push({
      pathname: "/ai-chat",
      params: { focusMessageId: messageId, focusedAt: String(Date.now()), ...(openEdit ? { openEdit: "1" } : {}) },
    });

  // Opens the Wallets screen on the tapped wallet, which flashes a border on
  // it. Same nonce trick as above: tapping the same card twice still replays.
  const openWallet = (wallet: Wallet) =>
    router.push({ pathname: "/wallets", params: { focusWalletId: wallet.id, focusedAt: String(Date.now()) } });

  // Hands the exact window the user is looking at to the Budgets tab, so the
  // limits there are prorated to the same period rather than the whole month.
  const openBudgetsForPeriod = () =>
    router.push({
      pathname: "/insights",
      params: { tab: "Budgets", from: snapshot.periodRange.from, to: snapshot.periodRange.to },
    });

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
              onOpenInsights={() => router.push("/insights")}
            />

            <PendingConfirmationsSection
              messages={pendingConfirmations}
              categoryById={categoryById}
              currency={snapshot.currency}
              onViewAll={() => router.push("/pending")}
              onOpenMessage={goToPendingMessage}
              onRequestRemove={removal.request}
            />

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
              ) : (
                <WalletCarousel wallets={wallets.data ?? []} onPressWallet={openWallet} />
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

      {/* ⚠️ Every pending row here is an unconfirmed proposal, so confirming
          writes nothing to the server — the message is marked discarded and
          stays in the thread. It is never deleted from it. */}
      <ConfirmDialog
        visible={removal.target !== null}
        title={removalCopy.title}
        message={removalCopy.message}
        confirmLabel={removalCopy.confirmLabel}
        loading={removal.deleting}
        onCancel={removal.cancel}
        onConfirm={removal.confirm}
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
