import { useMemo } from "react";

import { Wallet } from "@/features/wallets/types";
import { sharedWalletIds } from "@/features/wallets/wallet-access";

/**
 * What a list of transactions from many wallets needs to look up per row:
 * each wallet's currency (a Transaction carries none) and which wallets are
 * shared (TransactionRow's "Ví chung" tag). Rebuilt only when the wallets do.
 */
export function useWalletLookups(wallets: Wallet[] | undefined) {
  return useMemo(
    () => ({
      currencyById: new Map((wallets ?? []).map((w) => [w.id, w.currency])),
      sharedIds: sharedWalletIds(wallets),
    }),
    [wallets],
  );
}
