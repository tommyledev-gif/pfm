import { create } from "zustand";

import {
  MAX_SAVED_ACCOUNTS,
  SECURE_STORE_ACCOUNTS_KEY,
  SECURE_STORE_SWITCH_TOKEN_KEY_PREFIX,
} from "@/lib/constants";
import { removeUserQueryCache } from "@/lib/query-persistence/user-cache-persister";
import { secureStorage } from "@/lib/secure-storage";
import { useSavedBudgetPlanStore } from "@/features/budget-wizard/saved-plan";
import { useRecentPhrasesStore } from "@/stores/recent-phrases-store";
import { useSavedPhrasesStore } from "@/stores/saved-phrases-store";
import { revokeSwitchTokenQuietly } from "@/features/accounts/api/account-switch-requests";
import { IssuedSwitchToken, SavedAccount } from "@/features/accounts/types";
import { User } from "@/features/users/types";

interface RemoveOptions {
  /** Ask the server to revoke the token (false when logout already did). */
  revoke: boolean;
  /** Delete the User's local-only data (plan, phrases) — US-04, not logout. */
  dropLocalData: boolean;
}

interface UpsertOptions {
  /** Never evicted by this upsert (the incoming and the outgoing active User). */
  protectedUserIds: (string | null)[];
  /** Revoke the token this one replaces — false when it is already dead (US-08). */
  revokePrevious: boolean;
}

interface AccountRegistryState {
  accounts: SavedAccount[];
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  getToken: (userId: string) => Promise<string | null>;
  /** Adds or refreshes a User with a fresh switch token (BR-01/02, AC-02/03). */
  upsert: (user: User, issued: IssuedSwitchToken, options: UpsertOptions) => Promise<void>;
  remove: (userId: string, options: RemoveOptions) => Promise<void>;
  /** Keeps a saved account's name and picture in step with the profile. */
  updateIdentity: (userId: string, identity: { fullName: string | null; avatarUrl: string | null }) => void;
  markExpired: (userId: string) => void;
  setInterrupted: (userId: string, interrupted: boolean) => void;
  /** Marks every account whose token is past its expiry (device clock). */
  expireOverdue: () => void;
}

const tokenKey = (userId: string) => `${SECURE_STORE_SWITCH_TOKEN_KEY_PREFIX}${userId}`;

// Every index write runs after the previous one and writes the latest list,
// so out-of-order completion can never persist a stale list.
let writeChain: Promise<void> = Promise.resolve();

function isSavedAccount(value: unknown): value is SavedAccount {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.userId === "string" && typeof v.email === "string" && typeof v.switchExpiresAt === "string";
}

export function isAccountExpired(account: SavedAccount, nowMs: number = Date.now()): boolean {
  return account.expired || Date.parse(account.switchExpiresAt) <= nowMs;
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
  // Their saved read cache goes too — but never their outbox, which only the
  // owner may discard (specs/mobile-offline-support BR-OFF-09).
  void removeUserQueryCache(userId);
}

/**
 * The device's saved accounts (specs/mobile-account-switch). Device-local
 * state, not server data, so Zustand is right here; persisted by hand into
 * SecureStore (index without secrets + one key per token) rather than through
 * zustand/persist, because a listed account without a stored token would be
 * a dead row (EC-02): the token is written first, the index only after.
 *
 * Deliberately NOT touched by session-store.clear(): a session that ends on
 * its own keeps its account listed (AC-22). Only logout and remove do.
 */
export const useAccountRegistryStore = create<AccountRegistryState>((set, get) => {
  const persistIndex = (): Promise<void> => {
    writeChain = writeChain
      .catch(() => {})
      .then(() => secureStorage.setItem(SECURE_STORE_ACCOUNTS_KEY, JSON.stringify(get().accounts)));
    return writeChain;
  };

  const patch = (userId: string, changes: Partial<SavedAccount>) => {
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
        const accounts = Array.isArray(parsed) ? parsed.filter(isSavedAccount) : [];
        set({ accounts, isHydrated: true });
      } catch {
        set({ accounts: [], isHydrated: true });
      }
    },

    getToken: (userId) => secureStorage.getItem(tokenKey(userId)),

    async upsert(user, issued, { protectedUserIds, revokePrevious }) {
      const previousToken = await get().getToken(user.id);
      await secureStorage.setItem(tokenKey(user.id), issued.token);
      const nowIso = new Date().toISOString();
      const entry: SavedAccount = {
        userId: user.id,
        email: user.email,
        fullName: user.full_name,
        username: user.username ?? null,
        avatarUrl: user.avatar_url ?? null,
        role: user.role,
        switchIssuedAt: nowIso,
        switchExpiresAt: issued.expiresAt,
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
        await get().remove(account.userId, { revoke: true, dropLocalData: true });
      }
      await persistIndex();

      if (revokePrevious && previousToken && previousToken !== issued.token) {
        revokeSwitchTokenQuietly(previousToken);
      }
    },

    async remove(userId, { revoke, dropLocalData }) {
      const token = await get().getToken(userId);
      set((s) => ({ accounts: s.accounts.filter((a) => a.userId !== userId) }));
      await secureStorage.removeItem(tokenKey(userId)).catch(() => {});
      await persistIndex().catch(() => {});
      if (dropLocalData) removeLocalUserData(userId);
      if (revoke && token) revokeSwitchTokenQuietly(token);
    },

    updateIdentity: (userId, { fullName, avatarUrl }) => patch(userId, { fullName, avatarUrl }),

    markExpired: (userId) => patch(userId, { expired: true, switchInterrupted: false }),

    setInterrupted: (userId, interrupted) => patch(userId, { switchInterrupted: interrupted }),

    expireOverdue() {
      const now = Date.now();
      const overdue = get().accounts.filter((a) => !a.expired && Date.parse(a.switchExpiresAt) <= now);
      overdue.forEach((a) => patch(a.userId, { expired: true }));
    },
  };
});
