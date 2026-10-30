import { HomePeriod } from "@/stores/ui-prefs-store";

// Local-calendar YYYY-MM-DD range helpers for the Home screen's period
// selector and month-over-month comparison — deliberately local time, not
// UTC (Date#toISOString would shift the date near midnight in a UTC+7
// timezone like Vietnam's), since "today/this month/this year" is a
// user-facing, local-time concept. Matches the plain "YYYY-MM-DD" convention
// DateRangePickerModal/SpendingTab already send to GET /reports/summary.
function toDateOnly(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Today's local calendar date as YYYY-MM-DD — the default occurred_at of a
// new Transaction and the "Hôm nay" reference. Never toISOString(): before
// 07:00 in UTC+7 that still reads yesterday.
export function todayDateOnly(now: Date = new Date()): string {
  return toDateOnly(now);
}

// The user-selectable Day/Month/Year snapshot range, always ending "today".
//
// Day collapses to a single date (from === to), which is the point: the
// question people actually ask most often is "how much have I spent today",
// and a week boundary is an arbitrary one they rarely plan against.
export function currentPeriodRange(period: HomePeriod, now: Date = new Date()): { from: string; to: string } {
  const to = toDateOnly(now);
  if (period === "day") return { from: to, to };
  if (period === "year") return { from: `${now.getFullYear()}-01-01`, to };
  return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, to };
}

// The full period immediately preceding currentPeriodRange's selection —
// yesterday, or the last calendar month/year (never prorated to "same number
// of days elapsed so far", same convention as monthRange's own
// full-calendar-month comparison) — used by Home's trend badge to compare
// against whichever period tab is currently selected.
export function previousPeriodRange(period: HomePeriod, now: Date = new Date()): { from: string; to: string } {
  if (period === "day") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const date = toDateOnly(yesterday);
    return { from: date, to: date };
  }
  if (period === "year") {
    return { from: `${now.getFullYear() - 1}-01-01`, to: `${now.getFullYear() - 1}-12-31` };
  }
  return monthRange(1, now);
}

// A full calendar month N months back from `now` (0 = this month, 1 = last
// month, ...) — used by the fixed month-over-month comparison block, which
// is independent of the Day/Month/Year snapshot selector above.
export function monthRange(monthsAgo: number, now: Date = new Date()): { from: string; to: string } {
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const from = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const to = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

export function monthLabel(monthsAgo: number, now: Date = new Date()): string {
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  return target.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
}
