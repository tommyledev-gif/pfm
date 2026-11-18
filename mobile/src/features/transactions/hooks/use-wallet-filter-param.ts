import { useEffect, useRef } from "react";
import { useTabParams } from "@/lib/tab-route-params";
import { useAfterTabSwitch } from "@/lib/use-after-tab-switch";

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
  const afterTabSwitch = useAfterTabSwitch();
  useEffect(() => {
    if (!walletId || !walletFilterAt || applied.current === walletFilterAt || !wallets) return;
    applied.current = walletFilterAt;
    // ⚠️ Once the tab has slid in, not on arrival: the filter change re-renders
    // the list and starts a refetch, and on the JS thread that work ran in
    // the middle of the slide (it started late and stuttered).
    afterTabSwitch(() => {
      filters.clearFilters();
      resetSort();
      filters.selectWallet(walletId, wallets.find((w) => w.id === walletId)?.currency);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletId, walletFilterAt, wallets]);
}
