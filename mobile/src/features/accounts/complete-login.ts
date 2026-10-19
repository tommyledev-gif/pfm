import { isAxiosError } from "axios";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { userIdFromAccessToken } from "@/lib/jwt";
import { HTTP_STATUS, SWITCH_CHAT_FLUSH_TIMEOUT_MS } from "@/lib/constants";
import { useSessionStore } from "@/stores/session-store";
import { useToastStore } from "@/stores/toast-store";
import { useAccessRequestStore } from "@/features/auth/access-request-store";
import { LoginResponse } from "@/features/auth/types";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { flushChatWithin, swapSession } from "@/features/accounts/commit-session";
import { useSwitchProgressStore } from "@/features/accounts/switch-progress-store";
import { User } from "@/features/users/types";

export type LoginOutcome = "signed-in" | "same-user";

export const ALREADY_ACTIVE_MESSAGE = "Bạn đang dùng tài khoản này.";

// Login and the sync hook can both ask at once — one request serves both.
let rememberInFlight: Promise<boolean> | null = null;

/**
 * Lists the signed-in User among the device's saved accounts (US-01). Their
 * session is already kept under their account by the session store; this
 * only fetches the name, email, role and picture the list shows
 * (GET /users/me). Failure is tolerated (AC-04): the User stays signed in
 * and use-saved-account-sync.ts asks again on the next start. Returns false
 * only when the server refused the caller (401).
 */
export function rememberActiveAccount(): Promise<boolean> {
  if (!rememberInFlight) {
    rememberInFlight = fetchAndListActiveUser().finally(() => {
      rememberInFlight = null;
    });
  }
  return rememberInFlight;
}

async function fetchAndListActiveUser(): Promise<boolean> {
  const sessionUserId = userIdFromAccessToken(useSessionStore.getState().accessToken);
  if (!sessionUserId) return true;
  try {
    const user = unwrap((await apiClient.get<ApiEnvelope<User>>("/users/me")).data);
    // EC-01: the session ended or changed while this was in flight.
    if (userIdFromAccessToken(useSessionStore.getState().accessToken) !== user.id) return true;
    await useAccountRegistryStore.getState().upsert(user, { protectedUserIds: [user.id] });
    return true;
  } catch (error) {
    return !(isAxiosError(error) && error.response?.status === HTTP_STATUS.unauthorized);
  }
}

/**
 * Finishes a sign-in — password or passkey, plain (logged out) or
 * "+ Thêm tài khoản" while another User is active (US-03).
 */
export async function completeLogin(pair: LoginResponse, email: string): Promise<LoginOutcome> {
  const currentUserId = userIdFromAccessToken(useSessionStore.getState().accessToken);
  // AC-16: signing in as the account already in use changes nothing on
  // screen. The new pair is kept, though: on this device it has replaced the
  // session in use server-side (one session per account per device), so
  // dropping it would sign the User out.
  if (currentUserId && currentUserId === userIdFromAccessToken(pair.access_token)) {
    await useSessionStore.getState().setTokens(pair.access_token, pair.refresh_token, useSessionStore.getState().email ?? email);
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
  // A request sent from here has become an account: the login screen lists
  // it as a saved account from now on, not as a request.
  useAccessRequestStore.getState().remove(email);
  void rememberActiveAccount();
  return "signed-in";
}
