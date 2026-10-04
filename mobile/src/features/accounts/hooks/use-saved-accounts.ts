import { useMemo } from "react";

import { MAX_SAVED_ACCOUNTS } from "@/lib/constants";
import { useSessionStore } from "@/stores/session-store";
import { useCurrentUserId } from "@/stores/use-current-user-id";
import { useAccountRegistryStore } from "@/features/accounts/account-registry-store";
import { SavedAccount } from "@/features/accounts/types";

interface SavedAccountsView {
  /** The signed-in User — always present while signed in, saved or not yet. */
  active: SavedAccount | null;
  others: SavedAccount[];
  /** Active first, then most recently used. */
  all: SavedAccount[];
  canAddMore: boolean;
}

const byRecentUse = (a: SavedAccount, b: SavedAccount) => Date.parse(b.lastUsedAt) - Date.parse(a.lastUsedAt);

/**
 * The device's accounts as Settings shows them. The active User is listed
 * even before their switch token arrived (AC-04 retry window), built from
 * the session — it is never tappable anyway ("Đang dùng").
 */
export function useSavedAccounts(): SavedAccountsView {
  const accounts = useAccountRegistryStore((s) => s.accounts);
  const activeUserId = useCurrentUserId();
  const email = useSessionStore((s) => s.email);
  const role = useSessionStore((s) => s.role);

  return useMemo(() => {
    const saved = accounts.find((a) => a.userId === activeUserId) ?? null;
    const now = new Date().toISOString();
    const active: SavedAccount | null =
      saved ??
      (activeUserId && email
        ? {
            userId: activeUserId,
            email,
            fullName: null,
            role: role ?? "member",
            switchIssuedAt: now,
            switchExpiresAt: now,
            lastUsedAt: now,
            expired: false,
            switchInterrupted: false,
          }
        : null);
    const others = accounts.filter((a) => a.userId !== activeUserId).sort(byRecentUse);
    const all = active ? [active, ...others] : others;
    return { active, others, all, canAddMore: all.length < MAX_SAVED_ACCOUNTS };
  }, [accounts, activeUserId, email, role]);
}
