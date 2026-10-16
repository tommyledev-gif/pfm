import { useState } from "react";

import { FALLBACK_CURRENCY } from "@/lib/constants";
import { ReportSummary } from "@/features/reports/types";

/**
 * The currency the Spending tab is drawn in, and every currency the period
 * has. Amounts in different currencies never add up, so the tab shows one at
 * a time, with a switch whenever there is more than one.
 *
 * It used to take whichever currency the backend listed first, and the
 * backend sorts them by code: one USD transaction anywhere in the period
 * turned the whole tab into a USD report of that single row ("USD" < "VND"),
 * so a wider range showed fewer categories than a narrower one. VND is the
 * default now; a period without any VND falls back to the first currency.
 */
export function useReportCurrency(summary: ReportSummary | undefined) {
  const [picked, setPicked] = useState<string | null>(null);
  const currencies = summary ? listCurrencies(summary) : [];
  const fallback = currencies.includes(FALLBACK_CURRENCY) ? FALLBACK_CURRENCY : currencies[0] ?? FALLBACK_CURRENCY;
  // A pick the new period no longer has falls back instead of showing nothing.
  const currency = picked && currencies.includes(picked) ? picked : fallback;
  return { currency, currencies, setCurrency: setPicked };
}

// VND first, then the rest by code — the switch reads the same in every period.
function listCurrencies({ totals, by_category }: ReportSummary): string[] {
  const seen = new Set<string>();
  for (const total of totals) seen.add(total.currency);
  for (const entry of by_category) seen.add(entry.currency);
  return [...seen].sort((a, b) => {
    if (a === FALLBACK_CURRENCY) return -1;
    if (b === FALLBACK_CURRENCY) return 1;
    return a.localeCompare(b);
  });
}
