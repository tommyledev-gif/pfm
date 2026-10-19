import { useMutation } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { useSessionStore } from "@/stores/session-store";
import { LoginResponse } from "@/features/auth/types";
import { ChangePasswordRequest } from "@/features/security/types";

/**
 * PUT /users/me/password (specs/mobile-account-switch US-11). The server ends
 * every session of the account — this one included — and answers with a
 * fresh pair for this device, swapped in silently: same User, so setTokens
 * keeps the cache and keeps the new refresh token under the account. Every
 * other device, and every phone that saved this account, needs the new
 * password next time.
 */
export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: async (body: ChangePasswordRequest): Promise<LoginResponse> => {
      // A renewal in flight would come back refused (the change ends every
      // session) and could read as "signed out" — let it land first.
      await useSessionStore.getState().settleRefresh();
      return unwrap((await apiClient.put<ApiEnvelope<LoginResponse>>("/users/me/password", body)).data);
    },
    onSuccess: async (pair) => {
      const { email, setTokens } = useSessionStore.getState();
      await setTokens(pair.access_token, pair.refresh_token, email ?? "");
    },
  });
}
