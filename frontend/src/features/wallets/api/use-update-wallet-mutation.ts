import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import type { UpdateWalletRequest, Wallet } from "@/features/wallets/types";

interface UpdateWalletVariables {
  walletId: string;
  req: UpdateWalletRequest;
}

async function updateWallet({ walletId, req }: UpdateWalletVariables): Promise<Wallet> {
  const { data } = await apiClient.patch<ApiEnvelope<Wallet>>(`/wallets/${walletId}`, req);
  return unwrap(data);
}

export function useUpdateWalletMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateWallet,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      queryClient.invalidateQueries({ queryKey: ["wallets", variables.walletId] });
    },
  });
}
