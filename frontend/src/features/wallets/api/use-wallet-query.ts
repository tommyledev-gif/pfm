import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { Wallet } from "@/features/wallets/types";

async function fetchWallet(walletId: string): Promise<Wallet> {
  const { data } = await apiClient.get<ApiEnvelope<Wallet>>(`/wallets/${walletId}`);
  return unwrap(data);
}

export function useWalletQuery(walletId: string) {
  return useQuery({
    queryKey: ["wallets", walletId],
    queryFn: () => fetchWallet(walletId),
  });
}
