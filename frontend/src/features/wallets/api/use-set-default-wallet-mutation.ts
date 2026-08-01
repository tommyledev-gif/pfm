import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Wallet } from "@/features/wallets/types";

async function setDefaultWallet(walletId: string): Promise<Wallet> {
  const { data } = await apiClient.post<ApiEnvelope<Wallet>>(`/wallets/${walletId}/set-default`);
  return unwrap(data);
}

// Idempotent by construction (spec.md S-WAL-26) — no optimistic update
// needed here; invalidating both query keys on success is enough.
export function useSetDefaultWalletMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setDefaultWallet,
    onSuccess: (_, walletId) => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallets", walletId] });
    },
  });
}
