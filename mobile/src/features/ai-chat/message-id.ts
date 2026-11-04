import { ChatMessage } from "@/features/ai-chat/types";

// A per-session counter alone would collide with ids from a previous session,
// since the thread is persisted to disk — a fresh "msg_1" after a restart
// could match an already-stored message.
let idCounter = 0;

export function nextMessageId(): string {
  return `msg_${Date.now()}_${++idCounter}`;
}

// The two parts of an id: when it was created, then this app run's counter
// (which orders messages created in the same millisecond, a reply's fan-out).
const ID_PARTS = /^msg_(\d+)_(\d+)$/;

/**
 * The thread in the order its messages were written, read from their ids.
 *
 * ⚠️ The server's order cannot be trusted for this. A sync is written as one
 * batch, one transaction, so every message in it gets the same created_at,
 * and the tie falls back to a random row id: a question and its reply synced
 * together came back from a restore with the reply above the question. A
 * message whose id carries no time (from before ids did) keeps its place
 * after the one before it.
 */
export function inWrittenOrder(messages: ChatMessage[]): ChatMessage[] {
  let previous: [number, number] = [0, 0];
  const keyed = messages.map((message, index) => {
    const match = ID_PARTS.exec(message.id);
    const key: [number, number] = match ? [Number(match[1]), Number(match[2])] : previous;
    previous = key;
    return { message, key, index };
  });
  keyed.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.index - b.index);
  return keyed.map((entry) => entry.message);
}

/**
 * A hand-edited proposal never went through the AI service, so it needs its
 * own idempotency key, and the backend requires a real UUID. Lives in lib now
 * that the transaction form uses it too; re-exported for existing imports.
 */
export { newIdempotencyKey } from "@/lib/idempotency-key";
