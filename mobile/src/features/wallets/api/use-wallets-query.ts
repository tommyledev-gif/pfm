import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { SNAPSHOT_STALE_TIME_MS } from "@/lib/query-client";
import { Wallet } from "@/features/wallets/types";
import { canRecordInto, isOwnWallet } from "@/features/wallets/wallet-access";

/**
 * Which wallets a caller wants out of the one cached list:
 *  - "all": the User's own and the ones shared with them (the Wallets
 *    screen, the carousels, currency lookups for rows);
 *  - "writable": the ones a transaction may be recorded into, which drops
 *    shared wallets where the User only views (every wallet picker);
 *  - "own": the User's own wallets (net worth, anything that sums balances).
 */
export type WalletScope = "all" | "writable" | "own";

// Module-level so each scope's select keeps one identity and TanStack Query
// only re-runs it when the data changes.
const SELECT: Record<WalletScope, ((wallets: Wallet[]) => Wallet[]) | undefined> = {
  all: undefined,
  writable: (wallets) => wallets.filter(canRecordInto),
  own: (wallets) => wallets.filter(isOwnWallet),
};

// Backend wraps list responses one level deeper than a single-object
// response: `response.Success(c, ..., dto.NewListWalletsResponse(wallets))`
// puts a `{data: [...]}` DTO into the envelope's own `data` field, so the
// wire shape is `{success, message, data: {data: Wallet[]}}` — not
// `{success, message, data: Wallet[]}`. Unwrapped here so every caller still
// gets a flat `Wallet[]`.
//
// include_shared asks for the wallets other people shared with this User too
// (specs/shared-wallets US-03); one cache entry serves every scope.
export function useWalletsQuery(scope: WalletScope = "all") {
  return useQuery({
    queryKey: ["wallets"],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: { data: Wallet[] } }>("/wallets/", {
        params: { include_shared: true },
      });
      return unwrap(res.data).data;
    },
    select: SELECT[scope],
    staleTime: SNAPSHOT_STALE_TIME_MS,
  });
}
