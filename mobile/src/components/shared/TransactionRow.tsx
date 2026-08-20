import { StyleSheet, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { colorForCategory } from "@/lib/category-color";
import { formatCurrency } from "@/lib/currency";
import { formatTime } from "@/lib/format-date";
import { colors, spacing, typography } from "@/lib/theme";
import { Transaction } from "@/features/transactions/types";

// Home's "Recent Transactions" and the full Transactions list both render
// this exact row shape (README: "Row = icon circle + name/time + amount +
// sub-label (category · wallet)").
// `currency` comes from the caller's wallet lookup — Transaction itself
// carries no currency field (only a denormalized wallet_name), the backend
// resolves currency via the wallet relation, so mobile must too.
// `category` is an optional lookup result (icon/icon_url) from the caller's
// own categories fetch — Transaction itself only carries a denormalized
// category_name, same reasoning as the `currency` prop above.
export function TransactionRow({
  transaction,
  currency,
  category,
}: {
  transaction: Transaction;
  currency?: string;
  category?: { icon: string | null; icon_url: string | null };
}) {
  const isIncome = transaction.type === "income";
  const label = transaction.note?.trim() || transaction.category_name;

  return (
    <View style={styles.row}>
      <Avatar
        name={label}
        color={colorForCategory(transaction.category_id)}
        size={44}
        icon={category?.icon}
        iconUrl={category?.icon_url}
      />
      <View style={styles.middle}>
        <Text style={styles.title} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {transaction.category_name} · {transaction.wallet_name}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: isIncome ? colors.green : colors.peach }]}>
          {isIncome ? "+" : "-"}
          {formatCurrency(transaction.amount, currency)}
        </Text>
        <Text style={styles.time}>{formatTime(transaction.occurred_at)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm },
  middle: { flex: 1, gap: 2 },
  title: { ...typography.body, color: colors.textPrimary },
  sub: { ...typography.tiny, color: colors.textSecondary },
  right: { alignItems: "flex-end", gap: 2 },
  amount: { ...typography.body },
  time: { ...typography.tiny, color: colors.textMuted },
});
