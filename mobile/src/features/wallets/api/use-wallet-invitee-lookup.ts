import { useQuery } from "@tanstack/react-query";

import { apiClient, getErrorCode, unwrap } from "@/lib/axios";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { walletMembersKey } from "@/features/wallets/api/use-wallet-members-query";
import { WalletInvitee } from "@/features/wallets/types";

// A pause in typing, not every keystroke: the endpoint is rate-limited per
// owner (backend MemberLookupRateLimiter).
const LOOKUP_DEBOUNCE_MS = 350;
// The invite endpoint's own minimum.
export const MIN_INVITE_IDENTIFIER = 3;

export type InviteeLookup =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "found"; invitee: WalletInvitee }
  | { kind: "not-found" }
  // Offline, or a backend from before the lookup: nothing is shown and the
  // invite goes on as it always has, the server checking on send.
  | { kind: "unavailable" };

/**
 * Who the email or tên đăng nhập typed into the invite field belongs to, so
 * the owner sees the person (avatar, name, @tên) before sending, or that no
 * account has it. Exact match only, as the server does it.
 *
 * Keyed under the wallet's members, so anything that changes them (an invite
 * sent, someone removed) refreshes what a lookup said about membership.
 */
export function useWalletInviteeLookup(walletId: string, identifier: string): InviteeLookup {
  const typed = identifier.trim();
  const settled = useDebouncedValue(typed, LOOKUP_DEBOUNCE_MS);
  const query = useQuery({
    queryKey: [...walletMembersKey(walletId), "lookup", settled.toLowerCase()],
    queryFn: async (): Promise<WalletInvitee | null> => {
      try {
        const res = await apiClient.get<{ success: boolean; message: string; data?: WalletInvitee }>(
          `/wallets/${walletId}/members/lookup`,
          { params: { identifier: settled } },
        );
        return unwrap(res.data);
      } catch (error) {
        if (getErrorCode(error) === "WALLET_MEMBER_USER_NOT_FOUND") return null;
        throw error;
      }
    },
    enabled: settled.length >= MIN_INVITE_IDENTIFIER,
    retry: false,
    staleTime: 30_000,
  });

  if (typed.length < MIN_INVITE_IDENTIFIER) return { kind: "idle" };
  if (query.isPaused || query.isError) return { kind: "unavailable" };
  if (typed !== settled || query.isPending) return { kind: "searching" };
  return query.data ? { kind: "found", invitee: query.data } : { kind: "not-found" };
}
