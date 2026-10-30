import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { isNetworkError } from "@/lib/api-envelope";
import { HTTP_STATUS } from "@/lib/constants";
import { i18n } from "@/lib/i18n";
import { useSessionStore } from "@/stores/session-store";
import { useToastStore } from "@/stores/toast-store";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { revokeSwitchTokenQuietly } from "@/features/accounts/api/account-switch-requests";
import { RevokeAllSessionsResponse } from "@/features/security/types";

// Spec US-08 / S-ASW-61 / S-ASW-62 copy, as keys: read in the language
// in use when the toast shows.
export const REVOKE_ALL_COPY = {
  success: "security.revokeAll.success",
  offline: "security.revokeAll.offline",
  failed: "security.revokeAll.failed",
} as const;

/**
 * POST /auth/sessions/revoke-all (spec US-08). The answer carries a fresh
 * pair for this device, swapped in silently: same User, so setTokens keeps
 * the cache and keeps the new refresh token under the account. An in-flight
 * refresh with the old refresh token is ignored by session-store's
 * stale-result guard. A switch token only comes back from a server older
 * than device-bound sessions, and is given straight back.
 */
export function useRevokeAllSessionsMutation() {
  return useMutation({
    mutationFn: async (): Promise<RevokeAllSessionsResponse> => {
      const res = await apiClient.post<ApiEnvelope<RevokeAllSessionsResponse>>("/auth/sessions/revoke-all");
      return unwrap(res.data);
    },
    onSuccess: async (data) => {
      const email = useSessionStore.getState().email ?? data.user.email;
      await useSessionStore.getState().setTokens(data.access_token, data.refresh_token, email);
      if (data.switch_token) revokeSwitchTokenQuietly(data.switch_token);
      await useAccountRegistryStore
        .getState()
        .upsert(data.user, { protectedUserIds: [data.user.id] })
        .catch(() => {});
      useToastStore.getState().show(i18n.t(REVOKE_ALL_COPY.success), "info");
    },
    onError: (error) => {
      // 401: the session itself was refused — apiClient's interceptor has
      // already run the existing session-ended handling.
      if (isAxiosError(error) && error.response?.status === HTTP_STATUS.unauthorized) return;
      useToastStore.getState().show(i18n.t(isNetworkError(error) ? REVOKE_ALL_COPY.offline : REVOKE_ALL_COPY.failed), "warning");
    },
  });
}
