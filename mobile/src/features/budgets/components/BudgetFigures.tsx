import { Text, View } from "react-native";

import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatCurrency } from "@/lib/currency";
import { formatPercent } from "@/lib/percent";
import { radii, spacing, typography, createStyles, useColors } from "@/lib/theme";

// From this share of the limit on, the bar leans amber: the next spend of
// this size plausibly crosses it.
const NEAR_LIMIT_RATIO = 0.8;

interface BudgetFiguresProps {
  spent: number;
  limit: number;
  currency: string;
  /** The window the figures cover ("Tháng này", a picked range). */
  periodLabel?: string;
}

/**
 * One budget's three figures spelled out, each under its own name: what was
 * spent, the limit, and what is left (or how far over). The list row packs
 * them into a corner figure, a "%·Còn" caption and a "Hạn mức:" line, which
 * reads fine at a glance but not as an answer; this is where they are read
 * properly (the budget's sheet and its transactions sheet). Exact amounts,
 * never the short k / m / b form.
 */
export function BudgetFigures({ spent, limit, currency, periodLabel }: BudgetFiguresProps) {
  const colors = useColors();
  const styles = useStyles();
  const remaining = limit - spent;
  const over = remaining < 0;
  const ratio = limit > 0 ? spent / limit : 0;
  const tone = over ? colors.peach : ratio >= NEAR_LIMIT_RATIO ? colors.mustard : colors.mint;

  return (
    <View style={styles.box} testID="budget-figures">
      <View style={styles.headRow}>
        <Text style={[styles.share, { color: tone }]}>Đã dùng {formatPercent(ratio * 100)} hạn mức</Text>
        {periodLabel ? <Text style={styles.period}>{periodLabel}</Text> : null}
      </View>
      <ProgressBar progress={ratio} color={tone} height={8} />
      <View style={styles.cells}>
        <Figure label="Đã chi" value={formatCurrency(spent, currency)} />
        <Figure label="Hạn mức" value={formatCurrency(limit, currency)} />
        <Figure
          label={over ? "Vượt" : "Còn lại"}
          value={formatCurrency(Math.abs(remaining), currency)}
          color={over ? colors.peach : colors.textPrimary}
        />
      </View>
    </View>
  );
}

function Figure({ label, value, color }: { label: string; value: string; color?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={[styles.cellValue, color ? { color } : null]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  box: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.listCard, backgroundColor: colors.surfaceRaised },
  headRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: spacing.sm },
  share: { ...typography.label },
  period: { ...typography.tiny, color: colors.textSecondary },
  cells: { flexDirection: "row", gap: spacing.sm },
  cell: { flex: 1, gap: 2 },
  cellLabel: { ...typography.tiny, color: colors.textSecondary },
  cellValue: { ...typography.body, fontWeight: "700", color: colors.textPrimary },
}));
