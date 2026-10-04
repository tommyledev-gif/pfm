import { Text, View } from "react-native";

import { TransactionRow } from "@/components/shared/TransactionRow";
import { useCategoryLookup } from "@/features/categories/api/use-category-lookup";
import { useTransactionsQuery } from "@/features/transactions/api/use-transactions-query";
import { TransactionRowSkeleton } from "@/features/transactions/components/TransactionRowSkeleton";
import { Wallet } from "@/features/wallets/types";
import { spacing, typography, createStyles } from "@/lib/theme";
import { OfflinePlaceholder } from "@/components/shared/OfflinePlaceholder";
import { isWaitingForNetwork } from "@/lib/query-status";

interface WalletRecentTransactionsProps {
  wallet: Wallet;
}

// Enough to answer "what moved in this wallet lately" at a glance; the full
// history is the Transactions tab's job.
const RECENT_LIMIT = 3;

/**
 * The last few transactions of the wallet the card view is centred on — so
 * swiping to a wallet shows what has been happening in it, not just its
 * balance. Follows the carousel: a different card, a different list.
 */
export function WalletRecentTransactions({ wallet }: WalletRecentTransactionsProps) {
  const styles = useStyles();
  const transactions = useTransactionsQuery({ wallet_id: wallet.id, limit: RECENT_LIMIT });
  const categories = useCategoryLookup();
  const items = (transactions.data?.pages[0]?.data ?? []).slice(0, RECENT_LIMIT);

  return (
    <View style={styles.section} testID="section-wallet-recent">
      <Text style={styles.title}>Gần đây trong ví này</Text>
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
          <TransactionRow
            key={item.id}
            transaction={item}
            currency={wallet.currency}
            category={categories.get(item.category_id)}
          />
        ))
      )}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  section: { gap: spacing.xs },
  title: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.xs },
  empty: { ...typography.body, color: colors.textSecondary, paddingVertical: spacing.lg },
}));
