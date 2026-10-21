import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient, unwrap } from "@/lib/axios";
import { WalletMember, WalletMemberRole } from "@/features/wallets/types";
import { WALLET_INVITATIONS_KEY, walletMembersKey } from "@/features/wallets/api/use-wallet-members-query";

// Shared wallets (specs/shared-wallets US-01, US-02, US-05). Every change
// refreshes the wallet list too: member counts, and the wallet itself
// appearing or leaving, live there.

export function useInviteWalletMemberMutation(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { identifier: string; role: WalletMemberRole }) => {
      const res = await apiClient.post<{ success: boolean; message: string; data?: WalletMember }>(
        `/wallets/${walletId}/members`,
        body,
      );
      return unwrap(res.data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: walletMembersKey(walletId) });
    },
  });
}

export function useChangeWalletMemberRoleMutation(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: WalletMemberRole }) => {
      const res = await apiClient.patch<{ success: boolean; message: string; data?: WalletMember }>(
        `/wallets/${walletId}/members/${userId}`,
        { role },
      );
      return unwrap(res.data);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: walletMembersKey(walletId) });
    },
  });
}

/** Remove a member, cancel an invitation, or leave (userId = the User). */
export function useRemoveWalletMemberMutation(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await apiClient.delete(`/wallets/${walletId}/members/${userId}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}

/** Accept or decline an invitation to someone else's wallet. */
export function useRespondWalletInvitationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ walletId, accept }: { walletId: string; accept: boolean }) => {
      await apiClient.post(`/wallets/${walletId}/invitation/${accept ? "accept" : "decline"}`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: WALLET_INVITATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}
