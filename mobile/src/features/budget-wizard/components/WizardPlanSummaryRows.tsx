import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { FIXED_COST_PROMPTS, FixedCostItem } from "@/features/budget-wizard/fixed-costs";
import { formatCurrency } from "@/lib/currency";
import { spacing, typography, createStyles } from "@/lib/theme";

interface WizardPlanSummaryRowsProps {
  currency: string;
  /** xu — what no category has claimed yet. */
  buffer: number;
  /** xu — both already deducted before anything was divided up. */
  savings: number;
  fixed: number;
  /** What `fixed` is made of (use-wizard-fixed-costs); empty when the user
   *  only ever set the total. Adds up to `fixed`. */
  fixedItems: FixedCostItem[];
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
 *
 * The fixed-cost total lists the costs the user entered on screen 1 under it
 * (rent, electricity, …). A bare total there was a number the user had typed
 * as a list a minute earlier and could no longer check against it.
 */
export function WizardPlanSummaryRows({
  currency,
  buffer,
  savings,
  fixed,
  fixedItems,
  overCommitted,
  shortfall,
}: WizardPlanSummaryRowsProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  // A ticked prompt is named in the current language, from its key; anything
  // the user typed keeps their own words.
  const itemLabel = (item: FixedCostItem) => {
    const prompt = item.source === "suggested" ? FIXED_COST_PROMPTS.find((p) => p.key === item.key) : undefined;
    return prompt ? t(prompt.labelKey) : item.label;
  };
  return (
    <>
      {buffer > 0 ? (
        <View style={styles.bufferRow}>
          <Text style={styles.bufferLabel}>{t("budgetWizard.summary.buffer")}</Text>
          <Text testID="text-wizard-buffer" style={styles.bufferValue}>
            {formatCurrency(buffer, currency)}
          </Text>
        </View>
      ) : null}

      <View style={styles.deducted}>
        <View style={styles.deductedRow}>
          <Text style={styles.deductedLabel}>{t("budgetWizard.summary.savings")}</Text>
          <Text style={styles.deductedValue}>{formatCurrency(savings, currency)}</Text>
        </View>
        <View style={styles.deductedRow}>
          <Text style={styles.deductedLabel}>{t("budgetWizard.summary.fixed")}</Text>
          <Text style={styles.deductedValue}>{formatCurrency(fixed, currency)}</Text>
        </View>
        {fixedItems.map((item, index) => (
          // Index in the key: two typed lines can share a label ("điện 300k, điện 200k").
          <View key={`${index}-${item.key}`} style={[styles.deductedRow, styles.fixedItem]} testID="row-wizard-fixed-item">
            <Text style={styles.fixedItemLabel} numberOfLines={1}>
              {itemLabel(item)}
            </Text>
            <Text style={styles.fixedItemValue}>{formatCurrency(item.amountXu, currency)}</Text>
          </View>
        ))}
      </View>

      {overCommitted ? (
        <Text style={styles.warn}>
          {t("budgetWizard.summary.overCommitted", { amount: formatCurrency(shortfall, currency) })}
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
  deductedRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  deductedLabel: { ...typography.caption, color: colors.textMuted },
  deductedValue: { ...typography.caption, color: colors.textMuted },
  // Indented under the total they add up to, one step smaller, so they read as
  // its breakdown rather than as more lines of the same kind.
  fixedItem: { paddingLeft: spacing.md },
  fixedItemLabel: { ...typography.tiny, color: colors.textMuted, flexShrink: 1 },
  fixedItemValue: { ...typography.tiny, color: colors.textMuted },
  // Amber, not red — the plan is over-committed, which is a constraint the
  // user can resolve, not a system fault.
  warn: { ...typography.caption, color: colors.mustard },
}));
