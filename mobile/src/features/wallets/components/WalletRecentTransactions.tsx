import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { SkeletonCrossfade } from "@/components/motion/SkeletonCrossfade";
import { SKELETON_DELAY_MS } from "@/components/motion/use-content-reveal";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { useCategoryLookup } from "@/features/categories/api/use-category-lookup";
import { Transaction } from "@/features/transactions/types";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { Wallet } from "@/features/wallets/types";
import { isSharedWallet } from "@/features/wallets/wallet-access";
import { spacing, typography, createStyles } from "@/lib/theme";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { isAwaitingFirstData, isWaitingForNetwork } from "@/lib/query-status";
import { useLatestCallback } from "@/lib/use-latest-callback";

interface WalletRecentTransactionsProps {
  wallet: Wallet;
  /**
   * Bumped by the scroll view around it when its end comes within reach
   * (Drawer's onEndReached): a shared wallet's list then loads its next page.
   */
  loadMoreSignal?: number;
  /** A tapped entry: the screen opens it in the transaction sheet. */
  onSelect?: (transaction: Transaction) => void;
  /** "Xem tất cả" beside the title: the wallet's full list elsewhere. */
  onSeeAll?: () => void;
  /**
   * The cards are sliding to another wallet (WalletRecentPanel): the rows
   * give way to their skeleton at once, and the next wallet's rows replace it
   * once the cards settle and they have loaded.
   */
  switching?: boolean;
}

// Enough to answer "what moved in this wallet lately" at a glance; the full
// history is the Transactions tab's job.
const RECENT_LIMIT = 3;
// A shared wallet's history is only here: the Transactions tab lists what
// the User recorded themself (specs/shared-wallets BR-09), so this list pages.
const SHARED_PAGE = 10;

/**
 * The last few transactions of the wallet the card view is centred on — so
 * swiping to a wallet shows what has been happening in it, not just its
 * balance. Follows the carousel: a different card, a different list.
 *
 * On a shared wallet it is everyone's entries, each saying who recorded it
 * when that was someone else, and older ones load as the list nears its end
 * (loadMoreSignal), no "Xem thêm" to tap.
 */
export function WalletRecentTransactions({
  wallet,
  loadMoreSignal = 0,
  onSelect,
  onSeeAll,
  switching = false,
}: WalletRecentTransactionsProps) {
  const { t } = useTranslation();
  const styles = useStyles();
  const shared = isSharedWallet(wallet);
  const limit = shared ? SHARED_PAGE : RECENT_LIMIT;
  const transactions = useTransactionsQuery({ wallet_id: wallet.id, limit });
  const loadMore = useLatestCallback(() => {
    if (shared && transactions.hasNextPage && !transactions.isFetchingNextPage) void transactions.fetchNextPage();
  });
  useEffect(() => {
    if (loadMoreSignal > 0) loadMore();
  }, [loadMoreSignal, loadMore]);
  const categories = useCategoryLookup();
  const items = shared
    ? (transactions.data?.pages.flatMap((page) => page.data) ?? [])
    : (transactions.data?.pages[0]?.data ?? []).slice(0, RECENT_LIMIT);
  // Not isLoading: pending while the saved cache is read back, when the
  // list used to say "no transactions" before its rows.
  const loading = isAwaitingFirstData(transactions);

  return (
    <View style={styles.section} testID="section-wallet-recent">
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {t(shared ? "wallets.recent.title.shared" : "wallets.recent.title.own")}
        </Text>
        {onSeeAll && items.length > 0 ? (
          <Pressable onPress={onSeeAll} hitSlop={8} accessibilityRole="link" testID="btn-wallet-recent-see-all">
            <Text style={styles.seeAll}>{t("common.action.seeAll")}</Text>
          </Pressable>
        ) : null}
      </View>
      {/* Straight away while switching (the User just swiped and is
          watching); after SKELETON_DELAY_MS on a first load, so a fast one
          never blinks it. */}
      <SkeletonCrossfade
        showSkeleton={switching || loading}
        delayMs={switching ? 0 : SKELETON_DELAY_MS}
        style={styles.rows}
        skeleton={Array.from({ length: RECENT_LIMIT }).map((_, i) => <TransactionRowSkeleton key={i} />)}
      >
        {loading ? null : isWaitingForNetwork(transactions) ? (
          <OfflinePlaceholder />
        ) : transactions.isError ? (
          <Text style={styles.empty}>{t("wallets.recent.error")}</Text>
        ) : items.length === 0 ? (
          <Text style={styles.empty}>{t("wallets.recent.empty")}</Text>
        ) : (
          items.map((item) => (
            <View key={item.id}>
              <TransactionRow
                transaction={item}
                currency={wallet.currency}
                category={categories.get(item.category_id)}
                onPress={onSelect ? () => onSelect(item) : undefined}
              />
              {item.recorded_by ? (
                <Text style={styles.recorder} numberOfLines={1}>
                  {t("sharedWallets.recordedBy", { name: item.recorded_by.name })}
                </Text>
              ) : null}
            </View>
          ))
        )}
      </SkeletonCrossfade>
      {/* The next page arriving, in the shape of what it will be. */}
      {transactions.isFetchingNextPage
        ? Array.from({ length: 2 }).map((_, i) => <TransactionRowSkeleton key={`more-${i}`} />)
        : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  section: { gap: spacing.xs },
  rows: { gap: spacing.xs },
  // The link sits on the title's line, as every section header's does (Home).
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  title: { ...typography.label, color: colors.textSecondary, flexShrink: 1 },
  seeAll: { ...typography.caption, color: colors.green },
  empty: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.lg },
  // Under the row, aligned past its icon, so it reads as part of that entry.
  recorder: { ...typography.tiny, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.xs, paddingLeft: 56 },
}));
