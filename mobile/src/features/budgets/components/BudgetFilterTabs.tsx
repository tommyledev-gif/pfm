import { useMemo } from "react";
import { StyleProp, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { TranslationKey } from "@/lib/i18n";
import { BudgetPaceState } from "@/features/budgets/budget-pace";

export type BudgetFilterKey = "all" | "at-risk" | "over";

export const BUDGET_FILTERS: {
  key: BudgetFilterKey;
  /** The tab's label, with how many budgets it holds. */
  labelKey: TranslationKey;
  states: readonly BudgetPaceState[] | null;
}[] = [
  { key: "all", labelKey: "budgets.tab.all", states: null },
  { key: "at-risk", labelKey: "budgets.tab.atRisk", states: ["at-risk"] },
  { key: "over", labelKey: "budgets.tab.over", states: ["over"] },
];

interface BudgetFilterTabsProps {
  value: BudgetFilterKey;
  onChange: (key: BudgetFilterKey) => void;
  counts: Record<BudgetFilterKey, number>;
  style?: StyleProp<ViewStyle>;
}

/**
 * The Budgets tab's status filters, as the app's segmented tabs: all, near
 * the limit, over it, each with its count ("Sắp vượt · 2"). They were chips,
 * each in its own colour with a count badge on its corner; beside the
 * summary card above, three coloured pills competed with the rows for
 * attention. The rows' own bars still carry the colour.
 */
export function BudgetFilterTabs({ value, onChange, counts, style }: BudgetFilterTabsProps) {
  const { t } = useTranslation();
  const options = useMemo(
    () => BUDGET_FILTERS.map((filter) => ({ value: filter.key, label: t(filter.labelKey, { count: counts[filter.key] }) })),
    [t, counts],
  );
  return <SegmentedTabs options={options} value={value} onChange={onChange} style={style} testID="tabs-budget-filter" />;
}
