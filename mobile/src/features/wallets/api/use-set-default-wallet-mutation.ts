import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { Wallet } from "@/features/wallets/types";

export function useSetDefaultWalletMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: Wallet }>(
        `/wallets/${id}/set-default`,
      );
      return unwrap(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}
