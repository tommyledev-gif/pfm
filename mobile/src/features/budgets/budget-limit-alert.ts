import { formatCurrency } from "@/lib/currency";
import { i18n } from "@/lib/i18n";
import { Budget } from "@/features/budgets/types";
import { ToastVariant } from "@/stores/toast-store";

// "Almost hit" fires once spent crosses 80% of the limit — chosen as a
// reasonable early-warning point (no product spec pins an exact number yet);
// backend's own budget_exceeded notification job (F-10) only fires at 100%,
// so this client-side check is what covers the "almost" half of item #4.
const ALMOST_LIMIT_RATIO = 0.8;

export interface BudgetLimitAlert {
  message: string;
  variant: Extract<ToastVariant, "error" | "warning">;
}

// Finds the Budget backing `categoryId` (if any) and compares its
// already-live-recomputed `spent` (see backend budget_service.go's
// computeStatus — never stale, refetched by the caller right before this
// runs) against `amount_limit` in `currency`. Returns null when there's no
// budget for this category/currency, or spend is comfortably under it.
// The message is written in the app language at the moment it is raised.
export function budgetLimitAlert(budgets: Budget[], categoryId: string, currency: string): BudgetLimitAlert | null {
  const budget = budgets.find((b) => b.category_id === categoryId);
  if (!budget) return null;

  const limit = budget.limits.find((l) => l.currency === currency);
  if (!limit || limit.amount_limit <= 0) return null;

  const ratio = limit.spent / limit.amount_limit;
  const values = {
    category: budget.category_name,
    spent: formatCurrency(limit.spent, currency),
    limit: formatCurrency(limit.amount_limit, currency),
  };

  if (ratio >= 1) {
    return {
      message: i18n.t("budgets.alert.over", values),
      variant: "error",
    };
  }
  if (ratio >= ALMOST_LIMIT_RATIO) {
    return {
      message: i18n.t("budgets.alert.near", values),
      variant: "warning",
    };
  }
  return null;
}
