// A per-session counter alone would collide with ids from a previous session,
// since the thread is persisted to disk — a fresh "msg_1" after a restart
// could match an already-stored message.
let idCounter = 0;

export function nextMessageId(): string {
  return `msg_${Date.now()}_${++idCounter}`;
}

/**
 * A hand-edited proposal never went through the AI service, so it needs its
 * own idempotency key, and the backend requires a real UUID. Lives in lib now
 * that the transaction form uses it too; re-exported for existing imports.
 */
export { newIdempotencyKey } from "@/lib/idempotency-key";
