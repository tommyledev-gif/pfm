import { Text, View } from "react-native";

import { AmountText } from "@/components/ui/AmountText";
import { PillButton } from "@/components/ui/PillButton";
import { formatCurrency } from "@/lib/currency";
import { createStyles, spacing, typography } from "@/lib/theme";
import { ItemsEditor } from "@/features/transactions/items/use-items-editor";

interface ItemsTotalsPanelProps {
  lines: ItemsEditor;
  amountCents: number | null;
  currency: string;
  onDone: () => void;
}

// Pinned under the Items editor: one total, and the gap only when there is
// one (Main Flow step 8). Matching says nothing: "Tổng 75.000 ₫" next to a
// 75.000 ₫ transaction is already the answer. The total counts tax, fee and
// discount lines, so a receipt with tax does not read as a gap. "Xong" never
// saves; the form's Lưu does.
export function ItemsTotalsPanel({ lines, amountCents, currency, onDone }: ItemsTotalsPanelProps) {
  const styles = useStyles();
  const hasItems = lines.items.length > 0;
  const mismatch = hasItems && lines.gap !== 0;
  const gapText = formatCurrency(Math.abs(lines.gap), currency);

  return (
    <View style={styles.container}>
      {hasItems ? (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Tổng</Text>
          <AmountText amountCents={lines.total} currency={currency} style={styles.totalValue} testID="txt-items-total" />
        </View>
      ) : null}
      {mismatch ? (
        <>
          <Text testID="txt-items-gap" style={styles.gap}>
            {amountCents !== null
              ? `Lệch ${gapText} so với số tiền giao dịch ${formatCurrency(amountCents, currency)}.`
              : `Lệch ${gapText} so với số tiền giao dịch.`}
          </Text>
          <View style={styles.fixes}>
            <PillButton testID="btn-items-add-difference" label="Ghi phần lệch" variant="outline" onPress={lines.addDifference} style={styles.flex} />
            <PillButton testID="btn-items-use-total" label="Lấy theo tổng" variant="outline" onPress={lines.applyTotalAsAmount} disabled={lines.total <= 0} style={styles.flex} />
          </View>
        </>
      ) : null}
      <PillButton testID="btn-items-done" label="Xong" onPress={onDone} />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  // flex: 1 because DrawerChildPanel lays its footer out as a row (built for
  // side-by-side buttons): without it this column shrank to its content and
  // the figures sat in the left half.
  container: { flex: 1, gap: spacing.sm },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: spacing.md },
  totalLabel: { ...typography.body, color: colors.textSecondary },
  totalValue: { ...typography.cardTitle, color: colors.textPrimary },
  gap: { ...typography.caption, color: colors.warning },
  fixes: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
}));
