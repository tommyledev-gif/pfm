import { Budget } from "@/features/budgets/types";

export interface BudgetTotals {
  limit: number;
  spent: number;
  remaining: number;
  currency: string;
}

// Home's budget snapshot needs one combined number, but each Budget can
// carry limits in multiple currencies (BudgetLimit[]) — sum only the limits
// matching `currency` (mirrors wallet-totals.ts's own "only sum the primary
// currency, never add incompatible currencies together" reasoning). Callers
// pass whichever currency the rest of the snapshot is already using so the
// numbers on screen never mix currencies. `currency` is a plain string here,
// not the stricter WalletCurrency union — same convention as
// ReportTotal.currency/formatCurrency, since this is already-resolved
// display data, not a form the user is picking a currency in.
export function budgetTotals(budgets: Budget[], currency: string): BudgetTotals | null {
  const limits = budgets.flatMap((b) => b.limits.filter((l) => l.currency === currency));
  if (limits.length === 0) return null;
  const totals = limits.reduce(
    (sum, l) => ({ limit: sum.limit + l.amount_limit, spent: sum.spent + l.spent, remaining: sum.remaining + l.remaining }),
    { limit: 0, spent: 0, remaining: 0 },
  );
  return { ...totals, currency };
}
