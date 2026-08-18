// Shared date/time formatters — Transactions rows show a time, Notifications
// group by day label ("Today"/"Yesterday"/date). Kept here so no screen
// hand-rolls its own Date math.
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function formatDateRange(fromIso: string, toIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const from = new Date(fromIso).toLocaleDateString("en-US", opts);
  const to = new Date(toIso).toLocaleDateString("en-US", { ...opts, year: "numeric" });
  return `${from} – ${to}`;
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
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
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
