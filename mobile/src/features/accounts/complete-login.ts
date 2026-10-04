import { isAxiosError } from "axios";

import { userIdFromAccessToken } from "@/lib/jwt";
import { HTTP_STATUS, SWITCH_CHAT_FLUSH_TIMEOUT_MS } from "@/lib/constants";
import { useSessionStore } from "@/stores/session-store";
import { useToastStore } from "@/stores/toast-store";
import { LoginResponse } from "@/features/auth/types";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import {
  issueSwitchTokenRequest,
  logoutQuietly,
  revokeSwitchTokenQuietly,
} from "@/features/accounts/api/account-switch-requests";
import { flushChatWithin, swapSession } from "@/features/accounts/commit-session";
import { useSwitchProgressStore } from "@/features/accounts/switch-progress-store";

export type LoginOutcome = "signed-in" | "same-user";

export const ALREADY_ACTIVE_MESSAGE = "Bạn đang dùng tài khoản này.";

/**
 * Remembers the signed-in User on this device (US-01) by asking for a fresh
 * switch token AS that User. Failure is tolerated (AC-04): the User stays
 * signed in and use-switch-token-renewal.ts retries on the next start.
 * Returns false only when the server refused the caller (401), which the
 * renewal hook uses to stop retrying for the session (S-ASW-66).
 */
// Login and the renewal hook can both ask at once — one request serves both.
let rememberInFlight: Promise<boolean> | null = null;

export function rememberActiveAccount(): Promise<boolean> {
  if (!rememberInFlight) {
    rememberInFlight = requestAndStoreSwitchToken().finally(() => {
      rememberInFlight = null;
    });
  }
  return rememberInFlight;
}

async function requestAndStoreSwitchToken(): Promise<boolean> {
  const sessionUserId = userIdFromAccessToken(useSessionStore.getState().accessToken);
  if (!sessionUserId) return true;
  try {
    const res = await issueSwitchTokenRequest();
    // EC-01: the session ended or changed while this was in flight — the
    // token belongs to nobody on this device any more.
    if (userIdFromAccessToken(useSessionStore.getState().accessToken) !== res.user.id) {
      revokeSwitchTokenQuietly(res.switch_token);
      return true;
    }
    await useAccountRegistryStore.getState().upsert(
      res.user,
      { token: res.switch_token, expiresAt: res.expires_at },
      { protectedUserIds: [res.user.id], revokePrevious: true },
    );
    return true;
  } catch (error) {
    return !(isAxiosError(error) && error.response?.status === HTTP_STATUS.unauthorized);
  }
}

/**
 * Finishes a password login — plain (logged out) or "+ Thêm tài khoản"
 * while another User is active (US-03). The session is committed FIRST and
 * the switch token requested afterwards, because apiClient always carries
 * the current session's bearer (plan.md Finding #7).
 */
export async function completeLogin(pair: LoginResponse, email: string): Promise<LoginOutcome> {
  const currentUserId = userIdFromAccessToken(useSessionStore.getState().accessToken);
  // AC-16: logging in as the account already in use changes nothing; the
  // unused new session is ended server-side.
  if (currentUserId && currentUserId === userIdFromAccessToken(pair.access_token)) {
    logoutQuietly(pair.refresh_token);
    useToastStore.getState().show(ALREADY_ACTIVE_MESSAGE, "info");
    return "same-user";
  }

  const progress = useSwitchProgressStore.getState();
  if (currentUserId) progress.setSwitching(true);
  try {
    await flushChatWithin(SWITCH_CHAT_FLUSH_TIMEOUT_MS);
    await swapSession(pair, email);
  } finally {
    progress.setSwitching(false);
  }
  void rememberActiveAccount();
  return "signed-in";
}
