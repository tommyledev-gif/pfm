import { onlineManager } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { accountTokens } from "@/lib/account-tokens";
import { getErrorMessage, isNetworkError } from "@/lib/api-envelope";
import { HTTP_STATUS, SWITCH_CHAT_FLUSH_TIMEOUT_MS, SWITCH_REQUEST_TIMEOUT_MS } from "@/lib/constants";
import { useToastStore } from "@/stores/toast-store";
import { refreshTokenRequest } from "@/features/auth/api/use-refresh-mutation";
import { LoginResponse } from "@/features/auth/types";
import { passSwitchIdentityCheck } from "@/features/security/identity-check";
import { useAccountRegistryStore, isAccountExpired } from "@/features/accounts/account-registry-store";
import { logoutQuietly, revokeSwitchTokenQuietly, switchRequest } from "@/features/accounts/api/account-switch-requests";
import { flushChatWithin, swapSession } from "@/features/accounts/commit-session";
import { useSwitchProgressStore } from "@/features/accounts/switch-progress-store";

export type SwitchOutcome = "switched" | "cancelled" | "failed" | "expired" | "ignored";

// Spec US-02 / S-ASW-15/18/19 copy.
export const SWITCH_COPY = {
  expired: "Cần đăng nhập lại tài khoản này.",
  interrupted: "Lần chuyển trước bị gián đoạn. Cần đăng nhập lại tài khoản này.",
  offline: "Cần kết nối mạng để chuyển tài khoản.",
  generic: "Chưa chuyển được tài khoản. Thử lại sau.",
} as const;

// Module-level, taken BEFORE the identity prompt: a second tap anywhere
// (dialog, direct switch, login chooser) while one switch is running —
// including while the prompt is up — is ignored (AC-12, S-ASW-23, EC-13/17).
let inFlight = false;

function capitalize(text: string): string {
  return text.length ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function toast(message: string): void {
  useToastStore.getState().show(message, "warning");
}

/**
 * Switches the device into a saved account (spec US-02, US-05 chooser):
 * renews that account's own session on this device with the refresh token
 * kept under it, then makes it the active one. The account switched away
 * from keeps its session. Nothing changes before the server says yes
 * (AC-11); a lost answer never marks the account expired, it only remembers
 * the interruption (BR-16). Expired rows are routed to the login form by the
 * caller and never reach the identity check (AC-33).
 */
export async function switchToAccount(userId: string): Promise<SwitchOutcome> {
  if (inFlight) return "ignored";
  inFlight = true;
  try {
    return await runSwitch(userId);
  } finally {
    inFlight = false;
    useSwitchProgressStore.getState().setSwitching(false);
  }
}

async function runSwitch(userId: string): Promise<SwitchOutcome> {
  const registry = useAccountRegistryStore.getState();
  const account = registry.accounts.find((a) => a.userId === userId);
  if (!account) {
    toast(SWITCH_COPY.generic);
    return "failed";
  }
  if (isAccountExpired(account)) return "expired";
  // A switch always needs the server (spec Out of Scope: offline switching).
  if (!onlineManager.isOnline()) {
    toast(SWITCH_COPY.offline);
    return "failed";
  }
  // The phone's own fingerprint / face / screen-lock prompt, never a
  // passkey: the saved session is the credential, so a passkey here would
  // only add the Google Password Manager sheet to every switch. Passkeys stay
  // opt-in — "Đăng nhập bằng passkey" on the login screen.
  if (!(await passSwitchIdentityCheck(account.role))) return "cancelled";

  useSwitchProgressStore.getState().setSwitching(true);
  await flushChatWithin(SWITCH_CHAT_FLUSH_TIMEOUT_MS);

  const token = await accountTokens.get(userId);
  const legacy = token ? null : await accountTokens.getLegacySwitchToken(userId);
  if (!token && !legacy) {
    registry.markExpired(userId);
    toast(SWITCH_COPY.expired);
    return "expired";
  }

  try {
    const pair = token ? await renewSavedSession(userId, token) : await tradeLegacySwitchToken(userId, legacy ?? "");
    // EC-08: the account was removed while the request ran — abandon, and
    // end the session the server just renewed.
    if (!useAccountRegistryStore.getState().accounts.some((a) => a.userId === userId)) {
      logoutQuietly(pair.refresh_token);
      toast(SWITCH_COPY.generic);
      return "failed";
    }
    useAccountRegistryStore.getState().touch(userId);
    await swapSession(pair, account.email);
    return "switched";
  } catch (error) {
    return handleSwitchError(userId, error, token);
  }
}

/**
 * POST /auth/refresh with the account's own refresh token. The new token is
 * kept under the account before anything else (EC-06): the old one is
 * already used up on the server, so a crash right after must not leave it.
 */
async function renewSavedSession(userId: string, token: string): Promise<LoginResponse> {
  const pair = await refreshTokenRequest(token, SWITCH_REQUEST_TIMEOUT_MS);
  await accountTokens.replace(userId, token, pair.refresh_token);
  return pair;
}

/**
 * An account saved by an older build still holds a switch token: trade it
 * for a session on this device (the server sends no new switch token to a
 * request that names its device) and keep that instead.
 */
async function tradeLegacySwitchToken(userId: string, legacy: string): Promise<LoginResponse> {
  const res = await switchRequest(legacy);
  await accountTokens.set(userId, res.refresh_token);
  await accountTokens.removeLegacySwitchToken(userId).catch(() => {});
  if (res.switch_token) revokeSwitchTokenQuietly(res.switch_token);
  return { access_token: res.access_token, refresh_token: res.refresh_token };
}

function handleSwitchError(userId: string, error: unknown, token: string | null): SwitchOutcome {
  const registry = useAccountRegistryStore.getState();
  if (isNetworkError(error)) {
    registry.setInterrupted(userId, true);
    toast(SWITCH_COPY.offline);
    return "failed";
  }
  const status = isAxiosError(error) ? error.response?.status : undefined;
  if (status === HTTP_STATUS.unauthorized || status === HTTP_STATUS.badRequest) {
    const wasInterrupted = registry.accounts.find((a) => a.userId === userId)?.switchInterrupted ?? false;
    registry.markExpired(userId);
    // The session is over on the server; nothing left to resume.
    if (token) void accountTokens.removeIf(userId, token).catch(() => false);
    else void accountTokens.removeLegacySwitchToken(userId).catch(() => {});
    toast(wasInterrupted ? SWITCH_COPY.interrupted : SWITCH_COPY.expired);
    return "expired";
  }
  if (status === HTTP_STATUS.tooManyRequests) {
    toast(capitalize(getErrorMessage(error, SWITCH_COPY.generic)));
    return "failed";
  }
  toast(SWITCH_COPY.generic);
  return "failed";
}
