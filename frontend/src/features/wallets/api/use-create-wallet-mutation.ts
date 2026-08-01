import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { CreateWalletRequest, Wallet } from "@/features/wallets/types";

async function createWallet(req: CreateWalletRequest): Promise<Wallet> {
  const { data } = await apiClient.post<ApiEnvelope<Wallet>>("/wallets", req);
  return unwrap(data);
}

export function useCreateWalletMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWallet,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}
