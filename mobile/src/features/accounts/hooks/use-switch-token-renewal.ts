import { useEffect } from "react";
import { AppState } from "react-native";

import { SWITCH_TOKEN_RENEW_AFTER_SECONDS } from "@/lib/constants";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { rememberActiveAccount } from "@/features/accounts/complete-login";

const MS_PER_SECOND = 1000;

// User ids whose renewal the server refused during their current session
// (signed out everywhere, S-ASW-66) — not retried until that session ends.
const refusedFor = new Set<string>();

async function renewIfDue(userId: string): Promise<void> {
  const registry = useAccountRegistryStore.getState();
  if (!registry.isHydrated) return;
  registry.expireOverdue();
  if (refusedFor.has(userId)) return;

  const account = registry.accounts.find((a) => a.userId === userId);
  const token = account ? await registry.getToken(userId) : null;
  const ageMs = account ? Date.now() - Date.parse(account.switchIssuedAt) : Infinity;
  // Missing from the list (a session from before this feature, or a failed
  // first request — plan Finding #13 / AC-04), no token, or older than a day.
  const due = !account || !token || ageMs >= SWITCH_TOKEN_RENEW_AFTER_SECONDS * MS_PER_SECOND;
  if (!due) return;

  // Offline / 5xx fail silently and are retried next time (EC-15).
  if (!(await rememberActiveAccount())) refusedFor.add(userId);
}

/**
 * Keeps the ACTIVE account's switch token fresh, at most once a day, on
 * start and whenever the app returns to the foreground (spec US-06,
 * plan Finding #3) — so an account in continuous use never reaches its
 * 180-day expiry. Also marks overdue saved accounts as expired. Mounted
 * once in app/(app)/_layout.tsx (signed-in area only).
 */
export function useSwitchTokenRenewal(): void {
  const userId = useCurrentUserId();
  const registryHydrated = useAccountRegistryStore((s) => s.isHydrated);

  useEffect(() => {
    if (!userId || !registryHydrated) return;
    renewIfDue(userId).catch(() => {});
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") renewIfDue(userId).catch(() => {});
    });
    return () => {
      subscription.remove();
      refusedFor.delete(userId);
    };
  }, [userId, registryHydrated]);
}
