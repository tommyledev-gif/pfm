import { currentLanguage, i18n } from "@/lib/i18n";

// Shared date/time formatters — Transactions rows show a date, Notifications
// group by day label ("Hôm nay"/"Hôm qua"/date). Kept here so no screen
// hand-rolls its own Date math.
//
// Each follows the app language (specs/mobile-language-switch D-08): the
// Vietnamese output is exactly what it always was, English reads "Oct 29,
// 2026" (month first in words, so 10/29 vs 29/10 is never a question).
// Built by hand in both: Intl for "vi" gives "tháng 10", not the app's
// "Th10", and Hermes has no reliable formatRange. A component showing one
// of these re-renders on a switch through its own useTranslation().

// Cached per language: the month list is read on every row of a long list.
const shortMonths = new Map<string, string[]>();
function monthShort(monthIndex: number): string {
  const language = currentLanguage();
  let names = shortMonths.get(language);
  if (!names) {
    names = i18n.t("format.calendar.monthNamesShort", { lng: language }).split(", ");
    shortMonths.set(language, names);
  }
  return names[monthIndex] ?? String(monthIndex + 1);
}

const pad = (value: number) => String(value).padStart(2, "0");

// "Oct 29, 2026" / "Oct 29" — English only.
function englishDate(day: number, monthIndex: number, year: number | null): string {
  const date = `${monthShort(monthIndex)} ${day}`;
  return year === null ? date : `${date}, ${year}`;
}

// 24-hour "HH:mm" in both languages (D-08; 12-hour is an open question).
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// dd/mm/yyyy, in the device's local timezone (not UTC-anchored like
// formatDateShort below) — occurred_at is a real TIMESTAMPTZ with actual
// time-of-day, so its calendar date should read the same as the wall-clock
// day the user experienced it on, same convention formatTime already uses.
export function formatDateDMY(iso: string): string {
  const date = new Date(iso);
  if (currentLanguage() === "en") return englishDate(date.getDate(), date.getMonth(), date.getFullYear());
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
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
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Accepts either a plain "YYYY-MM-DD" date-only string OR a full timestamp
// (the AI chat action's occurred_at arrives as a real time.Time from the Go
// Backend — e.g. "2026-08-18T00:00:00Z" — not the date-only string the AI
// Service itself works with internally). Appending T00:00:00Z only to the
// date-only case anchors it to UTC midnight so a negative local timezone
// offset can't roll it back a day; appending it to an already-full
// timestamp would double up the suffix and produce an Invalid Date.
function utcParts(value: string) {
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00Z`);
  return { day: date.getUTCDate(), monthIndex: date.getUTCMonth(), year: date.getUTCFullYear() };
}

export function formatDateShort(value: string): string {
  const { day, monthIndex, year } = utcParts(value);
  if (currentLanguage() === "en") return englishDate(day, monthIndex, year);
  return `${pad(day)}/${pad(monthIndex + 1)}/${year}`;
}

// "01/09 – 30/09/2026" / "Sep 1 – Sep 30, 2026" — the year only once, on
// the end date.
export function formatDateRange(fromIso: string, toIso: string): string {
  const from = utcParts(calendarDay(fromIso));
  const to = formatDateShort(calendarDay(toIso));
  if (currentLanguage() === "en") return `${englishDate(from.day, from.monthIndex, null)} – ${to}`;
  return `${pad(from.day)}/${pad(from.monthIndex + 1)} – ${to}`;
}

// The date-group header Transactions' day sections use alongside dayLabel's
// "Hôm nay"/"Hôm qua"/full-date label: "06 Th09, 2026" / "Sep 6, 2026".
export function formatDateGroupHeader(iso: string): string {
  const date = new Date(iso);
  if (currentLanguage() === "en") return englishDate(date.getDate(), date.getMonth(), date.getFullYear());
  return `${pad(date.getDate())} Th${pad(date.getMonth() + 1)}, ${date.getFullYear()}`;
}

// "Hôm nay" / "Hôm qua" / the date — Transactions' date-grouped list,
// Notifications and the chat threads' day labels.
export function dayLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return i18n.t("common.date.today");
  if (diffDays === 1) return i18n.t("common.date.yesterday");
  return formatDateDMY(iso);
}

// "Tháng 10, 2026" / "October 2026" — a month as a period (the Transactions
// header, calendar titles).
export function formatMonthYear(date: Date): string {
  const language = currentLanguage();
  if (language === "en") {
    const names = i18n.t("format.calendar.monthNames", { lng: language }).split(", ");
    return `${names[date.getMonth()]} ${date.getFullYear()}`;
  }
  return `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}`; // i18n-ignore: the hand-built Vietnamese form
}
