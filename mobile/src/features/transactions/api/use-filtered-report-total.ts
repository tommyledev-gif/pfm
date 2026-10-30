import { useMemo } from "react";

import { ReportTotal } from "@/features/reports/types";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";
import { mainCurrency } from "@/features/transactions/other-currencies";

// The income/expense totals for a window, narrowed to a set of categories and,
// optionally, one wallet (GET /reports/summary takes `wallet_id` as is).
//
// GET /reports/summary takes a single `category_id`, not the multi-select the
// Transactions screen filters by, so a category selection is folded in
// client-side over the breakdown the same response already carries
// (`by_category`) — no second request, and no chance of the header disagreeing
// with the list under it. Without this the header kept reporting every
// category's total while the list below showed only the handful the user
// picked.
//
// Returns the underlying query's `refetch` alongside the derived total: the
// screen's pull-to-refresh has to reach this request too, and it is the one
// piece of server state on that screen not owned by a query the screen holds
// a handle to itself.
export function useFilteredReportTotal(
  range: { from?: string; to?: string },
  categoryIds: string[],
  walletId?: string,
  /** The list's own currency (its currency pill): the total speaks for it, 0 when it has none. */
  listCurrency?: string,
): {
  total: ReportTotal | null;
  otherCurrencies: string[];
  /** The same totals in each of otherCurrencies, in that order — what the header shows when they are opened. */
  otherTotals: ReportTotal[];
  refetch: () => Promise<unknown>;
} {
  // No wallet_id key at all when unfiltered, so the query key (and its cache)
  // stays the one every other caller of the period summary shares.
  const summary = useReportSummaryQuery(walletId ? { ...range, wallet_id: walletId } : range);
  const data = summary.data;
  const { refetch } = summary;
  // Joined so a caller passing a fresh array literal every render (which every
  // caller does) doesn't defeat the memo.
  const categoryKey = categoryIds.join(",");

  // The total speaks for one currency — VND when the period has it (it used
  // to be the report's first, sorted by code, so one USD row took over); the
  // others are named beside it instead (otherCurrenciesLabel).
  const { total, otherCurrencies, otherTotals } = useMemo(() => {
    const selected = categoryKey ? new Set(categoryKey.split(",")) : null;
    // One currency's figures for the window, narrowed to the selection.
    // Entries in another currency are dropped rather than added in — the same
    // "never sum incompatible currencies" rule the day subtotals follow.
    const totalIn = (currencyTotal: ReportTotal): ReportTotal => {
      if (!selected) return currencyTotal;
      const totals = (data?.by_category ?? [])
        .filter((c) => c.currency === currencyTotal.currency && selected.has(c.category_id))
        .reduce(
          (acc, c) => ({
            total_income: c.type === "income" ? acc.total_income + c.amount : acc.total_income,
            total_expense: c.type === "expense" ? acc.total_expense + c.amount : acc.total_expense,
          }),
          { total_income: 0, total_expense: 0 },
        );
      return { currency: currencyTotal.currency, ...totals, net: totals.total_income - totals.total_expense };
    };
    const periodCurrencies = [...new Set((data?.totals ?? []).map((t) => t.currency))];
    // With a category filter, only the currencies those categories were spent
    // in, falling back to the whole period when none of them has a row.
    const filtered = selected
      ? [...new Set((data?.by_category ?? []).filter((c) => selected.has(c.category_id)).map((c) => c.currency))]
      : periodCurrencies;
    const currency = listCurrency ?? mainCurrency(filtered.length > 0 ? filtered : periodCurrencies);
    const others = filtered.filter((c) => c !== currency);
    const othersTotals = others.flatMap((c) => {
      const row = data?.totals.find((t) => t.currency === c);
      return row ? [totalIn(row)] : [];
    });
    const summaryTotal =
      data?.totals.find((t) => t.currency === currency) ??
      (data && listCurrency ? { currency: listCurrency, total_income: 0, total_expense: 0, net: 0 } : undefined);
    return {
      total: summaryTotal ? totalIn(summaryTotal) : null,
      otherCurrencies: others,
      otherTotals: othersTotals,
    };
  }, [data, categoryKey, listCurrency]);

  return { total, otherCurrencies, otherTotals, refetch };
}
