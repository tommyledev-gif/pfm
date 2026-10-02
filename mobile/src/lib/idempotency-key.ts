/**
 * A fresh UUIDv4 for the backend's idempotency_key — one per create the user
 * means to make, so a double tap or a retried request lands on the same
 * transaction instead of a second one.
 *
 * Not crypto-grade, deliberately: this is a dedupe key, not a security token.
 * Security tokens in this project come from the backend's crypto/rand path.
 */
export function newIdempotencyKey(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
