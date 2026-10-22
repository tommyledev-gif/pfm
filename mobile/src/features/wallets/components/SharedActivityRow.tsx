import { memo } from "react";
import { Text, View } from "react-native";

import { TransactionRow } from "@/components/shared/TransactionRow";
import { spacing, typography, createStyles } from "@/lib/theme";
import { Category } from "@/features/categories/types";
import { Transaction } from "@/features/transactions/types";

interface SharedActivityRowProps {
  item: Transaction;
  currency: string | undefined;
  category: Category | undefined;
  /** Stable (useCallback): rows are memoized on it. */
  onSelect: (transaction: Transaction) => void;
}

/**
 * One entry of a shared wallet, saying who recorded it when that was someone
 * else (specs/shared-wallets BR-13). Only the recorder can edit an entry
 * (BR-07), so someone else's row reads but does not open.
 */
export const SharedActivityRow = memo(function SharedActivityRow({
  item,
  currency,
  category,
  onSelect,
}: SharedActivityRowProps) {
  const styles = useStyles();
  const mine = !item.recorded_by;
  return (
    <View>
      <TransactionRow
        transaction={item}
        currency={currency}
        category={category}
        onPress={mine ? () => onSelect(item) : undefined}
      />
      {item.recorded_by ? (
        <Text style={styles.recorder} numberOfLines={1}>
          {item.recorded_by.name} ghi
        </Text>
      ) : null}
    </View>
  );
});

const useStyles = createStyles((colors) => ({
  // Under the row, aligned past its icon, so it reads as part of that entry
  // (same placement as WalletRecentTransactions).
  recorder: { ...typography.tiny, color: colors.textMuted, marginTop: -spacing.xs, marginBottom: spacing.xs, paddingLeft: 56 },
}));
