import { useEffect } from "react";
import { Text, View } from "react-native";

import { TransactionRow } from "@/components/shared/TransactionRow";
import { useCategoryLookup } from "@/features/categories/api/use-category-lookup";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { Wallet } from "@/features/wallets/types";
import { isSharedWallet } from "@/features/wallets/wallet-access";
import { spacing, typography, createStyles } from "@/lib/theme";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { isWaitingForNetwork } from "@/lib/query-status";
import { useLatestCallback } from "@/lib/use-latest-callback";

interface WalletRecentTransactionsProps {
  wallet: Wallet;
  /**
   * Bumped by the scroll view around it when its end comes within reach
   * (Drawer's onEndReached): a shared wallet's list then loads its next page.
   */
  loadMoreSignal?: number;
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
export function WalletRecentTransactions({ wallet, loadMoreSignal = 0 }: WalletRecentTransactionsProps) {
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

  return (
    <View style={styles.section} testID="section-wallet-recent">
      <Text style={styles.title}>{shared ? "Giao dịch trong ví chung" : "Gần đây trong ví này"}</Text>
      {transactions.isLoading ? (
        Array.from({ length: RECENT_LIMIT }).map((_, i) => <TransactionRowSkeleton key={i} />)
      ) : isWaitingForNetwork(transactions) ? (
        <OfflinePlaceholder />
      ) : transactions.isError ? (
        <Text style={styles.empty}>Không tải được giao dịch của ví này.</Text>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>Ví này chưa có giao dịch nào.</Text>
      ) : (
        items.map((item) => (
          <View key={item.id}>
            <TransactionRow transaction={item} currency={wallet.currency} category={categories.get(item.category_id)} />
            {item.recorded_by ? (
              <Text style={styles.recorder} numberOfLines={1}>
                {item.recorded_by.name} ghi
              </Text>
            ) : null}
          </View>
        ))
      )}
      {/* The next page arriving, in the shape of what it will be. */}
      {transactions.isFetchingNextPage
        ? Array.from({ length: 2 }).map((_, i) => <TransactionRowSkeleton key={`more-${i}`} />)
        : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  section: { gap: spacing.xs },
  title: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  empty: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.lg },
  // Under the row, aligned past its icon, so it reads as part of that entry.
  recorder: { ...typography.tiny, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.xs, paddingLeft: 56 },
}));
