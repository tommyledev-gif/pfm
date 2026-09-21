import { useMemo } from "react";

import { currentPeriodRange, monthRange, previousPeriodRange } from "@/lib/date-range";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { budgetTotals } from "@/features/budgets/budget-totals";
import {
  budgetPeriodElapsed,
  budgetRowStatus,
  daysLeftInMonth,
  remainingPerDay,
} from "@/features/budgets/budget-pace";
import { AtRiskBudgetRow } from "@/features/reports/components/HomeSnapshotCard";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { primaryCurrency } from "@/features/wallets/wallet-totals";
import { HomePeriod } from "@/stores/ui-prefs-store";

const TOP_CATEGORIES_COUNT = 3;
const FALLBACK_CURRENCY = "VND";

/**
 * Every figure the home snapshot shows.
 *
 * Pulled out of the screen so that file stays under the 300-line limit and so
 * the three separate report calls this needs — selected period, this month,
 * previous period — are declared together with the reasons they differ.
 *
 * ⚠️ All amounts are integer cents throughout; nothing here converts or
 * rounds a currency value except through the shared per-day helper.
 */
export function useHomeSnapshot(homePeriod: HomePeriod) {
  const wallets = useWalletsQuery();
  const budgets = useBudgetsQuery();

  const periodRange = useMemo(() => currentPeriodRange(homePeriod), [homePeriod]);
  const periodSummary = useReportSummaryQuery(periodRange);
  // Top categories always reflect the calendar month, independent of the
  // selector above — a "top categories today" list usually holds one row or
  // none, which is noise rather than insight.
  const thisMonthRange = useMemo(() => monthRange(0), []);
  const thisMonthSummary = useReportSummaryQuery(thisMonthRange);
  // The trend badge, by contrast, does track the selected period — comparing
  // against yesterday only means anything while the day is selected.
  const previousRange = useMemo(() => previousPeriodRange(homePeriod), [homePeriod]);
  const previousPeriodSummary = useReportSummaryQuery(previousRange);

  // The report's own currency is the source of truth for the whole snapshot;
  // the wallets' primary currency is only a fallback while the report has not
  // loaded or has no transactions in range at all.
  const currency =
    periodSummary.data?.totals[0]?.currency ??
    (wallets.data ? primaryCurrency(wallets.data) : undefined) ??
    FALLBACK_CURRENCY;

  const periodSpent = periodSummary.data?.totals[0]?.total_expense ?? 0;
  const previousPeriodSpent = previousPeriodSummary.data?.totals[0]?.total_expense ?? 0;
  const budgetSnapshot = budgets.data ? budgetTotals(budgets.data, currency) : null;

  /**
   * What is still spendable today.
   *
   * ⚠️ The remaining figure already has today's spending removed, so this
   * shrinks through the day — which is the whole reason to look at it more
   * than once. Today counts as a day you can still spend on, hence the
   * inclusive count: excluding it would inflate every later day by money that
   * is actually available right now.
   */
  const daysLeft = daysLeftInMonth();
  const remainingToday = budgetSnapshot ? remainingPerDay(budgetSnapshot.remaining, daysLeft) : null;
  // What today started with: what is left plus what has already gone. Drives
  // the ring, so a heavy morning visibly fills it.
  const todayAllowance = remainingToday !== null ? remainingToday + periodSpent : null;

  /**
   * Budgets running hotter than the month is long, worst first.
   *
   * Beside today's number the useful thing to see is not what you spend most
   * on in general — it is which limit is about to stop you.
   */
  const atRiskBudgets: AtRiskBudgetRow[] = useMemo(() => {
    const rows = (budgets.data ?? [])
      .flatMap((budget) => budget.limits.map((limit) => ({ budget, limit })))
      .filter(({ limit }) => limit.currency === currency)
      // `elapsed` is kept, not just fed to the status helper — the meter draws
      // it as a pace tick, same as the Budgets tab's own rows.
      .map((row) => {
        const elapsed = budgetPeriodElapsed(row.budget.start_date);
        return { ...row, elapsed, status: budgetRowStatus(row.limit, elapsed) };
      })
      .filter((row) => row.status.state === "over" || row.status.state === "at-risk");
    return rows.sort((a, b) => b.status.ratio - a.status.ratio).slice(0, TOP_CATEGORIES_COUNT);
  }, [budgets.data, currency]);

  const topCategories = useMemo(() => {
    const expenses = thisMonthSummary.data?.by_category.filter((c) => c.type === "expense") ?? [];
    return [...expenses].sort((a, b) => b.amount - a.amount).slice(0, TOP_CATEGORIES_COUNT);
  }, [thisMonthSummary.data]);

  // The same currency-matched total the Insights donut divides by, reused so
  // the compact rows can show a share of the month rather than a currency
  // string, which is what actually fits that column.
  const topCategoriesExpenseTotal =
    thisMonthSummary.data?.totals.find((t) => t.currency === currency)?.total_expense ?? 0;

  return {
    currency,
    periodRange,
    periodSpent,
    spentDelta: periodSpent - previousPeriodSpent,
    budgetSnapshot,
    remainingToday,
    todayAllowance,
    daysLeft,
    atRiskBudgets,
    topCategories,
    topCategoriesExpenseTotal,
    // Every input defaults to zero or empty before its own query resolves —
    // without this the first render showed a zeroed snapshot rather than a
    // loading state.
    loading: wallets.isLoading || periodSummary.isLoading || thisMonthSummary.isLoading || budgets.isLoading,
    // Handed to the screen's pull-to-refresh: refreshing fewer than all of
    // them would leave the trend badge comparing a fresh number to a stale one.
    queries: [budgets, periodSummary, thisMonthSummary, previousPeriodSummary],
  };
}
