import { FALLBACK_CURRENCY } from "@/lib/constants";
import { i18n } from "@/lib/i18n";

/**
 * The note beside a total that covers only one currency when the period or
 * day also has others: "Có thêm USD", or "Có thêm 2 loại tiền khác". Amounts
 * in different currencies are never added together, so the total stays in
 * one and this says the rest exists. Null when there is nothing else. In the
 * current language: call it while rendering a component that uses
 * useTranslation().
 */
export function otherCurrenciesLabel(others: string[]): string | null {
  if (others.length === 0) return null;
  if (others.length === 1) return i18n.t("transactions.otherCurrencies.one", { currency: others[0] });
  return i18n.t("transactions.otherCurrencies.count", { count: others.length });
}

/** Which of several currencies a total is shown in: VND when present, else the first. */
export function mainCurrency(currencies: string[]): string | undefined {
  return currencies.includes(FALLBACK_CURRENCY) ? FALLBACK_CURRENCY : currencies[0];
}
