import { onlineManager } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { getErrorMessage, isNetworkError } from "@/lib/api-envelope";
import { HTTP_STATUS, SWITCH_CHAT_FLUSH_TIMEOUT_MS } from "@/lib/constants";
import { useToastStore } from "@/stores/toast-store";
import { passSwitchIdentityCheck } from "@/features/security/identity-check";
import { useAccountRegistryStore, isAccountExpired } from "@/features/accounts/account-registry-store";
import { logoutQuietly, revokeSwitchTokenQuietly, switchRequest } from "@/features/accounts/api/account-switch-requests";
import { commitSession, flushChatWithin } from "@/features/accounts/commit-session";
import { useSwitchProgressStore } from "@/features/accounts/switch-progress-store";

export type SwitchOutcome = "switched" | "cancelled" | "failed" | "expired" | "ignored";

// Spec US-02 / S-ASW-15/18/19 copy.
export const SWITCH_COPY = {
  expired: "Tài khoản này đã hết hạn. Vui lòng đăng nhập lại.",
  interrupted: "Lần chuyển tài khoản trước bị gián đoạn nên cần đăng nhập lại tài khoản này bằng mật khẩu.",
  offline: "Cần kết nối mạng để chuyển tài khoản.",
  generic: "Không thể chuyển tài khoản. Vui lòng thử lại.",
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
 * Switches the device into a saved account (spec US-02, US-05 chooser).
 * Nothing is written before the server says yes (AC-11); a lost answer
 * never marks the account expired, it only remembers the interruption
 * (BR-16). Expired rows are routed to the login form by the caller and
 * never reach the identity check (AC-33).
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
  if (!(await passSwitchIdentityCheck(account.role))) return "cancelled";

  useSwitchProgressStore.getState().setSwitching(true);
  await flushChatWithin(SWITCH_CHAT_FLUSH_TIMEOUT_MS);

  const token = await registry.getToken(userId);
  if (!token) {
    registry.markExpired(userId);
    toast(SWITCH_COPY.expired);
    return "expired";
  }

  try {
    const res = await switchRequest(token);
    // EC-08: the account was removed while the request ran — abandon, and
    // give back what the server just issued.
    if (!useAccountRegistryStore.getState().accounts.some((a) => a.userId === userId)) {
      logoutQuietly(res.refresh_token);
      revokeSwitchTokenQuietly(res.switch_token);
      toast(SWITCH_COPY.generic);
      return "failed";
    }
    await commitSession(
      res.user,
      { access_token: res.access_token, refresh_token: res.refresh_token },
      { token: res.switch_token, expiresAt: res.switch_token_expires_at },
    );
    return "switched";
  } catch (error) {
    return handleSwitchError(userId, error);
  }
}

function handleSwitchError(userId: string, error: unknown): SwitchOutcome {
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
