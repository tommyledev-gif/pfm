import { useMemo } from "react";

import { FALLBACK_CURRENCY } from "@/lib/constants";
import { Wallet } from "@/features/wallets/types";

/**
 * The currencies the User's wallets are in, VND first, and the one the
 * Transactions list opens in: VND, or the first there is when no wallet is
 * in VND (useTransactionFilters' defaultCurrency).
 */
export function useWalletCurrencies(wallets: Wallet[] | undefined) {
  return useMemo(() => {
    const codes = [...new Set((wallets ?? []).map((w) => w.currency))];
    codes.sort((a, b) => (a === FALLBACK_CURRENCY ? -1 : b === FALLBACK_CURRENCY ? 1 : a.localeCompare(b)));
    const defaultCurrency = codes.length === 0 || codes.includes(FALLBACK_CURRENCY) ? FALLBACK_CURRENCY : codes[0];
    return { currencies: codes.length > 0 ? codes : [FALLBACK_CURRENCY], defaultCurrency };
  }, [wallets]);
}
