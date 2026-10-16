import { useMemo, useState } from "react";

import { FALLBACK_CURRENCY } from "@/lib/constants";
import { ReportSummary } from "@/features/reports/types";

/**
 * Which one of several currencies a figure is shown in, and the list to pick
 * from. Amounts in different currencies never add up, so a screen shows one
 * at a time, with a switch whenever there is more than one.
 *
 * VND is the default. Taking whichever currency a report listed first was the
 * old bug: the backend sorts them by code, so one USD transaction anywhere in
 * the period turned the whole screen into a USD report of that single row
 * ("USD" < "VND"). A period without any VND falls back to the first one.
 */
export function useCurrencyChoice(available: string[]) {
  const [picked, setPicked] = useState<string | null>(null);
  // Same array while the set is the same: memoized cards take it as a prop.
  const key = sortCurrencies(available).join(",");
  const currencies = useMemo(() => (key ? key.split(",") : []), [key]);
  const fallback = currencies.includes(FALLBACK_CURRENCY) ? FALLBACK_CURRENCY : currencies[0] ?? FALLBACK_CURRENCY;
  // A pick the new data no longer has falls back instead of showing nothing.
  const currency = picked && currencies.includes(picked) ? picked : fallback;
  return { currency, currencies, setCurrency: setPicked };
}

/** The Spending tab's currency: every currency the report has an amount in. */
export function useReportCurrency(summary: ReportSummary | undefined) {
  return useCurrencyChoice(summary ? summaryCurrencies(summary) : []);
}

export function summaryCurrencies({ totals, by_category }: ReportSummary): string[] {
  return [...totals.map((t) => t.currency), ...by_category.map((c) => c.currency)];
}

// Unique, VND first, then the rest by code — the switch reads the same everywhere.
export function sortCurrencies(currencies: string[]): string[] {
  return [...new Set(currencies)].sort((a, b) => {
    if (a === FALLBACK_CURRENCY) return -1;
    if (b === FALLBACK_CURRENCY) return 1;
    return a.localeCompare(b);
  });
}
