import { memo } from "react";
import { Animated } from "react-native";

import { TransactionRow } from "@/components/shared/TransactionRow";
import { Category } from "@/features/categories/types";
import { Transaction } from "@/features/transactions/types";

interface TransactionListRowProps {
  item: Transaction;
  currency: string | undefined;
  category: Category | undefined;
  highlightOpacity: Animated.Value | undefined;
  onSelect: (transaction: Transaction) => void;
}

/** A Transactions list row; memoized on a stable `onSelect`, so a screen render skips it. */
export const TransactionListRow = memo(function TransactionListRow({
  item,
  currency,
  category,
  highlightOpacity,
  onSelect,
}: TransactionListRowProps) {
  return (
    <TransactionRow
      transaction={item}
      currency={currency}
      category={category}
      onPress={() => onSelect(item)}
      highlightOpacity={highlightOpacity}
    />
  );
});
