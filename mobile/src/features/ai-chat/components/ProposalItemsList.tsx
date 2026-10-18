import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { createStyles, spacing, typography } from "@/lib/theme";
import { TransactionAdjustmentInput, TransactionItemInput } from "@/features/transactions/types";
import { FIXED_DIRECTIONS } from "@/features/transactions/items/line-math";
import { ADJUSTMENT_KIND_LABELS } from "@/features/transactions/components/AdjustmentRow";
import { adjustmentReviewKey, itemReviewKey } from "@/features/ai-chat/line-review";

// Glossary: needs-review mark, and the lines-total gap wording of ItemsTotalsPanel.
const NEEDS_REVIEW_LABEL = "Cần kiểm tra";

interface ProposalItemsListProps {
  items: TransactionItemInput[];
  adjustments?: TransactionAdjustmentInput[];
  currency: string;
  testIDSuffix?: string;
  /** Lines read with doubt from a photo (line-review.ts keys). */
  reviewKeys?: string[];
  /** Lines total minus the amount, in xu; non-zero only for an image proposal. */
  gap?: number;
  /** The proposal's amount, for the gap sentence. */
  amount?: number;
}

// The Items of one purchase on an AI proposal card (specs/transaction-line-
// items): a count that expands, so a long list never pushes Save off screen.
// Adjustments (tax, fee, discount — only ever added by editing the proposal)
// stay visible under it: they are few, and they are why the amount differs
// from the items' sum.
export function ProposalItemsList({ items, adjustments = [], currency, testIDSuffix, reviewKeys = [], gap = 0, amount }: ProposalItemsListProps) {
  const styles = useStyles();
  const marked = new Set(reviewKeys);
  // Something to check opens the list by itself.
  const [expanded, setExpanded] = useState(reviewKeys.length > 0);

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
              <View style={styles.nameColumn}>
                <Text style={styles.name} numberOfLines={2}>
                  {item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name}
                </Text>
                {marked.has(itemReviewKey(item)) ? (
                  <Text style={styles.review} testID={testIDSuffix ? `badge-line-review-${testIDSuffix}-${index}` : undefined}>
                    {NEEDS_REVIEW_LABEL}
                  </Text>
                ) : null}
              </View>
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
            <View style={styles.nameColumn}>
              <Text style={styles.name} numberOfLines={1}>
                {label}
              </Text>
              {marked.has(adjustmentReviewKey(adjustment)) ? <Text style={styles.review}>{NEEDS_REVIEW_LABEL}</Text> : null}
            </View>
            <Text style={styles.amount}>
              {`${direction === "subtract" ? "−" : "+"}${formatCurrency(adjustment.amount, currency)}`}
            </Text>
          </View>
        );
      })}
      {gap !== 0 ? (
        <Text style={styles.review} testID={testIDSuffix ? `txt-proposal-gap-${testIDSuffix}` : undefined}>
          {amount === undefined
            ? `Lệch ${formatCurrency(Math.abs(gap), currency)} so với số tiền giao dịch.`
            : `Lệch ${formatCurrency(Math.abs(gap), currency)} so với số tiền giao dịch ${formatCurrency(amount, currency)}.`}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { gap: spacing.xs },
  toggle: { ...typography.caption, color: colors.green },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  nameColumn: { flex: 1 },
  name: { ...typography.caption, color: colors.textPrimary },
  review: { ...typography.tiny, color: colors.mustard },
  amount: { ...typography.caption, color: colors.textSecondary },
}));
