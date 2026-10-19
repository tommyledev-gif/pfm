import { create } from "zustand";

import { MAX_SAVED_ACCOUNTS, SECURE_STORE_ACCOUNTS_KEY } from "@/lib/constants";
import { accountTokens } from "@/lib/account-tokens";
import { tokenExpiresAt } from "@/lib/jwt";
import { removeUserQueryCache } from "@/lib/query-persistence/user-cache-persister";
import { secureStorage } from "@/lib/secure-storage";
import { onSessionRefused, onSessionRenewed } from "@/lib/session-events";
import { useSavedBudgetPlanStore } from "@/features/budget-wizard/saved-plan";
import { useRecentPhrasesStore } from "@/stores/recent-phrases-store";
import { useSavedPhrasesStore } from "@/stores/saved-phrases-store";
import { useSavedPlacesStore } from "@/stores/saved-places-store";
import { logoutQuietly, revokeSwitchTokenQuietly } from "@/features/accounts/api/account-switch-requests";
import { SavedAccount } from "@/features/accounts/types";
import { User } from "@/features/users/types";

interface RemoveOptions {
  /** End the account's session on the server (false when logout already did). */
  endSession: boolean;
  /** Delete the User's local-only data (plan, phrases, places) — US-04, not logout. */
  dropLocalData: boolean;
}

interface UpsertOptions {
  /** Never evicted by this upsert (the incoming and the outgoing active User). */
  protectedUserIds: (string | null)[];
}

interface AccountRegistryState {
  accounts: SavedAccount[];
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  /** The account's refresh token — its session on this device. */
  getToken: (userId: string) => Promise<string | null>;
  /**
   * Lists or refreshes a User whose session is already kept under their
   * account (BR-01/02, AC-02/03). Without one there is nothing to switch to,
   * so the User is not listed (EC-02).
   */
  upsert: (user: User, options: UpsertOptions) => Promise<void>;
  remove: (userId: string, options: RemoveOptions) => Promise<void>;
  /** Keeps a saved account's name and picture in step with the profile. */
  updateIdentity: (userId: string, identity: { fullName: string | null; avatarUrl: string | null }) => void;
  /** A switch into the account just succeeded. */
  touch: (userId: string) => void;
  /** The account's session was renewed: move its expiry, clear "Hết phiên". */
  renewed: (userId: string, refreshToken: string) => void;
  markExpired: (userId: string) => void;
  setInterrupted: (userId: string, interrupted: boolean) => void;
  /** Marks every account whose session is past its expiry (device clock). */
  expireOverdue: () => void;
}

// Every index write runs after the previous one and writes the latest list,
// so out-of-order completion can never persist a stale list.
let writeChain: Promise<void> = Promise.resolve();

/**
 * Reads one stored entry, including those saved by builds before
 * device-bound sessions (switchExpiresAt / switchIssuedAt). null = unusable.
 */
function toSavedAccount(value: unknown): SavedAccount | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const expiresAt = typeof v.expiresAt === "string" ? v.expiresAt : v.switchExpiresAt;
  if (typeof v.userId !== "string" || typeof v.email !== "string" || typeof expiresAt !== "string") return null;
  const entry: Record<string, unknown> = { ...v, expiresAt };
  delete entry.switchExpiresAt;
  delete entry.switchIssuedAt;
  return entry as unknown as SavedAccount;
}

export function isAccountExpired(account: SavedAccount, nowMs: number = Date.now()): boolean {
  return account.expired || Date.parse(account.expiresAt) <= nowMs;
}

export function accountDisplayName(account: Pick<SavedAccount, "email" | "fullName">): string {
  if (account.fullName) return account.fullName;
  const local = account.email.split("@")[0] ?? account.email;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function removeLocalUserData(userId: string): void {
  useSavedBudgetPlanStore.getState().removeUser(userId);
  useSavedPhrasesStore.getState().removeUser(userId);
  useRecentPhrasesStore.getState().removeUser(userId);
  useSavedPlacesStore.getState().removeUser(userId);
  // Their saved read cache goes too — but never their outbox, which only the
  // owner may discard (specs/mobile-offline-support BR-OFF-09).
  void removeUserQueryCache(userId);
}

/** A switch token an older build left for the account: no longer needed. */
async function dropLegacySwitchToken(userId: string): Promise<void> {
  const legacy = await accountTokens.getLegacySwitchToken(userId);
  if (!legacy) return;
  await accountTokens.removeLegacySwitchToken(userId).catch(() => {});
  revokeSwitchTokenQuietly(legacy);
}

/**
 * The device's saved accounts (specs/mobile-account-switch). Device-local
 * state, not server data, so Zustand is right here; persisted by hand into
 * SecureStore (an index without secrets) rather than through zustand/persist.
 * Each account's session — its refresh token — is kept separately by
 * lib/account-tokens.ts, written by the session store on every sign-in and
 * renewal.
 *
 * Deliberately NOT touched by session-store.clear(): a session that ends on
 * its own keeps its account listed, marked "Hết phiên" (AC-22). Only logout
 * and remove take an account off the list.
 */
export const useAccountRegistryStore = create<AccountRegistryState>((set, get) => {
  const persistIndex = (): Promise<void> => {
    writeChain = writeChain
      .catch(() => {})
      .then(() => secureStorage.setItem(SECURE_STORE_ACCOUNTS_KEY, JSON.stringify(get().accounts)));
    return writeChain;
  };

  const patch = (userId: string, changes: Partial<SavedAccount>) => {
    if (!get().accounts.some((a) => a.userId === userId)) return;
    set((s) => ({ accounts: s.accounts.map((a) => (a.userId === userId ? { ...a, ...changes } : a)) }));
    persistIndex().catch(() => {});
  };

  return {
    accounts: [],
    isHydrated: false,

    async hydrate() {
      try {
        const raw = await secureStorage.getItem(SECURE_STORE_ACCOUNTS_KEY);
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        const accounts = Array.isArray(parsed)
          ? parsed.map(toSavedAccount).filter((a): a is SavedAccount => a !== null)
          : [];
        set({ accounts, isHydrated: true });
      } catch {
        set({ accounts: [], isHydrated: true });
      }
    },

    getToken: (userId) => accountTokens.get(userId),

    async upsert(user, { protectedUserIds }) {
      const token = await accountTokens.get(user.id);
      const expiresAt = tokenExpiresAt(token);
      if (!expiresAt) return;
      const nowIso = new Date().toISOString();
      const entry: SavedAccount = {
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        username: user.username ?? null,
        avatarUrl: user.avatar_url ?? null,
        role: user.role,
        expiresAt,
        lastUsedAt: nowIso,
        expired: false,
        switchInterrupted: false,
      };
      set((s) => ({ accounts: [entry, ...s.accounts.filter((a) => a.userId !== user.id)] }));

      const keep = new Set([user.id, ...protectedUserIds.filter((id): id is string => id !== null)]);
      const overflow = get().accounts.length - MAX_SAVED_ACCOUNTS;
      const evictable = get()
        .accounts.filter((a) => !keep.has(a.userId))
        .sort((a, b) => Date.parse(a.lastUsedAt) - Date.parse(b.lastUsedAt))
        .slice(0, Math.max(overflow, 0));
      for (const account of evictable) {
        await get().remove(account.userId, { endSession: true, dropLocalData: true });
      }
      await persistIndex();
      // The account now has a session here; a switch token from an older
      // build is dead weight.
      await dropLegacySwitchToken(user.id);
    },

    async remove(userId, { endSession, dropLocalData }) {
      const token = await accountTokens.get(userId);
      set((s) => ({ accounts: s.accounts.filter((a) => a.userId !== userId) }));
      await accountTokens.remove(userId).catch(() => {});
      await persistIndex().catch(() => {});
      await dropLegacySwitchToken(userId).catch(() => {});
      if (dropLocalData) removeLocalUserData(userId);
      if (endSession && token) logoutQuietly(token);
    },

    updateIdentity: (userId, { fullName, avatarUrl }) => patch(userId, { fullName, avatarUrl }),

    touch: (userId) =>
      patch(userId, { lastUsedAt: new Date().toISOString(), expired: false, switchInterrupted: false }),

    renewed(userId, refreshToken) {
      const expiresAt = tokenExpiresAt(refreshToken);
      const account = get().accounts.find((a) => a.userId === userId);
      if (!account || !expiresAt || (account.expiresAt === expiresAt && !account.expired)) return;
      patch(userId, { expiresAt, expired: false });
    },

    markExpired: (userId) => patch(userId, { expired: true, switchInterrupted: false }),

    setInterrupted: (userId, interrupted) => patch(userId, { switchInterrupted: interrupted }),

    expireOverdue() {
      const now = Date.now();
      const overdue = get().accounts.filter((a) => !a.expired && Date.parse(a.expiresAt) <= now);
      overdue.forEach((a) => patch(a.userId, { expired: true }));
    },
  };
});

// The session store reports what happens to each account's session without
// importing this store (see lib/session-events.ts).
onSessionRenewed((userId, refreshToken) => useAccountRegistryStore.getState().renewed(userId, refreshToken));

onSessionRefused((userId) => useAccountRegistryStore.getState().markExpired(userId));
