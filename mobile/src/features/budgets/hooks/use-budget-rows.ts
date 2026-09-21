import { useMemo } from "react";

import { WalletCurrency } from "@/lib/constants";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";
import { Budget } from "@/features/budgets/types";
import {
  budgetPeriodElapsed,
  budgetRowStatus,
  BudgetPaceState,
  daysInRange,
  proratedLimit,
} from "@/features/budgets/budget-pace";
import { BUDGET_FILTERS, BudgetFilterKey } from "@/features/budgets/components/BudgetFilterChips";

export interface BudgetRow {
  budget: Budget;
  limit: Budget["limits"][number];
  periodElapsed: number;
  status: ReturnType<typeof budgetRowStatus>;
}

/**
 * Every figure the Budgets tab draws, for the window it is looking at.
 *
 * Pulled out of the tab so that file stays within the 300-line limit, and so
 * the prorating rule below is stated once in a place that owns it.
 *
 * ⚠️ Amounts are integer cents throughout. `proratedLimit` is the only thing
 * here that divides one, and it is shared with the Insights donut so the two
 * surfaces can never quote different slices of the same limit.
 */
export function useBudgetRows({
  budgets,
  currency,
  dateRange,
  filter,
  paceElapsed,
}: {
  budgets: Budget[] | undefined;
  currency: WalletCurrency;
  dateRange: { from?: string; to?: string };
  filter: BudgetFilterKey;
  /** A deliberate clock dependency so rows re-derive across midnight. */
  paceElapsed: number;
}) {
  // ⚠️ `limit.spent` from the budgets endpoint is ALWAYS the current calendar
  // month — the backend has no date-range parameter for it. So a filtered view
  // cannot use it, and per-category spend for the selected range comes from the
  // reports endpoint instead, compared against a prorated slice of the limit.
  const rangeActive = Boolean(dateRange.from || dateRange.to);
  const rangeSummary = useReportSummaryQuery(rangeActive ? dateRange : {});


  // The backend resolves an open-ended range for us, so read the window back
  // from the response rather than guessing what a missing `from` meant.
  const resolvedRange = rangeSummary.data?.range;
  const rangeDayCount = useMemo(
    () => (resolvedRange ? daysInRange(resolvedRange.from, resolvedRange.to) : 1),
    [resolvedRange],
  );

  const spentByCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of rangeSummary.data?.by_category ?? []) {
      if (entry.type !== "expense" || entry.currency !== currency) continue;
      map.set(entry.category_id, (map.get(entry.category_id) ?? 0) + entry.amount);
    }
    return map;
  }, [rangeSummary.data, currency]);

  // How far through the selected window we are. A window that has already
  // finished is fully elapsed; one containing right now is however far into it
  // the clock has got — which for a single day is a fraction of today.
  const rangeElapsed = useMemo(() => {
    if (!resolvedRange) return 0;
    const [fy, fm, fd] = resolvedRange.from.slice(0, 10).split("-").map(Number);
    const [ty, tm, td] = resolvedRange.to.slice(0, 10).split("-").map(Number);
    const start = new Date(fy, fm - 1, fd).getTime();
    const end = new Date(ty, tm - 1, td + 1).getTime();
    const now = Date.now();
    if (now >= end) return 1;
    if (now <= start) return 0;
    return (now - start) / (end - start);
  }, [resolvedRange]);


  const rows = useMemo(() => {
    const all = (budgets ?? [])
      .flatMap((budget) => budget.limits.map((limit) => ({ budget, limit })))
      // Only the primary currency's limits belong on one scale — a USD limit
      // listed beside VND ones would make the summary's totals nonsense.
      .filter(({ limit }) => limit.currency === currency)
      // Each row is paced against its own start_date, not the shared month
      // figure — the summary card above still speaks for the whole month, but
      // a budget created on the 25th is not 83% through its first period.
      .map((row) => {
        if (!rangeActive) {
          const periodElapsed = budgetPeriodElapsed(row.budget.start_date);
          return { ...row, periodElapsed, limit: row.limit, status: budgetRowStatus(row.limit, periodElapsed) };
        }
        // Filtered: the limit is prorated to the range's length and the spend
        // comes from the report, so "today vs today's share" is a comparison
        // that actually means something. Against the untouched monthly limit a
        // heavy day reads as 3% used, which is worse than showing nothing.
        const spent = spentByCategory.get(row.budget.category_id) ?? 0;
        const scaledLimit = proratedLimit(row.limit.amount_limit, rangeDayCount);
        const limit = {
          ...row.limit,
          amount_limit: scaledLimit,
          spent,
          remaining: scaledLimit - spent,
          status: (spent > scaledLimit ? "exceeded" : "within") as typeof row.limit.status,
        };
        // A finished day is fully elapsed; today is however far through it we
        // are. Either way the marker answers "should this much be gone by now".
        const periodElapsed = rangeElapsed;
        return { ...row, periodElapsed, limit, status: budgetRowStatus(limit, periodElapsed) };
      });

    // Worst first: over, then at risk, then on track, then untouched. The
    // thing you opened this tab to find should never be below the fold.
    const rank: Record<BudgetPaceState, number> = { over: 0, "at-risk": 1, "on-track": 2, unused: 3 };
    return all.sort((a, b) => rank[a.status.state] - rank[b.status.state] || b.status.ratio - a.status.ratio);
    // paceElapsed is a deliberate clock dependency, not a value this memo
    // reads: budgetPeriodElapsed below calls new Date() itself, so without
    // something that changes at midnight every row's tick would freeze at
    // whatever it was when the screen mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets, currency, paceElapsed, rangeActive, rangeDayCount, rangeElapsed, spentByCategory]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      "at-risk": rows.filter((r) => r.status.state === "at-risk").length,
      over: rows.filter((r) => r.status.state === "over").length,
    }),
    [rows],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, { limit }) => ({ limit: acc.limit + limit.amount_limit, spent: acc.spent + limit.spent }),
        { limit: 0, spent: 0 },
      ),
    [rows],
  );

  const visibleRows = useMemo(() => {
    const states = BUDGET_FILTERS.find((f) => f.key === filter)?.states;
    if (!states) return rows;
    return rows.filter((r) => states.includes(r.status.state));
  }, [rows, filter]);

  return {
    rangeActive,
    rangeSummary,
    resolvedRange,
    rangeDayCount,
    rangeElapsed,
    rows,
    counts,
    totals,
    visibleRows,
  };
}
