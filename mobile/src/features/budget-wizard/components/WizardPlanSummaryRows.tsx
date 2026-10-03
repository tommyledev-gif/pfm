import { Text, View } from "react-native";

import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";

interface WizardPlanSummaryRowsProps {
  currency: string;
  /** xu — what no category has claimed yet. */
  buffer: number;
  /** xu — both already deducted before anything was divided up. */
  savings: number;
  fixed: number;
  overCommitted: boolean;
  shortfall: number;
}

/**
 * What sits below the category rows: the buffer, the two deducted totals, and
 * the over-commitment warning.
 *
 * ⚠️ Savings and fixed costs are reference lines, NOT budget rows. They were
 * subtracted before any of this was divided up, so listing them beside the
 * spending rows would double-count them and invite treating savings as just
 * another line to raid.
 */
export function WizardPlanSummaryRows({
  currency,
  buffer,
  savings,
  fixed,
  overCommitted,
  shortfall,
}: WizardPlanSummaryRowsProps) {
  const styles = useStyles();
  return (
    <>
      {buffer > 0 ? (
        <View style={styles.bufferRow}>
          <Text style={styles.bufferLabel}>🛟 Dự phòng</Text>
          <Text testID="text-wizard-buffer" style={styles.bufferValue}>
            {formatCurrency(buffer, currency)}
          </Text>
        </View>
      ) : null}

      <View style={styles.deducted}>
        <View style={styles.deductedRow}>
          <Text style={styles.deductedLabel}>📈 Tiết kiệm</Text>
          <Text style={styles.deductedValue}>{formatCurrency(savings, currency)}</Text>
        </View>
        <View style={styles.deductedRow}>
          <Text style={styles.deductedLabel}>🏠 Cố định</Text>
          <Text style={styles.deductedValue}>{formatCurrency(fixed, currency)}</Text>
        </View>
      </View>

      {overCommitted ? (
        <Text style={styles.warn}>
          Bạn khai nhiều hơn số còn được chi {formatCurrency(shortfall, currency)}. Bạn giảm bớt ở đâu đó nhé.
        </Text>
      ) : null}
    </>
  );
}

const useStyles = createStyles((colors) => ({
  bufferRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    paddingTop: spacing.sm,
  },
  bufferLabel: { ...typography.label, color: colors.textSecondary },
  bufferValue: { ...typography.label, color: colors.textSecondary },
  deducted: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.surfaceBorder, paddingTop: spacing.sm },
  deductedRow: { flexDirection: "row", justifyContent: "space-between" },
  deductedLabel: { ...typography.caption, color: colors.textMuted },
  deductedValue: { ...typography.caption, color: colors.textMuted },
  // Amber, not red — the plan is over-committed, which is a constraint the
  // user can resolve, not a system fault.
  warn: { ...typography.caption, color: colors.mustard },
}));
