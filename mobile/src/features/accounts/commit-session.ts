import { router } from "expo-router";

import { accountTokens } from "@/lib/account-tokens";
import { userIdFromAccessToken } from "@/lib/jwt";
import { queryClient } from "@/lib/query-client";
import { useChatStore } from "@/stores/chat-store";
import { useSessionStore } from "@/stores/session-store";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { logoutQuietly } from "@/features/accounts/api/account-switch-requests";
import { LoginResponse } from "@/features/auth/types";

/** Best-effort: lets chat-store's last edits reach the CURRENT User's account. */
export async function flushChatWithin(timeoutMs: number): Promise<void> {
  if (!useSessionStore.getState().accessToken) return;
  await Promise.race([
    useChatStore.getState().flushSync().catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/**
 * Swaps the device's active session to `pair`, shared by switch, the login
 * chooser, add-account and plain login: let a renewal of the outgoing User
 * land (its newest refresh token must be the one kept under their account) →
 * cancel the outgoing User's in-flight queries (EC-04) → setTokens (clears
 * the cache on a user change, fires session-scoped-reset's
 * handleSessionUserChange, and keeps the new token under the new account) →
 * go Home when a session was already open (logged out, Stack.Protected's
 * guard navigates instead).
 *
 * The outgoing User's session is NOT ended: it stays on this device as their
 * saved account, so switching back is a renewal of it, no password. Only an
 * outgoing User this device does not list (their identity never arrived,
 * AC-04) has it ended — nothing could reach it again.
 */
export async function swapSession(pair: LoginResponse, email: string): Promise<void> {
  await useSessionStore.getState().settleRefresh();
  const outgoingUserId = userIdFromAccessToken(useSessionStore.getState().accessToken);
  const isUserChange = outgoingUserId !== userIdFromAccessToken(pair.access_token);

  await queryClient.cancelQueries();
  await useSessionStore.getState().setTokens(pair.access_token, pair.refresh_token, email);

  if (outgoingUserId) {
    if (router.canDismiss()) router.dismissAll();
    router.replace("/");
  }
  if (outgoingUserId && isUserChange && !useAccountRegistryStore.getState().accounts.some((a) => a.userId === outgoingUserId)) {
    const orphan = await accountTokens.get(outgoingUserId);
    await accountTokens.remove(outgoingUserId).catch(() => {});
    if (orphan) logoutQuietly(orphan);
  }
}
