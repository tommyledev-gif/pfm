import { router } from "expo-router";

import { userIdFromAccessToken } from "@/lib/jwt";
import { queryClient } from "@/lib/query-client";
import { useChatStore } from "@/stores/chat-store";
import { useSessionStore } from "@/stores/session-store";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { logoutQuietly } from "@/features/accounts/api/account-switch-requests";
import { IssuedSwitchToken } from "@/features/accounts/types";
import { User } from "@/features/users/types";
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
 * Swaps the device's session to `pair` (plan.md "commitSession" steps 2–6),
 * shared by switch, the login chooser, add-account and plain login:
 * remember the outgoing refresh token → cancel the outgoing User's in-flight
 * queries (EC-04) → setTokens (clears the cache on a user change and fires
 * session-scoped-reset's handleSessionUserChange) → go Home when a session
 * was already open (logged out, Stack.Protected's guard navigates instead)
 * → end the outgoing session server-side (plan Finding #14; the outgoing
 * User keeps their switch token, so switching back needs no password).
 */
export async function swapSession(pair: LoginResponse, email: string): Promise<void> {
  const outgoing = useSessionStore.getState();
  const outgoingRefresh = outgoing.refreshToken;
  const outgoingUserId = userIdFromAccessToken(outgoing.accessToken);
  const isUserChange = outgoingUserId !== userIdFromAccessToken(pair.access_token);

  await queryClient.cancelQueries();
  await useSessionStore.getState().setTokens(pair.access_token, pair.refresh_token, email);

  if (outgoingUserId) {
    if (router.canDismiss()) router.dismissAll();
    router.replace("/");
  }
  if (outgoingRefresh && isUserChange) logoutQuietly(outgoingRefresh);
}

/**
 * Full commit of a switch: the target's rotated switch token and registry
 * entry are stored FIRST (research P4, EC-06 — a crash after this leaves a
 * consistent state), then the session is swapped.
 */
export async function commitSession(user: User, pair: LoginResponse, issued: IssuedSwitchToken): Promise<void> {
  const outgoingUserId = userIdFromAccessToken(useSessionStore.getState().accessToken);
  await useAccountRegistryStore.getState().upsert(user, issued, {
    protectedUserIds: [outgoingUserId],
    revokePrevious: false,
  });
  await swapSession(pair, user.email);
}
