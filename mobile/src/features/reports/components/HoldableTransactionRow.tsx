import { Pressable } from "react-native";

import { PopoverAnchor } from "@/components/shared/ActionPopover";
import { TransactionRow } from "@/components/shared/TransactionRow";
import { withAlpha } from "@/lib/color";
import { radii, spacing, createStyles } from "@/lib/theme";
import { useAnchoredLongPress } from "@/features/ai-chat/hooks/use-anchored-long-press";
import { Transaction } from "@/features/transactions/types";

// How long a row has to be held before its menu opens.
export const ROW_HOLD_MS = 1000;
const HELD_FILL_ALPHA = 0.08;

interface HoldableTransactionRowProps {
  transaction: Transaction;
  currency?: string;
  category?: { icon: string | null; icon_url: string | null };
  /** Its menu is open: the row stays pressed-in while it is. */
  held: boolean;
  onHold: (transaction: Transaction, anchor: PopoverAnchor) => void;
}

/**
 * A read-only transaction row that answers a hold: darker from the moment the
 * finger lands (the pressed look, kept for as long as it stays down), and
 * after ROW_HOLD_MS it hands its own frame back so a menu can open beside it.
 * A tap does nothing. The amount's own hold-to-reveal is off, or it would
 * take the hold for itself whenever the finger landed on the amount.
 */
export function HoldableTransactionRow({ transaction, currency, category, held, onHold }: HoldableTransactionRowProps) {
  const styles = useStyles();
  const { ref, handleLongPress } = useAnchoredLongPress((anchor) => onHold(transaction, anchor));
  return (
    <Pressable
      ref={ref}
      onLongPress={handleLongPress}
      delayLongPress={ROW_HOLD_MS}
      style={({ pressed }) => [styles.row, (pressed || held) && styles.rowHeld]}
      testID={`row-category-transaction-${transaction.id}`}
    >
      <TransactionRow transaction={transaction} currency={currency} category={category} revealAmountOnHold={false} />
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  // The fill bleeds past the text by its own padding, so the content does
  // not move when it appears.
  row: { marginHorizontal: -spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.listCard },
  rowHeld: { backgroundColor: withAlpha(colors.overlayBase, HELD_FILL_ALPHA) },
}));
