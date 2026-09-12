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
  // "Tháng 9" — budgets never span months, so the label needs no year.
  label: string;
}

export function currentMonthPace(now = new Date()): MonthPace {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  return {
    elapsed: dayOfMonth / daysInMonth,
    daysLeft: daysInMonth - dayOfMonth,
    label: `Tháng ${now.getMonth() + 1}`,
  };
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
  // "đã vượt" / "nhanh hơn dự kiến" / …, shown after the percentage.
  caption: string;
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
    return { state: "over", ratio, percent, color: colors.peach, caption: "đã vượt", remaining, over: true };
  }
  if (limit.spent <= 0) {
    return { state: "unused", ratio, percent, color: colors.trackMuted, caption: "chưa dùng", remaining, over: false };
  }
  if (ratio > monthElapsed + PACE_TOLERANCE) {
    return {
      state: "at-risk",
      ratio,
      percent,
      color: colors.mustard,
      caption: "nhanh hơn dự kiến",
      remaining,
      over: false,
    };
  }
  return { state: "on-track", ratio, percent, color: colors.mint, caption: "đúng tiến độ", remaining, over: false };
}
