import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { Wallet } from "@/features/wallets/types";
import type { WalletColorKey } from "@/lib/wallet-colors";
import { WalletCurrency, WalletType } from "@/lib/constants";

export interface CreateWalletRequest {
  name: string;
  type: WalletType;
  currency?: WalletCurrency;
  initial_balance?: number;
  is_default?: boolean;
  icon?: string;
  icon_url?: string;
  // Card colour key; omitted = automatic (src/lib/wallet-colors.ts).
  color?: WalletColorKey;
}

export function useCreateWalletMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateWalletRequest) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: Wallet }>("/wallets/", body);
      return unwrap(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}
