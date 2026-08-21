import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { Wallet } from "@/features/wallets/types";
import { WalletCurrency, WalletType } from "@/lib/constants";

// No `balance` field here — backend's UpdateWalletRequest is strict-decoded
// (DisallowUnknownFields), sending balance is a 400, not a silent no-op.
export interface UpdateWalletRequest {
  name?: string;
  type?: WalletType;
  currency?: WalletCurrency;
  icon?: string;
  icon_url?: string;
}

export function useUpdateWalletMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: UpdateWalletRequest }) => {
      const res = await apiClient.patch<{ success: boolean; message: string; data?: Wallet }>(
        `/wallets/${id}`,
        body,
      );
      return unwrap(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}
