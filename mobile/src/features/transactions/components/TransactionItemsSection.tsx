import { Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { createStyles, spacing, typography } from "@/lib/theme";
import { ItemsEditor } from "@/features/transactions/items/use-items-editor";
import { ADJUSTMENT_KIND_LABELS } from "@/features/transactions/components/AdjustmentLineEditor";

interface TransactionItemsSectionProps {
  lines: ItemsEditor;
  currency: string;
  // From the list row: how many Items exist even when none were ever loaded here.
  itemCount: number;
}

// Read-only view of a saved Transaction's Items while offline (spec EC-09,
// AC-26): editing needs a connection, reading the cached copy does not.
export function TransactionItemsSection({ lines, currency, itemCount }: TransactionItemsSectionProps) {
  const styles = useStyles();

  if (lines.items.length === 0) {
    if (itemCount === 0) return null;
    return (
      <Text testID="section-transaction-items" style={styles.note}>
        {itemCount} món. Kết nối mạng để xem các món.
      </Text>
    );
  }

  return (
    <View testID="section-transaction-items" style={styles.container}>
      <Text style={styles.title}>Các món</Text>
      {lines.items.map((item) => (
        <Row key={item.key} label={item.quantity > 1 ? `${item.name} × ${item.quantity}` : item.name} value={formatCurrency(item.amount ?? 0, currency)} />
      ))}
      {lines.adjustments.map((a) => (
        <Row
          key={a.key}
          label={a.kind === "other" ? a.label : ADJUSTMENT_KIND_LABELS[a.kind]}
          value={`${a.direction === "subtract" ? "−" : "+"}${formatCurrency(a.amount ?? 0, currency)}`}
        />
      ))}
      <Row label="Tổng các món" value={formatCurrency(lines.itemsTotal, currency)} strong />
    </View>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={[styles.label, strong && styles.strong]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.value, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { gap: spacing.xs },
  title: { ...typography.caption, color: colors.textSecondary },
  note: { ...typography.tiny, color: colors.textMuted },
  row: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  label: { ...typography.caption, color: colors.textPrimary, flex: 1 },
  value: { ...typography.caption, color: colors.textPrimary },
  strong: { fontWeight: "700" },
}));
