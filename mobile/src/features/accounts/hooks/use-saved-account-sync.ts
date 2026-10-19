import { useEffect } from "react";
import { AppState } from "react-native";

import { useCurrentUserId } from "@/stores/use-current-user-id";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { rememberActiveAccount } from "@/features/accounts/complete-login";
import { convertLegacySwitchTokens } from "@/features/accounts/convert-legacy-accounts";

async function syncSavedAccounts(activeUserId: string): Promise<void> {
  const registry = useAccountRegistryStore.getState();
  if (!registry.isHydrated) return;
  registry.expireOverdue();
  // Signed in but not listed: the identity request after login failed
  // (AC-04), or the session predates the list. Offline / 5xx retry next time.
  if (!registry.accounts.some((a) => a.userId === activeUserId)) await rememberActiveAccount();
  await convertLegacySwitchTokens(activeUserId);
}

/**
 * Keeps the device's saved accounts in step, on start and whenever the app
 * returns to the foreground: marks accounts whose session ran out, lists the
 * signed-in User if they are missing, and trades switch tokens an older build
 * left behind for sessions (convert-legacy-accounts.ts). There is no renewal
 * to schedule any more — each account's session is renewed by using it.
 * Mounted once in app/(app)/_layout.tsx (signed-in area only).
 */
export function useSavedAccountSync(): void {
  const userId = useCurrentUserId();
  const registryHydrated = useAccountRegistryStore((s) => s.isHydrated);

  useEffect(() => {
    if (!userId || !registryHydrated) return;
    syncSavedAccounts(userId).catch(() => {});
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") syncSavedAccounts(userId).catch(() => {});
    });
    return () => subscription.remove();
  }, [userId, registryHydrated]);
}
