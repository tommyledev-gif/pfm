// A per-session counter alone would collide with ids from a previous session,
// since the thread is persisted to disk — a fresh "msg_1" after a restart
// could match an already-stored message.
let idCounter = 0;

export function nextMessageId(): string {
  return `msg_${Date.now()}_${++idCounter}`;
}

/**
 * A hand-edited proposal never went through the AI service, so it needs its
 * own idempotency key, and the backend requires a real UUID.
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
