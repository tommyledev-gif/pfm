import { ChatMessage } from "@/features/ai-chat/types";

export type TombstoneKind = "deleted" | "discarded";

/**
 * Whether this message stands for a proposal that has been removed.
 *
 * A tombstone still occupies its original place in the thread and keeps its
 * edit history; what it loses is every affordance that would act on it.
 */
export function isTombstone(message: ChatMessage): boolean {
  return message.removalState !== undefined;
}

export function tombstoneKind(message: ChatMessage): TombstoneKind | null {
  return message.removalState ?? null;
}

/**
 * Whether removing this proposal has to go through the server.
 *
 * ⚠️ The distinction is not cosmetic. A confirmed proposal has a real
 * Transaction behind it and must be soft-deleted through the API; an
 * unconfirmed one was never written anywhere, so issuing a delete for it would
 * be a request against an id the server has never seen.
 */
export function hasPersistedTransaction(message: ChatMessage): boolean {
  return Boolean(message.confirmed && message.transactionId);
}

/** Whether a delete affordance belongs on this message at all. */
export function isRemovable(message: ChatMessage): boolean {
  return message.role === "assistant" && Boolean(message.action) && !isTombstone(message);
}
