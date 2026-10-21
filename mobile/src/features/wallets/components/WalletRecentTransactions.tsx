import { Pressable, Text, View } from "react-native";

import { TransactionRow } from "@/components/shared/TransactionRow";
import { useCategoryLookup } from "@/features/categories/api/use-category-lookup";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { Wallet } from "@/features/wallets/types";
import { isSharedWallet } from "@/features/wallets/wallet-access";
import { spacing, typography, createStyles } from "@/lib/theme";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { isWaitingForNetwork } from "@/lib/query-status";

interface WalletRecentTransactionsProps {
  wallet: Wallet;
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
 * when that was someone else, with "Xem thêm" for older ones.
 */
export function WalletRecentTransactions({ wallet }: WalletRecentTransactionsProps) {
  const styles = useStyles();
  const shared = isSharedWallet(wallet);
  const limit = shared ? SHARED_PAGE : RECENT_LIMIT;
  const transactions = useTransactionsQuery({ wallet_id: wallet.id, limit });
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
      {shared && transactions.hasNextPage ? (
        <Pressable
          onPress={() => void transactions.fetchNextPage()}
          disabled={transactions.isFetchingNextPage}
          hitSlop={8}
          style={styles.more}
          accessibilityRole="button"
          testID="btn-wallet-recent-more"
        >
          <Text style={styles.moreLabel}>{transactions.isFetchingNextPage ? "Đang tải…" : "Xem thêm"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  section: { gap: spacing.xs },
  title: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  empty: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.lg },
  // Under the row, aligned past its icon, so it reads as part of that entry.
  recorder: { ...typography.tiny, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.xs, paddingLeft: 56 },
  more: { alignSelf: "center", paddingVertical: spacing.md },
  moreLabel: { ...typography.label, color: colors.green },
}));
