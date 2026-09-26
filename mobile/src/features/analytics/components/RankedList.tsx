import { StyleSheet, Text, View } from "react-native";

import { AnalyticsTxRow } from "@/features/analytics/types";
import { formatCurrency } from "@/lib/currency";
import { colors, spacing, typography } from "@/lib/theme";

interface RankedListProps {
  rows: AnalyticsTxRow[];
  currency: string;
  totalMatched?: number;
}

const RANK_COLUMN_WIDTH = 16;

function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Q5/Q6/Q14. Notes are never part of an answer (plan.md BR-22) — Category,
// Wallet and date identify each row instead.
export function RankedList({ rows, currency, totalMatched }: RankedListProps) {
  const hidden = totalMatched !== undefined ? totalMatched - rows.length : 0;
  return (
    <View style={styles.wrap}>
      {rows.map((row, i) => (
        <View key={row.id} style={styles.row}>
          <Text style={styles.rank}>{i + 1}</Text>
          <View style={styles.middle}>
            <Text style={styles.title} numberOfLines={1}>
              {row.category_name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {shortDate(row.occurred_at)} · {row.wallet_name}
            </Text>
          </View>
          <Text style={styles.amount}>{formatCurrency(row.amount, currency)}</Text>
        </View>
      ))}
      {hidden > 0 ? <Text style={styles.more}>và {hidden} khoản khác</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rank: { ...typography.caption, color: colors.textMuted, width: RANK_COLUMN_WIDTH },
  middle: { flex: 1 },
  title: { ...typography.label, color: colors.textPrimary },
  meta: { ...typography.tiny, color: colors.textMuted },
  amount: { ...typography.label, color: colors.textPrimary },
  more: { ...typography.caption, color: colors.textSecondary },
});
