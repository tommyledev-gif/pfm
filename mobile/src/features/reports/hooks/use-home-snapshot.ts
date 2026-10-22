import { useMemo } from "react";

import { isAwaitingFirstData } from "@/lib/query-status";
import { useThemeName } from "@/lib/theme";
import { currentPeriodRange, monthRange, previousPeriodRange } from "@/lib/date-range";
import { useBudgetsQuery } from "@/features/budgets/api/use-budgets-query";
import { budgetTotals } from "@/features/budgets/budget-totals";
import {
  BudgetRowStatus,
  budgetPeriodElapsed,
  budgetRowStatus,
  daysLeftInMonth,
  remainingPerDay,
} from "@/features/budgets/budget-pace";
import { Budget } from "@/features/budgets/types";
import { useReportSummaryQuery } from "@/features/reports/api/use-report-summary-query";
import { useCurrencyChoice } from "@/features/reports/hooks/use-report-currency";
import { useWalletsQuery } from "@/features/wallets/api/use-wallets-query";
import { HomePeriod } from "@/stores/ui-prefs-store";

const TOP_CATEGORIES_COUNT = 3;

/** One budget limit running hot enough to show on the snapshot card. */
export interface AtRiskBudgetRow {
  budget: Budget;
  limit: Budget["limits"][number];
  status: BudgetRowStatus;
  elapsed: number;
}

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

  // One currency at a time, switchable on the card (useCurrencyChoice, VND
  // first). It used to be the report's first total — sorted by code, so a
  // single USD transaction turned the whole card into USD. Offered: every
  // currency the user holds a wallet in or spent in this month or period.
  const { currency, currencies, setCurrency } = useCurrencyChoice([
    ...(wallets.data?.map((w) => w.currency) ?? []),
    ...(periodSummary.data?.totals.map((t) => t.currency) ?? []),
    ...(thisMonthSummary.data?.totals.map((t) => t.currency) ?? []),
  ]);

  const periodSpent = periodSummary.data?.totals.find((t) => t.currency === currency)?.total_expense ?? 0;
  const previousPeriodSpent =
    previousPeriodSummary.data?.totals.find((t) => t.currency === currency)?.total_expense ?? 0;
  // Memoized like every other object handed to the (memoized) card — a fresh
  // one per render would redraw it on every Home render regardless.
  const budgetSnapshot = useMemo(
    () => (budgets.data ? budgetTotals(budgets.data, currency) : null),
    [budgets.data, currency],
  );

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
  const remainingToday = budgetSnapshot ? remainingPerDay(budgetSnapshot.remaining, daysLeft, currency) : null;
  // What today started with: what is left plus what has already gone. Drives
  // the ring, so a heavy morning visibly fills it.
  const todayAllowance = remainingToday !== null ? remainingToday + periodSpent : null;

  /**
   * Budgets running hotter than the month is long, worst first.
   *
   * Beside today's number the useful thing to see is not what you spend most
   * on in general — it is which limit is about to stop you.
   */
  // A dependency of the memo below: each row's status carries a resolved color.
  const themeName = useThemeName();
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
    // themeName is read only through budgetRowStatus's colors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgets.data, currency, themeName]);

  const topCategories = useMemo(() => {
    // Same currency as the rest of the card: a USD row ranked against VND ones
    // compared numbers that mean different things.
    const expenses =
      thisMonthSummary.data?.by_category.filter((c) => c.type === "expense" && c.currency === currency) ?? [];
    return [...expenses].sort((a, b) => b.amount - a.amount).slice(0, TOP_CATEGORIES_COUNT);
  }, [thisMonthSummary.data, currency]);

  // The same currency-matched total the Insights donut divides by, reused so
  // the compact rows can show a share of the month rather than a currency
  // string, which is what actually fits that column.
  const topCategoriesExpenseTotal =
    thisMonthSummary.data?.totals.find((t) => t.currency === currency)?.total_expense ?? 0;

  return {
    currency,
    currencies,
    setCurrency,
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
    // The previous period too: the trend badge compared against zero until it landed.
    loading: [wallets, periodSummary, thisMonthSummary, previousPeriodSummary, budgets].some(isAwaitingFirstData),
    // Handed to the screen's pull-to-refresh: refreshing fewer than all of
    // them would leave the trend badge comparing a fresh number to a stale one.
    queries: [budgets, periodSummary, thisMonthSummary, previousPeriodSummary],
  };
}
