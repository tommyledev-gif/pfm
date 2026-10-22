import { useMemo } from "react";

import { DonutSegment } from "@/components/shared/DonutChart";
import { buildCategoryColorMap } from "@/lib/category-color";
import { monthRange } from "@/lib/date-range";
import { calendarDay } from "@/lib/format-date";
import { Budget } from "@/features/budgets/types";
import { daysInRange, proratedLimit } from "@/features/budgets/budget-pace";
import { Category } from "@/features/categories/types";
import { ReportSummary } from "@/features/reports/types";

interface SpendingBreakdownInput {
  summary: ReportSummary | undefined;
  currency: string;
  categories: Category[] | undefined;
  budgets: Budget[] | undefined;
  /** The filter the User applied; empty = the backend's default window. */
  hasRangeFilter: boolean;
  fallbackColor: string;
}

const NO_SEGMENTS: DonutSegment[] = [];

/**
 * The Spending tab's derived figures, rebuilt only when their inputs change.
 *
 * Budgets are monthly, so the budget total is prorated to a custom window
 * (the same way BudgetsTab prorates each row). The default window is the
 * current month so far and is compared with the whole monthly total.
 */
export function useSpendingBreakdown({
  summary,
  currency,
  categories,
  budgets,
  hasRangeFilter,
  fallbackColor,
}: SpendingBreakdownInput) {
  const segments = useMemo(() => {
    if (!summary) return NO_SEGMENTS;
    const categoryById = new Map(categories?.map((c) => [c.id, c]));
    const expense = summary.by_category.filter((c) => c.type === "expense" && c.currency === currency);
    // Unique colours within the chart, so two neighbours never match.
    const colorById = buildCategoryColorMap(expense.map((c) => c.category_id));
    return expense.map(
      (c): DonutSegment => ({
        key: c.category_id,
        label: c.category_name,
        amount: c.amount,
        color: colorById.get(c.category_id) ?? fallbackColor,
        icon: categoryById.get(c.category_id)?.icon,
        iconUrl: categoryById.get(c.category_id)?.icon_url,
      }),
    );
  }, [summary, currency, categories, fallbackColor]);

  const totalExpense = useMemo(() => segments.reduce((sum, s) => sum + s.amount, 0), [segments]);

  const primaryTotal = useMemo(() => summary?.totals.find((t) => t.currency === currency), [summary, currency]);

  const budget = useMemo(() => {
    if (!summary) return { budgetTotal: null, prorated: false, rangeDayCount: 0 };
    const thisMonth = monthRange(0);
    const fromDay = calendarDay(summary.range.from);
    const toDay = calendarDay(summary.range.to);
    const isCurrentMonth = !hasRangeFilter || (fromDay === thisMonth.from && toDay === thisMonth.to);
    const monthly = (budgets ?? []).reduce(
      (sum, b) => sum + (b.limits.find((l) => l.currency === currency)?.amount_limit ?? 0),
      0,
    );
    const rangeDayCount = daysInRange(fromDay, toDay);
    if (monthly === 0) return { budgetTotal: null, prorated: false, rangeDayCount };
    return {
      budgetTotal: isCurrentMonth ? monthly : proratedLimit(monthly, rangeDayCount),
      prorated: !isCurrentMonth,
      rangeDayCount,
    };
  }, [summary, budgets, currency, hasRangeFilter]);

  return { segments, totalExpense, primaryTotal, ...budget };
}
