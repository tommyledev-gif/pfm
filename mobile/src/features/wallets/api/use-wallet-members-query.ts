import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { WalletInvitation, WalletMember } from "@/features/wallets/types";

export const walletMembersKey = (walletId: string) => ["wallets", walletId, "members"] as const;
export const WALLET_INVITATIONS_KEY = ["wallets", "invitations"] as const;

/** GET /wallets/{id}/members: the owner first, then members (specs/shared-wallets US-05). */
export function useWalletMembersQuery(walletId: string | null) {
  return useQuery({
    queryKey: walletMembersKey(walletId ?? ""),
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; message: string; data?: { data: WalletMember[] } }>(
        `/wallets/${walletId}/members`,
      );
      return unwrap(res.data).data;
    },
    enabled: Boolean(walletId),
  });
}

/**
 * GET /wallets/invitations: invitations waiting for this User. An older
 * backend answers 404 here (the path reads as a wallet id); that is treated
 * as "none" rather than an error, so the Wallets screen never shows one.
 */
export function useWalletInvitationsQuery() {
  return useQuery({
    queryKey: WALLET_INVITATIONS_KEY,
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ success: boolean; message: string; data?: { data: WalletInvitation[] } }>(
          "/wallets/invitations",
        );
        return unwrap(res.data).data;
      } catch {
        return [] as WalletInvitation[];
      }
    },
  });
}
