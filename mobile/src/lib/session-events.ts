/**
 * What happened to an account's session on this device, told by the session
 * store to whoever keeps the saved-accounts list — without session-store.ts
 * importing it (the registry imports apiClient, which imports the session
 * store).
 *
 *  - renewed: the account has a fresh refresh token (sign-in, renewal, switch).
 *  - refused: the server refused the account's refresh token — expired,
 *    signed out from another device, password changed. The account needs
 *    signing in again on this device; other accounts are untouched.
 */
type RenewedListener = (userId: string, refreshToken: string) => void;
type RefusedListener = (userId: string) => void;

const renewedListeners = new Set<RenewedListener>();
const refusedListeners = new Set<RefusedListener>();

export function onSessionRenewed(listener: RenewedListener): () => void {
  renewedListeners.add(listener);
  return () => renewedListeners.delete(listener);
}

export function onSessionRefused(listener: RefusedListener): () => void {
  refusedListeners.add(listener);
  return () => refusedListeners.delete(listener);
}

export function emitSessionRenewed(userId: string, refreshToken: string): void {
  renewedListeners.forEach((listener) => listener(userId, refreshToken));
}

export function emitSessionRefused(userId: string): void {
  refusedListeners.forEach((listener) => listener(userId));
}
