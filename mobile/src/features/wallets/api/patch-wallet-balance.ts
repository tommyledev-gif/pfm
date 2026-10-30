import { QueryClient } from "@tanstack/react-query";

import { Transaction } from "@/features/transactions/types";
import { Wallet } from "@/features/wallets/types";

/**
 * Puts the balance a create/update answer carries (`wallet_balance`, the
 * transaction's wallet after the write) straight into the cached wallet
 * list, so every card and row showing that wallet moves at once instead of
 * after the wallets refetch the caller still starts. Only the one wallet
 * object is replaced: memoized cards for the others do not re-render. A
 * transfer's destination, or the wallet an edit moved away from, still
 * waits for that refetch.
 */
export function patchWalletBalance(queryClient: QueryClient, transaction: Transaction): void {
  const balance = transaction.wallet_balance;
  if (typeof balance !== "number") return;
  queryClient.setQueryData<Wallet[]>(["wallets"], (wallets) =>
    wallets?.map((wallet) => (wallet.id === transaction.wallet_id && wallet.balance !== balance ? { ...wallet, balance } : wallet)),
  );
}
