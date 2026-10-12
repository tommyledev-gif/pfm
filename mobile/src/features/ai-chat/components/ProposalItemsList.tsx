import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { createStyles, spacing, typography } from "@/lib/theme";
import { TransactionAdjustmentInput, TransactionItemInput } from "@/features/transactions/types";
import { FIXED_DIRECTIONS } from "@/features/transactions/items/line-math";
import { ADJUSTMENT_KIND_LABELS } from "@/features/transactions/components/AdjustmentRow";

interface ProposalItemsListProps {
  items: TransactionItemInput[];
  adjustments?: TransactionAdjustmentInput[];
  currency: string;
  testIDSuffix?: string;
}

// The Items of one purchase on an AI proposal card (specs/transaction-line-
// items): a count that expands, so a long list never pushes Save off screen.
// Adjustments (tax, fee, discount — only ever added by editing the proposal)
// stay visible under it: they are few, and they are why the amount differs
// from the items' sum.
export function ProposalItemsList({ items, adjustments = [], currency, testIDSuffix }: ProposalItemsListProps) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable
        testID={testIDSuffix ? `btn-proposal-items-${testIDSuffix}` : undefined}
        accessibilityRole="button"
        onPress={() => setExpanded((v) => !v)}
      >
        <Text style={styles.toggle}>{expanded ? `Ẩn ${items.length} món` : `Xem ${items.length} món`}</Text>
      </Pressable>
      {expanded
        ? items.map((item, index) => (
            <View key={`${index}-${item.name}`} style={styles.row}>
              <Text style={styles.name} numberOfLines={2}>
                {item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name}
              </Text>
              <Text style={styles.amount}>{formatCurrency(item.amount, currency)}</Text>
            </View>
          ))
        : null}
      {adjustments.map((adjustment, index) => {
        // Tax, fee and discount carry no direction on the wire (BR-06).
        const direction = adjustment.direction ?? FIXED_DIRECTIONS[adjustment.kind] ?? "add";
        const label = adjustment.kind === "other" && adjustment.label ? adjustment.label : ADJUSTMENT_KIND_LABELS[adjustment.kind];
        return (
          <View key={`adj-${index}`} style={styles.row} testID={testIDSuffix ? `row-proposal-adjustment-${testIDSuffix}-${index}` : undefined}>
            <Text style={styles.name} numberOfLines={1}>
              {label}
            </Text>
            <Text style={styles.amount}>
              {`${direction === "subtract" ? "−" : "+"}${formatCurrency(adjustment.amount, currency)}`}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { gap: spacing.xs },
  toggle: { ...typography.caption, color: colors.green },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  name: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  amount: { ...typography.caption, color: colors.textSecondary },
}));
