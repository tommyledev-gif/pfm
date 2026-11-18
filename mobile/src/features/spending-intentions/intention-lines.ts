import { TFunction } from "i18next";

import { formatCurrency } from "@/lib/currency";
import { IntentionAssessment, IntentionBudget } from "@/features/spending-intentions/types";

/** One line under an intention: a figure, a fit verdict, or a note on a missing figure. */
export type IntentionLine =
  | { key: string; type: "amount"; label: string; amount: number; currency: string }
  | { key: string; type: "verdict"; label: string; fits: boolean }
  | { key: string; type: "note"; label: string };

/**
 * The lines of a Budget's figures. The first says what the Budget stands at:
 * what is left of it this cycle (the Budgets screen's own number), what is left
 * of it once the Category's usual spending is taken out (a later month), or just
 * its limit (no history). A second says what is left after the other plans in
 * the same Category, when there are any.
 */
export function budgetLines(t: TFunction, budget: IntentionBudget, currency: string): IntentionLine[] {
  const category = budget.category_name;
  const lines: IntentionLine[] = [];
  if (budget.basis === "this_cycle") {
    lines.push({ key: "budget", type: "amount", label: t("intentions.lines.budgetLeft", { category }), amount: budget.remaining, currency });
  } else if (budget.basis === "usual") {
    lines.push({ key: "budget", type: "amount", label: t("intentions.lines.budgetRoom", { category }), amount: budget.remaining, currency });
  } else {
    lines.push({ key: "budget", type: "amount", label: t("intentions.lines.budgetLimit", { category }), amount: budget.limit, currency });
  }
  if (budget.other_planned > 0 && budget.left !== undefined) {
    lines.push({ key: "budgetAfterOthers", type: "amount", label: t("intentions.lines.budgetAfterOthers", { category }), amount: budget.left, currency });
  }
  return lines;
}

/**
 * The lines of an intention's figures, in reading order: what the month
 * usually leaves, what other plans take, what the Budget has left, then
 * whether this plan fits each. Facts against the User's own limits and
 * history, never advice (spec.md Context rule 3). A figure the server could
 * not work out is left out and one note says why.
 */
export function intentionLines(t: TFunction, a: IntentionAssessment): IntentionLine[] {
  const lines: IntentionLine[] = [];
  const money = (cents: number) => formatCurrency(cents, a.currency);

  if (a.surplus === undefined) {
    lines.push({ key: "noHistory", type: "note", label: t("intentions.lines.noHistory") });
  } else {
    lines.push({ key: "surplus", type: "amount", label: t("intentions.lines.surplus"), amount: a.surplus, currency: a.currency });
    if (a.other_planned > 0 && a.headroom !== undefined) {
      lines.push({ key: "otherPlanned", type: "amount", label: t("intentions.lines.otherPlanned"), amount: a.other_planned, currency: a.currency });
      lines.push({ key: "headroom", type: "amount", label: t("intentions.lines.headroom"), amount: a.headroom, currency: a.currency });
    }
  }
  if (a.budget) lines.push(...budgetLines(t, a.budget, a.currency));

  if (a.fits_surplus !== undefined) {
    lines.push({
      key: "fitsSurplus",
      type: "verdict",
      fits: a.fits_surplus,
      label: a.fits_surplus ? t("intentions.lines.fitsSurplus") : t("intentions.lines.shortSurplus", { amount: money(a.short_surplus ?? 0) }),
    });
  }
  if (a.fits_budget !== undefined) {
    lines.push({
      key: "fitsBudget",
      type: "verdict",
      fits: a.fits_budget,
      label: a.fits_budget ? t("intentions.lines.fitsBudget") : t("intentions.lines.shortBudget", { amount: money(a.short_budget ?? 0) }),
    });
  }
  return lines;
}
