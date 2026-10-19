import { onlineManager } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { accountTokens } from "@/lib/account-tokens";
import { HTTP_STATUS } from "@/lib/constants";
import { emitSessionRenewed } from "@/lib/session-events";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { logoutQuietly, revokeSwitchTokenQuietly, switchRequest } from "@/features/accounts/api/account-switch-requests";

let running: Promise<void> | null = null;

/**
 * One-time move from builds before device-bound sessions, which kept a
 * 180-day switch token per saved account instead of a session. Each inactive
 * account still holding one trades it, once, for its own session on this
 * device (POST /auth/switch naming the device; no new switch token comes
 * back). Online only; an account whose trade fails on the network is tried
 * again next time, one the server refuses is marked "Cần đăng nhập lại". The active
 * account needs no trade — its session is already kept under it — so its
 * switch token is simply revoked.
 *
 * No identity check: nothing changes for whoever is using the phone, and the
 * check still guards every switch into these accounts.
 */
export function convertLegacySwitchTokens(activeUserId: string | null): Promise<void> {
  running ??= convertAll(activeUserId).finally(() => {
    running = null;
  });
  return running;
}

async function convertAll(activeUserId: string | null): Promise<void> {
  if (!onlineManager.isOnline()) return;
  for (const account of [...useAccountRegistryStore.getState().accounts]) {
    const legacy = await accountTokens.getLegacySwitchToken(account.userId);
    if (!legacy) continue;
    const hasSession = (await accountTokens.get(account.userId)) !== null;
    if (hasSession || account.userId === activeUserId || account.expired) {
      await accountTokens.removeLegacySwitchToken(account.userId).catch(() => {});
      revokeSwitchTokenQuietly(legacy);
      continue;
    }
    await tradeOne(account.userId, legacy);
  }
}

async function tradeOne(userId: string, legacy: string): Promise<void> {
  try {
    const res = await switchRequest(legacy);
    if (res.switch_token) revokeSwitchTokenQuietly(res.switch_token);
    // Removed while the request ran: the new session belongs to nobody here.
    if (!useAccountRegistryStore.getState().accounts.some((a) => a.userId === userId)) {
      logoutQuietly(res.refresh_token);
      return;
    }
    await accountTokens.set(userId, res.refresh_token);
    await accountTokens.removeLegacySwitchToken(userId).catch(() => {});
    emitSessionRenewed(userId, res.refresh_token);
  } catch (error) {
    const status = isAxiosError(error) ? error.response?.status : undefined;
    if (status === HTTP_STATUS.unauthorized || status === HTTP_STATUS.badRequest) {
      await accountTokens.removeLegacySwitchToken(userId).catch(() => {});
      useAccountRegistryStore.getState().markExpired(userId);
    }
  }
}
