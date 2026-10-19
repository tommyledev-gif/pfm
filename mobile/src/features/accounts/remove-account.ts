import { accountTokens } from "@/lib/account-tokens";
import { LOGOUT_FLUSH_TIMEOUT_MS } from "@/lib/constants";
import { openAccountToken, VaultError } from "@/lib/biometric-vault";
import { userIdFromAccessToken } from "@/lib/jwt";
import { useChatStore } from "@/stores/chat-store";
import { useSessionStore } from "@/stores/session-store";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { logoutQuietly, logoutRequest } from "@/features/accounts/api/account-switch-requests";

const REMOVE_PROMPT = "Xác minh để gỡ tài khoản";

export type RemoveOutcome = "removed" | "cancelled";

/**
 * "Gỡ khỏi thiết bị" for an account that is not the one in use: its session
 * on this device is ended server-side, its token, local data and saved cache
 * deleted. A locked account's token is sealed, so the owner's check opens it
 * first — the only way to end that session from here. Cancelling the check
 * keeps the account; a key that can no longer be opened (fingerprints
 * changed) is simply deleted, which leaves its token unreadable for good, and
 * the session runs out on its own (60 days) or is signed out from the
 * "Thiết bị đang đăng nhập" list.
 */
export async function removeSavedAccount(userId: string): Promise<RemoveOutcome> {
  const account = useAccountRegistryStore.getState().accounts.find((a) => a.userId === userId);
  if (account?.locked) {
    const sealed = await accountTokens.getSealed(userId);
    if (sealed) {
      try {
        logoutQuietly(await openAccountToken(userId, sealed, REMOVE_PROMPT));
      } catch (error) {
        if (error instanceof VaultError && error.kind === "cancelled") return "cancelled";
      }
    }
  }
  await useAccountRegistryStore.getState().remove(userId, { endSession: true, dropLocalData: true });
  return "removed";
}

/**
 * Takes the account in use off this device entirely: the chat's last edits
 * get their chance to sync, its session is ended server-side (both best
 * effort, within LOGOUT_FLUSH_TIMEOUT_MS, so it still works offline), then its
 * token, local data and cache go and the login screen shows. Also what
 * "Đăng xuất" does on a phone with no screen lock to guard a locked account.
 */
export async function removeActiveAccount(): Promise<void> {
  const { accessToken, refreshToken } = useSessionStore.getState();
  const userId = userIdFromAccessToken(accessToken);

  await Promise.race([
    Promise.allSettled([
      useChatStore.getState().flushSync(),
      refreshToken ? logoutRequest(refreshToken) : Promise.resolve(),
    ]),
    new Promise((resolve) => setTimeout(resolve, LOGOUT_FLUSH_TIMEOUT_MS)),
  ]);

  if (userId) await useAccountRegistryStore.getState().remove(userId, { endSession: false, dropLocalData: true });
  useChatStore.getState().clear();
  await useSessionStore.getState().clear();
}
