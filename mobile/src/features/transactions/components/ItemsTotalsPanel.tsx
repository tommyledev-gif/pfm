import { Text, View } from "react-native";

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

// Pinned under the Items editor: the figures and, when they do not match, the
// two fixes (Main Flow step 8). "Xong" never saves — the form's save does.
export function ItemsTotalsPanel({ lines, amountCents, currency, onDone }: ItemsTotalsPanelProps) {
  const styles = useStyles();
  const hasItems = lines.items.length > 0;
  const matched = lines.gap === 0;

  return (
    <View style={styles.container}>
      {hasItems ? (
        <>
          <TotalRow label="Tổng các món" value={formatCurrency(lines.itemsTotal, currency)} testID="txt-items-total" />
          {lines.adjustments.length > 0 ? (
            <TotalRow label="Sau thuế, phí, giảm giá" value={formatCurrency(lines.total, currency)} />
          ) : null}
          <TotalRow label="Số tiền giao dịch" value={amountCents === null ? "Chưa nhập" : formatCurrency(amountCents, currency)} />
          {matched ? (
            <Text style={styles.matched}>Khớp số tiền giao dịch</Text>
          ) : (
            <>
              <Text testID="txt-items-gap" style={styles.gap}>
                Lệch {formatCurrency(Math.abs(lines.gap), currency)} so với số tiền giao dịch.
              </Text>
              <View style={styles.fixes}>
                <PillButton testID="btn-items-add-difference" label="Ghi phần lệch" variant="outline" onPress={lines.addDifference} style={styles.flex} />
                <PillButton testID="btn-items-use-total" label="Lấy theo tổng" variant="outline" onPress={lines.applyTotalAsAmount} disabled={lines.total <= 0} style={styles.flex} />
              </View>
            </>
          )}
        </>
      ) : null}
      <PillButton testID="btn-items-done" label="Xong" onPress={onDone} />
    </View>
  );
}

function TotalRow({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text testID={testID} style={styles.totalValue}>{value}</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { gap: spacing.sm },
  totalRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  totalLabel: { ...typography.caption, color: colors.textSecondary },
  totalValue: { ...typography.label, color: colors.textPrimary },
  matched: { ...typography.caption, color: colors.green },
  gap: { ...typography.caption, color: colors.error },
  fixes: { flexDirection: "row", gap: spacing.sm },
  flex: { flex: 1 },
}));
