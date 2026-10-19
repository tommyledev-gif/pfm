import { SECURE_STORE_ACCOUNT_REFRESH_KEY_PREFIX, SECURE_STORE_SWITCH_TOKEN_KEY_PREFIX } from "@/lib/constants";
import { secureStorage } from "@/lib/secure-storage";

/**
 * Each saved account's own session on this device, as its refresh token —
 * one SecureStore key per account (specs/mobile-account-switch, 2026-10-19
 * revision: a saved account is a device-bound session, and switching to it is
 * a refresh of that session).
 *
 * The active account's key is written on every renewal too, not only when
 * the User switches away: the token kept here must always be the newest one
 * the server issued for that account, or the next switch back presents the
 * previous one, which the server reads as a stolen copy and ends the session.
 *
 * Plain module, no store imports: session-store.ts writes here and must not
 * depend on the account registry (which depends on apiClient, which depends
 * on session-store).
 */
const refreshKey = (userId: string) => `${SECURE_STORE_ACCOUNT_REFRESH_KEY_PREFIX}${userId}`;
const legacyKey = (userId: string) => `${SECURE_STORE_SWITCH_TOKEN_KEY_PREFIX}${userId}`;

// Writes to one account's key run one at a time, so a compare-and-set can
// never interleave with another write to the same key.
const chains = new Map<string, Promise<unknown>>();

function serialize<T>(userId: string, op: () => Promise<T>): Promise<T> {
  const run = (chains.get(userId) ?? Promise.resolve()).then(op, op);
  chains.set(
    userId,
    run.catch(() => {}),
  );
  return run;
}

export const accountTokens = {
  get(userId: string): Promise<string | null> {
    return secureStorage.getItem(refreshKey(userId));
  },

  set(userId: string, refreshToken: string): Promise<void> {
    return serialize(userId, () => secureStorage.setItem(refreshKey(userId), refreshToken));
  },

  /**
   * Stores `next` only while the key still holds `expected` — the token the
   * renewal was made with. False when something else replaced or removed it
   * meanwhile (a new sign-in, a removal), which then wins.
   */
  replace(userId: string, expected: string, next: string): Promise<boolean> {
    return serialize(userId, async () => {
      if ((await secureStorage.getItem(refreshKey(userId))) !== expected) return false;
      await secureStorage.setItem(refreshKey(userId), next);
      return true;
    });
  },

  remove(userId: string): Promise<void> {
    return serialize(userId, () => secureStorage.removeItem(refreshKey(userId)));
  },

  /**
   * Removes the token only if it is still `expected` (the one the server
   * refused). False when the account has a newer one by now — a password
   * change or a new sign-in replaced it — which still works.
   */
  removeIf(userId: string, expected: string): Promise<boolean> {
    return serialize(userId, async () => {
      if ((await secureStorage.getItem(refreshKey(userId))) !== expected) return false;
      await secureStorage.removeItem(refreshKey(userId));
      return true;
    });
  },

  /** A switch token an older build saved for this account, if one is left. */
  getLegacySwitchToken(userId: string): Promise<string | null> {
    return secureStorage.getItem(legacyKey(userId));
  },

  removeLegacySwitchToken(userId: string): Promise<void> {
    return secureStorage.removeItem(legacyKey(userId));
  },
};
