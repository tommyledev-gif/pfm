import { HomePeriod } from "@/stores/ui-prefs-store";

// Local-calendar YYYY-MM-DD range helpers for the Home screen's period
// selector and month-over-month comparison — deliberately local time, not
// UTC (Date#toISOString would shift the date near midnight in a UTC+7
// timezone like Vietnam's), since "this week/month/year" is a user-facing,
// local-time concept. Matches the plain "YYYY-MM-DD" convention
// DateRangePickerModal/SpendingTab already send to GET /reports/summary.
function toDateOnly(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(reference: Date): Date {
  const d = new Date(reference);
  const dayOfWeek = d.getDay(); // 0 = Sun .. 6 = Sat
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // week starts Monday
  d.setDate(d.getDate() - diff);
  return d;
}

// The user-selectable Week/Month/Year snapshot range, always ending "today".
export function currentPeriodRange(period: HomePeriod, now: Date = new Date()): { from: string; to: string } {
  const to = toDateOnly(now);
  if (period === "week") return { from: toDateOnly(startOfWeek(now)), to };
  if (period === "year") return { from: `${now.getFullYear()}-01-01`, to };
  return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, to };
}

// A full calendar month N months back from `now` (0 = this month, 1 = last
// month, ...) — used by the fixed month-over-month comparison block, which
// is independent of the Week/Month/Year snapshot selector above.
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
