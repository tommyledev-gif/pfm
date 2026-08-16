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

export function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: diffDays > 300 ? "numeric" : undefined });
}
