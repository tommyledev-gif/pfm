import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { isNetworkError } from "@/lib/api-envelope";
import { HTTP_STATUS } from "@/lib/constants";
import { useSessionStore } from "@/stores/session-store";
import { useToastStore } from "@/stores/toast-store";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { RevokeAllSessionsResponse } from "@/features/security/types";

// Spec US-08 / S-ASW-61 / S-ASW-62 copy.
export const REVOKE_ALL_COPY = {
  success: "Đã đăng xuất mọi thiết bị khác.",
  offline: "Cần kết nối mạng để đăng xuất mọi thiết bị.",
  failed: "Không thể đăng xuất mọi thiết bị. Vui lòng thử lại.",
} as const;

/**
 * POST /auth/sessions/revoke-all (spec US-08). The answer carries a fresh
 * pair and switch token for this device, swapped in silently: same User, so
 * setTokens keeps the cache, and the old switch token is NOT revoked — the
 * sign-out already killed it (plan Finding #26). An in-flight refresh with
 * the old refresh token is ignored by session-store's stale-result guard.
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
      await useAccountRegistryStore
        .getState()
        .upsert(
          data.user,
          { token: data.switch_token, expiresAt: data.switch_token_expires_at },
          { protectedUserIds: [data.user.id], revokePrevious: false },
        )
        .catch(() => {});
      useToastStore.getState().show(REVOKE_ALL_COPY.success, "info");
    },
    onError: (error) => {
      // 401: the session itself was refused — apiClient's interceptor has
      // already run the existing session-ended handling.
      if (isAxiosError(error) && error.response?.status === HTTP_STATUS.unauthorized) return;
      useToastStore.getState().show(isNetworkError(error) ? REVOKE_ALL_COPY.offline : REVOKE_ALL_COPY.failed, "warning");
    },
  });
}
