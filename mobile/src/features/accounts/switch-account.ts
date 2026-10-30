import { onlineManager } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { accountTokens } from "@/lib/account-tokens";
import { forgetAccountKey, openAccountToken, VaultError } from "@/lib/biometric-vault";
import { errorText, isNetworkError } from "@/lib/api-envelope";
import { HTTP_STATUS, SWITCH_CHAT_FLUSH_TIMEOUT_MS, SWITCH_REQUEST_TIMEOUT_MS } from "@/lib/constants";
import { i18n, TranslationKey } from "@/lib/i18n";
import { useToastStore } from "@/stores/toast-store";
import { refreshTokenRequest } from "@/features/auth/api/use-refresh-mutation";
import { LoginResponse } from "@/features/auth/types";
import { passSwitchIdentityCheck } from "@/features/security/identity-check";
import { useAccountRegistryStore, isAccountExpired } from "@/features/accounts/account-registry-store";
import { logoutQuietly, revokeSwitchTokenQuietly, switchRequest } from "@/features/accounts/api/account-switch-requests";
import { flushChatWithin, swapSession } from "@/features/accounts/commit-session";
import { useSwitchProgressStore } from "@/features/accounts/switch-progress-store";

export type SwitchOutcome = "switched" | "cancelled" | "failed" | "expired" | "ignored";

// Spec US-02 / S-ASW-15/18/19 copy (keys, read when the toast shows).
export const SWITCH_COPY = {
  expired: "accounts.switch.expired",
  interrupted: "accounts.switch.interrupted",
  offline: "accounts.switch.offline",
  generic: "accounts.switch.generic",
  needsPassword: "accounts.switch.needsPassword",
  notVerified: "accounts.switch.notVerified",
} as const satisfies Record<string, TranslationKey>;

// Module-level, taken BEFORE the identity prompt: a second tap anywhere
// (dialog, direct switch, login chooser) while one switch is running —
// including while the prompt is up — is ignored (AC-12, S-ASW-23, EC-13/17).
let inFlight = false;

function toast(key: (typeof SWITCH_COPY)[keyof typeof SWITCH_COPY]): void {
  showWarning(i18n.t(key));
}

function showWarning(message: string): void {
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
  if (account.locked) return unlockAccount(userId, account.email);
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
 * A locked account (logged out on this device): the vault's prompt — its
 * fingerprint, or from Android 11 the screen lock — is the identity check and
 * the only way to read its token. Then its session is renewed like any
 * switch. A key the phone has invalidated (a fingerprint added, the screen
 * lock removed) or a session the server refuses means the password, never a
 * way around it.
 */
async function unlockAccount(userId: string, email: string): Promise<SwitchOutcome> {
  const registry = useAccountRegistryStore.getState();
  const sealed = await accountTokens.getSealed(userId);
  if (!sealed) {
    registry.markExpired(userId);
    toast(SWITCH_COPY.needsPassword);
    return "expired";
  }

  let token: string;
  try {
    // The system prompt that opens a locked account.
    token = await openAccountToken(userId, sealed, i18n.t("accounts.switch.unlockPrompt"));
  } catch (error) {
    const kind = error instanceof VaultError ? error.kind : "failed";
    if (kind === "cancelled") return "cancelled";
    if (kind === "invalidated" || kind === "unavailable") {
      registry.markExpired(userId);
      toast(SWITCH_COPY.needsPassword);
      return "expired";
    }
    toast(SWITCH_COPY.notVerified);
    return "failed";
  }

  useSwitchProgressStore.getState().setSwitching(true);
  await flushChatWithin(SWITCH_CHAT_FLUSH_TIMEOUT_MS);
  try {
    const pair = await refreshTokenRequest(token, SWITCH_REQUEST_TIMEOUT_MS);
    // In use again: kept plain like any active session (it renews every few
    // minutes), the sealed copy and its key are done with.
    await accountTokens.set(userId, pair.refresh_token);
    await accountTokens.removeSealed(userId);
    forgetAccountKey(userId);
    if (!useAccountRegistryStore.getState().accounts.some((a) => a.userId === userId)) {
      logoutQuietly(pair.refresh_token);
      toast(SWITCH_COPY.generic);
      return "failed";
    }
    useAccountRegistryStore.getState().touch(userId);
    await swapSession(pair, email);
    return "switched";
  } catch (error) {
    // Offline or 5xx: still locked, the sealed token still the current one.
    return handleSwitchError(userId, error, null);
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
    showWarning(errorText(error, SWITCH_COPY.generic));
    return "failed";
  }
  toast(SWITCH_COPY.generic);
  return "failed";
}
