import { useMemo } from "react";

import { ReportTotal } from "@/features/reports/types";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";

// The income/expense totals for a window, narrowed to a set of categories.
//
// GET /reports/summary takes a single `category_id`, not the multi-select the
// Transactions screen filters by, so a category selection is folded in
// client-side over the breakdown the same response already carries
// (`by_category`) — no second request, and no chance of the header disagreeing
// with the list under it. Without this the header kept reporting every
// category's total while the list below showed only the handful the user
// picked.
export function useFilteredReportTotal(
  range: { from?: string; to?: string },
  categoryIds: string[],
): ReportTotal | null {
  const summary = useReportSummaryQuery(range);
  const data = summary.data;
  // Joined so a caller passing a fresh array literal every render (which every
  // caller does) doesn't defeat the memo.
  const categoryKey = categoryIds.join(",");

  return useMemo(() => {
    const summaryTotal = data?.totals[0];
    if (!summaryTotal) return null;
    if (!categoryKey) return summaryTotal;

    const selected = new Set(categoryKey.split(","));
    // Entries in another currency are dropped rather than added in — the same
    // "never sum incompatible currencies" rule the day subtotals follow; this
    // only ever speaks for the primary currency.
    const totals = (data?.by_category ?? [])
      .filter((c) => c.currency === summaryTotal.currency && selected.has(c.category_id))
      .reduce(
        (acc, c) => ({
          total_income: c.type === "income" ? acc.total_income + c.amount : acc.total_income,
          total_expense: c.type === "expense" ? acc.total_expense + c.amount : acc.total_expense,
        }),
        { total_income: 0, total_expense: 0 },
      );

    return {
      currency: summaryTotal.currency,
      ...totals,
      net: totals.total_income - totals.total_expense,
    };
  }, [data, categoryKey]);
}
