// Shared date/time formatters — Transactions rows show a date, Notifications
// group by day label ("Today"/"Yesterday"/date). Kept here so no screen
// hand-rolls its own Date math.
// 24-hour "HH:mm", the way Vietnamese readers write times.
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// dd/mm/yyyy, in the device's local timezone (not UTC-anchored like
// formatDateShort below) — occurred_at is a real TIMESTAMPTZ with actual
// time-of-day, so its calendar date should read the same as the wall-clock
// day the user experienced it on, same convention formatTime already uses.
export function formatDateDMY(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * The calendar day a date or a range bound stands for, as YYYY-MM-DD.
 *
 * A plain date, or a timestamp at exactly UTC midnight (how the backend echoes
 * a date it was sent), keeps its own date. Any other instant is read in local
 * time: the report's default window starts at local midnight, which in UTC+7
 * is 17:00Z the day before, and read as UTC it labelled 1 October "30/09".
 */
export function calendarDay(value: string): string {
  if (!value.includes("T") || value.endsWith("T00:00:00Z")) return value.slice(0, 10);
  const date = new Date(value);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

// "01/09 – 30/09/2026" — the year only once, on the end date.
export function formatDateRange(fromIso: string, toIso: string): string {
  const from = formatDateShort(calendarDay(fromIso)).slice(0, 5);
  return `${from} – ${formatDateShort(calendarDay(toIso))}`;
}

// Accepts either a plain "YYYY-MM-DD" date-only string OR a full timestamp
// (the AI chat action's occurred_at arrives as a real time.Time from the Go
// Backend — e.g. "2026-08-18T00:00:00Z" — not the date-only string the AI
// Service itself works with internally). Appending T00:00:00Z only to the
// date-only case anchors it to UTC midnight so a negative local timezone
// offset can't roll it back a day; appending it to an already-full
// timestamp would double up the suffix and produce an Invalid Date.
export function formatDateShort(value: string): string {
  const iso = value.includes("T") ? value : `${value}T00:00:00Z`;
  const date = new Date(iso);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

export function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: diffDays > 300 ? "numeric" : undefined });
}

// Vietnamese counterpart of dayLabel — Transactions' date-grouped list uses
// this one (that screen is fully translated, see project memory on the
// Vietnamese-copy sweep), not the English dayLabel above, which notifications
// screen still uses pending its own translation pass.
// "06 Th09, 2026" — the date-group header format Transactions' day sections
// use alongside dayLabelVi's "Hôm nay"/"Hôm qua"/full-date label.
export function formatDateViShort(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day} Th${month}, ${date.getFullYear()}`;
}

export function dayLabelVi(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return "Hôm nay";
  if (diffDays === 1) return "Hôm qua";
  return formatDateDMY(iso);
}
