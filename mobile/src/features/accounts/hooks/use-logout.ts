import { useCallback, useState } from "react";

import { accountTokens } from "@/lib/account-tokens";
import { sealAccountToken, vaultInstalled, vaultReady } from "@/lib/biometric-vault";
import { LOGOUT_FLUSH_TIMEOUT_MS } from "@/lib/constants";
import { userIdFromAccessToken } from "@/lib/jwt";
import { queryClient } from "@/lib/query-client";
import { cancelScheduledRefresh } from "@/lib/refresh-scheduler";
import { useChatStore } from "@/stores/chat-store";
import { useSessionStore } from "@/stores/session-store";
import { useToastStore } from "@/stores/toast-store";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { removeActiveAccount } from "@/features/accounts/remove-account";

const NO_LOCK_REMOVED = "Máy chưa cài khóa màn hình nên tài khoản đã được gỡ khỏi máy.";

/**
 * Seals the session's refresh token in the biometric vault and drops the
 * plain copy. A renewal landing in between would leave the sealed token one
 * behind the server (its grace runs out in minutes), so the token is sealed
 * again if it moved. False when sealing failed.
 */
async function sealActiveSession(userId: string): Promise<boolean> {
  cancelScheduledRefresh();
  // No request left in flight to come back 401 and renew mid-seal.
  await queryClient.cancelQueries();
  for (let attempt = 0; attempt < 2; attempt++) {
    await useSessionStore.getState().settleRefresh();
    const refreshToken = useSessionStore.getState().refreshToken;
    if (!refreshToken) return false;
    try {
      const sealed = await sealAccountToken(userId, refreshToken);
      if (useSessionStore.getState().refreshToken !== refreshToken) continue;
      await accountTokens.setSealed(userId, sealed);
      await accountTokens.remove(userId);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * "Đăng xuất" = lock the account on this device: no prompt, no question.
 * Its session stays on the server; on the phone its access token and saved
 * cache are cleared and its refresh token is kept only sealed by the
 * biometric vault (lib/biometric-vault.ts). The account stays on the login
 * screen, and the fingerprint — or from Android 11 the screen lock — brings
 * it back (switch-account.ts). Its local plan and phrases stay.
 *
 * A phone with no screen lock has nothing to guard a kept account with, so
 * there logout takes the account off the device instead and says why. A
 * build without the vault (Expo Go) does the same, silently.
 */
export function useLogout(): { loggingOut: boolean; logout: () => Promise<void> } {
  const [loggingOut, setLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    const userId = userIdFromAccessToken(useSessionStore.getState().accessToken);
    const listed = userId !== null && useAccountRegistryStore.getState().accounts.some((a) => a.userId === userId);

    if (userId && listed && vaultReady()) {
      await Promise.race([
        useChatStore.getState().flushSync().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, LOGOUT_FLUSH_TIMEOUT_MS)),
      ]);
      if (await sealActiveSession(userId)) {
        useAccountRegistryStore.getState().lock(userId);
        useChatStore.getState().clear();
        await useSessionStore.getState().clear();
        return;
      }
    }

    const noLock = listed && vaultInstalled() && !vaultReady();
    await removeActiveAccount();
    if (noLock) useToastStore.getState().show(NO_LOCK_REMOVED, "info");
  }, [loggingOut]);

  return { loggingOut, logout };
}
