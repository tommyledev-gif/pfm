import { useCallback, useState } from "react";

import { LOGOUT_FLUSH_TIMEOUT_MS } from "@/lib/constants";
import { userIdFromAccessToken } from "@/lib/jwt";
import { useChatStore } from "@/stores/chat-store";
import { useSessionStore } from "@/stores/session-store";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { logoutRequest, revokeSwitchTokenRequest } from "@/features/accounts/api/account-switch-requests";

/**
 * "Đăng xuất" (spec US-05). Within one LOGOUT_FLUSH_TIMEOUT_MS cap, in
 * parallel: chat-store's last sync, ending the session server-side, and
 * revoking this User's switch token — all best effort, so logout still
 * completes offline (AC-23). Then the User leaves the device's account list
 * (AC-20; their local plan/phrases stay, as on any logout) and the session
 * is cleared, which lands on the login screen with "Tiếp tục với…" rows for
 * whoever else is saved (AC-21).
 */
export function useLogout(): { loggingOut: boolean; logout: () => Promise<void> } {
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    const { accessToken, refreshToken } = useSessionStore.getState();
    const userId = userIdFromAccessToken(accessToken);
    const registry = useAccountRegistryStore.getState();
    const switchToken = userId ? await registry.getToken(userId) : null;

    await Promise.race([
      Promise.allSettled([
        useChatStore.getState().flushSync(),
        refreshToken ? logoutRequest(refreshToken) : Promise.resolve(),
        switchToken ? revokeSwitchTokenRequest(switchToken) : Promise.resolve(),
      ]),
      new Promise((resolve) => setTimeout(resolve, LOGOUT_FLUSH_TIMEOUT_MS)),
    ]);

    if (userId) await registry.remove(userId, { revoke: false, dropLocalData: false });
    useChatStore.getState().clear();
    await useSessionStore.getState().clear();
  }, [loggingOut]);

  return { loggingOut, logout };
}
