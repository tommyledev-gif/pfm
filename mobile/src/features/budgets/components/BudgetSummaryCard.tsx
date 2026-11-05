import { ComponentProps } from "react";
import { Animated, View } from "react-native";

import { radii, spacing, createStyles } from "@/lib/theme";
import { BudgetMonthSummary } from "@/features/budgets/components/BudgetMonthSummary";
import { BudgetRangeRow } from "@/features/budgets/components/BudgetRangeRow";

interface BudgetSummaryCardProps {
  rangeLabel: string;
  /** A range is applied: the range line offers to clear it. */
  filtered: boolean;
  /** Days left in the month, beside the range; null under a range. */
  daysLeft: number | null;
  onOpenPicker: () => void;
  onClear: () => void;
  /**
   * The figures, or null while a picked range has none to show yet. Under a
   * range they describe that window, not the month: the totals come from the
   * filtered rows, so `elapsed` is the window's too, or the card contradicts
   * itself.
   */
  figures: {
    elapsed: number;
    totalLimit: number;
    totalSpent: number;
    currency: string;
    overCount: number;
  } | null;
  /** Dims the figures while a newly picked range loads (useDimWhile). */
  dimStyle: ComponentProps<typeof Animated.View>["style"];
}

/**
 * The top of the Budgets tab: one card for the period and how it stands, its
 * range line (with the days left) over the remaining figure and its bar.
 * Split out of BudgetsTab for the 300-line limit.
 */
export function BudgetSummaryCard({
  rangeLabel,
  filtered,
  daysLeft,
  onOpenPicker,
  onClear,
  figures,
  dimStyle,
}: BudgetSummaryCardProps) {
  const styles = useStyles();
  return (
    <View style={styles.card}>
      <BudgetRangeRow
        label={rangeLabel}
        filtered={filtered}
        daysLeft={daysLeft}
        onOpenPicker={onOpenPicker}
        onClear={onClear}
      />
      {figures ? (
        <Animated.View style={dimStyle}>
          <BudgetMonthSummary {...figures} />
        </Animated.View>
      ) : null}
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  card: {
    gap: spacing.sm,
    padding: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radii.card,
    backgroundColor: colors.surface,
  },
}));
