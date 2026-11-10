import { useEffect, useRef } from "react";
import { useTabParams } from "@/lib/tab-route-params";

import { Wallet } from "@/features/wallets/types";

interface WalletFilterTarget {
  clearFilters: () => void;
  selectWallet: (id: string | undefined, currency: string | undefined) => void;
}

/**
 * "Xem tất cả" under a wallet's cards (WalletRecentPanel) opens Transactions
 * on that wallet's entries, nothing else narrowing them: route params
 * `walletId` and `walletFilterAt`, a nonce so the same wallet can be asked
 * for twice. Applied once the wallets are known, so the list takes the
 * wallet's own currency with it (a USD wallet under the VND default is empty).
 */
export function useWalletFilterParam(filters: WalletFilterTarget, wallets: Wallet[] | undefined, resetSort: () => void) {
  const { walletId, walletFilterAt } = useTabParams<{ walletId?: string; walletFilterAt?: string }>();
  const applied = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!walletId || !walletFilterAt || applied.current === walletFilterAt || !wallets) return;
    applied.current = walletFilterAt;
    filters.clearFilters();
    resetSort();
    filters.selectWallet(walletId, wallets.find((w) => w.id === walletId)?.currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletId, walletFilterAt, wallets]);
}
