import { formatMonthYear } from "@/lib/format-date";
import {
  INSTALLMENT_MAX_MONTHS,
  INSTALLMENT_MIN_MONTHS,
  INTENTION_TITLE_MAX,
  SpendingIntention,
  SpendingIntentionInput,
} from "@/features/spending-intentions/types";

/** The editable set of an intention, as a save or an edit sends it. */
export function toInput(item: SpendingIntention): SpendingIntentionInput {
  return {
    title: item.title,
    kind: item.kind,
    category_id: item.category_id ?? null,
    currency: item.currency,
    total_amount: item.total_amount ?? null,
    monthly_amount: item.monthly_amount ?? null,
    installment_months: item.installment_months ?? null,
    target_month: item.target_month,
    note: item.note ?? null,
  };
}

/**
 * Whether the server would take this: a title, and for an instalment a month
 * count in range with a total or a payment. A card read from a sentence can
 * miss these (spec.md EC-02); Save stays off until the form completes it.
 */
export function isDraftComplete(draft: Pick<SpendingIntention, "title" | "kind" | "total_amount" | "monthly_amount" | "installment_months">): boolean {
  const title = draft.title.trim();
  if (title.length === 0 || title.length > INTENTION_TITLE_MAX) return false;
  if (draft.kind === "one_time") return true;
  const months = draft.installment_months;
  const hasMonths = months !== undefined && months >= INSTALLMENT_MIN_MONTHS && months <= INSTALLMENT_MAX_MONTHS;
  return hasMonths && Boolean(draft.total_amount || draft.monthly_amount);
}

/** "YYYY-MM" as the first day of that month, local time. */
export function monthDate(month: string): Date {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1);
}

/** "YYYY-MM" as the month label the app uses everywhere else ("Tháng 11, 2026"). */
export function intentionMonthLabel(month: string): string {
  return formatMonthYear(monthDate(month));
}

/** The `count` calendar months after the current one, as "YYYY-MM". */
export function nextMonths(count: number, now: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}
