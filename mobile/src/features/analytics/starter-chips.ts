import { AnalyticsFollowUp, AnalyticsQuery } from "@/features/analytics/types";
import { i18n, TranslationKey } from "@/lib/i18n";

// The label is read when the chip is shown (a getter), not when this module
// loads, so the list kept below still follows the app language.
function chip(labelKey: TranslationKey, query: AnalyticsQuery): AnalyticsFollowUp {
  return {
    get label() {
      return i18n.t(labelKey);
    },
    query,
  };
}

/**
 * The starter row shown in analysis mode (spec.md US-01, OQ #3: Q1, Q2, Q9,
 * Q10). Each chip is a complete question — tapping one needs no
 * interpretation and never counts toward the free-text limit. Mirrors the
 * backend's starterChips() in consult_routing.go, which offers the same set
 * on every fallback reply.
 */
export const STARTER_CHIPS: AnalyticsFollowUp[] = [
  chip("analytics.starter.spentThisMonth", { metric: "sum", period: "this_cycle" }),
  chip("analytics.starter.whereMoneyWent", { metric: "breakdown", group_by: "category", period: "this_cycle" }),
  chip("analytics.starter.budgetLeft", { metric: "budget_status", period: "this_cycle" }),
  chip("analytics.starter.incomeThisMonth", { metric: "sum", tx_type: "income", period: "this_cycle" }),
];

/**
 * "Anything unusual today?" — the anomaly answer for one local day
 * (backend consult_anomaly.go's anomalyTodayChip asks the same). Built per
 * render rather than kept in STARTER_CHIPS, so a pane left open past
 * midnight asks about the new day.
 */
export function anomalyTodayChip(today: string): AnalyticsFollowUp {
  return { label: i18n.t("analytics.starter.unusualToday"), query: { metric: "anomaly", period: "custom", from: today, to: today } };
}
