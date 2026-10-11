import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { createStyles, spacing, typography } from "@/lib/theme";
import { TransactionItemInput } from "@/features/transactions/types";

interface ProposalItemsListProps {
  items: TransactionItemInput[];
  currency: string;
  testIDSuffix?: string;
}

// The Items of one purchase on an AI proposal card (specs/transaction-line-
// items): a count that expands, so a long list never pushes Save off screen.
export function ProposalItemsList({ items, currency, testIDSuffix }: ProposalItemsListProps) {
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
