import { floorToPerDayStep } from "@/lib/currency";
import { colors } from "@/lib/theme";
import { BudgetLimit } from "@/features/budgets/types";

// How far through the current month we are, and how much of it is left.
//
// Every budget is monthly (model.BudgetPeriod only ever holds "monthly"), and
// the backend's `spent` is always the current calendar period's
// (BudgetRepo.SpentByUserCurrentPeriod) — so "should this be 60% used yet?"
// has exactly one answer per screen, computed once here rather than per row.
export interface MonthPace {
  // 0..1 — the share of the month elapsed, and the position of the pace
  // marker drawn on every budget bar.
  elapsed: number;
  daysLeft: number;
}

export function currentMonthPace(now = new Date()): MonthPace {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  return {
    elapsed: dayOfMonth / daysInMonth,
    daysLeft: daysInMonth - dayOfMonth,
  };
}

// How far through the *current period* a single budget is, which is not the
// same number for every budget on the screen.
//
// `start_date` defaults to the day the budget was created (dto/budget_request
// .go), so a budget added on the 25th has only been in force for the tail of
// the month. Drawing the month-level tick on it would claim the user is 83%
// of the way through a limit they set two days ago, which is why every row's
// divider used to sit at exactly the same x regardless of the budget's own
// data. The window this measures is therefore
// [max(start_date, 1st of month) … 1st of next month).
//
// ⚠️ The backend's `spent` is still the whole UTC calendar month's expenses in
// that category (SumExpenseByUserCurrentPeriod), not just the part after
// start_date — so for a mid-month budget the bar can legitimately look ahead
// of its own tick. That is the honest reading: it is counting spending from
// before the budget existed. Narrowing `spent` to the budget's own window is a
// backend change, out of scope here.
//
// Dates are parsed field-by-field rather than through `new Date(string)`,
// which reads a bare YYYY-MM-DD as UTC midnight and lands on the previous day
// for anyone east of Greenwich — including every user of this app.
export function budgetPeriodElapsed(startDate: string, now = new Date()): number {
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [year, month, day] = startDate.slice(0, 10).split("-").map(Number);
  const start = new Date(year, month - 1, day);

  const windowStart = start > periodStart ? start : periodStart;
  const span = periodEnd.getTime() - windowStart.getTime();
  // A budget whose start_date is in a future month has no elapsed time yet;
  // one starting on the last day of the month has a span of ~1 day, not 0.
  if (span <= 0) return 0;

  const elapsed = (now.getTime() - windowStart.getTime()) / span;
  return Math.max(0, Math.min(1, elapsed));
}

// Which of the four buckets a budget is in. The bar color, the caption and the
// filter chips all read from this one value, so a row can never be amber in
// the bar and green in the text.
export type BudgetPaceState = "over" | "at-risk" | "on-track" | "unused";

export interface BudgetRowStatus {
  state: BudgetPaceState;
  // spent / limit — deliberately uncapped, so an over-budget row can say 120%.
  ratio: number;
  percent: number;
  color: string;
  // The headline figure on the right of the row: overspend when over,
  // remaining otherwise.
  remaining: number;
  over: boolean;
}

// A row counts as "at risk" when it has burned a bigger share of its limit
// than the month has burned of its days — spending 80% of a budget is fine on
// the 25th and alarming on the 5th, which a flat percentage threshold can't
// express. PACE_TOLERANCE keeps a row that is a rounding error ahead from
// flipping to amber the moment a day ticks over.
const PACE_TOLERANCE = 0.05;

export function budgetRowStatus(limit: BudgetLimit, monthElapsed: number): BudgetRowStatus {
  const ratio = limit.amount_limit > 0 ? limit.spent / limit.amount_limit : 0;
  const percent = Math.round(ratio * 100);
  const remaining = limit.amount_limit - limit.spent;

  // status === "exceeded" is the backend's own verdict (BudgetService.
  // computeStatus) — trusted over the local ratio so the two can't disagree
  // at the boundary.
  if (limit.status === "exceeded" || limit.spent > limit.amount_limit) {
    return { state: "over", ratio, percent, color: colors.peach, remaining, over: true };
  }
  if (limit.spent <= 0) {
    return { state: "unused", ratio, percent, color: colors.trackMuted, remaining, over: false };
  }
  if (ratio > monthElapsed + PACE_TOLERANCE) {
    return { state: "at-risk", ratio, percent, color: colors.mustard, remaining, over: false };
  }
  return { state: "on-track", ratio, percent, color: colors.mint, remaining, over: false };
}

/**
 * What is left to spend today, given what the whole period still has.
 *
 * ⚠️ `remaining` already has today's spending taken out of it, so this shrinks
 * as the day goes on — which is the behaviour that makes the number worth
 * looking at more than once a day. `daysLeftInclusive` counts today, because
 * today is a day you can still spend on; excluding it inflates every remaining
 * day by a share of money that is actually already available now.
 *
 * Mirrors the moment-of-spend formula the budget spec defines
 * (`(amount_max - spentThisCycle) / daysLeftInCycle`).
 */
export function remainingPerDay(remaining: number, daysLeftInclusive: number, currency?: string): number {
  if (remaining <= 0 || daysLeftInclusive <= 0) return 0;
  return floorToPerDayStep(remaining / daysLeftInclusive, currency);
}

/** Days from today to the end of the month, counting today. */
export function daysLeftInMonth(now: Date = new Date()): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return daysInMonth - now.getDate() + 1;
}

/**
 * A monthly limit's share of an arbitrary date range.
 *
 * Comparing "spent on one day" against a whole month's limit is meaningless —
 * it would read as 3% used and look like nothing is wrong. Prorating the limit
 * to the length of the range asks the question the user actually has: was today
 * heavy for this category, or ordinary.
 */
export function proratedLimit(monthlyLimit: number, daysInRange: number, now: Date = new Date()): number {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (daysInRange <= 0 || daysInMonth <= 0) return monthlyLimit;
  return Math.round((monthlyLimit * daysInRange) / daysInMonth);
}

/** Whole days covered by an inclusive YYYY-MM-DD range. */
export function daysInRange(from: string, to: string): number {
  const [fy, fm, fd] = from.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = to.slice(0, 10).split("-").map(Number);
  const start = new Date(fy, fm - 1, fd);
  const end = new Date(ty, tm - 1, td);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(diff + 1, 1);
}
