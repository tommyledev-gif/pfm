import { useEffect } from "react";

import { currencyDecimals, formatExpression } from "@/lib/calculator/format";
import { WALLET_CURRENCIES } from "@/lib/constants";
import { formatCurrency } from "@/lib/currency";

/**
 * Builds the amount formatters for every wallet currency once the signed-in
 * app has gone idle, so the first transaction sheet a User opens does not
 * pay for them on its first keypad presses.
 *
 * Intl on Hermes for Android goes through the platform's ICU, and the first
 * formatters it builds are the slowest; lib/currency.ts and
 * lib/calculator/format.ts cache what they build, so warming them here is
 * all it takes.
 */
export function useWarmUpFormatting(): void {
  useEffect(() => {
    const handle = requestIdleCallback(() => {
      for (const currency of WALLET_CURRENCIES) {
        formatCurrency(0, currency);
        currencyDecimals(currency);
        formatExpression("1000", currency);
      }
    });
    return () => cancelIdleCallback(handle);
  }, []);
}
