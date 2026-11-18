import type { TranslationKey } from "@/lib/i18n";
import { ChatMessage } from "@/features/ai-chat/types";

// Replies the app writes when a request did not produce what the User asked
// for: stored as keys (message-text.ts), so a bubble is told apart by what it
// says, not by a flag. The same reasoning as edit-lock.ts: a thread already on
// devices and on the server predates any flag added now.
const FAILURE_TEXT_KEYS: ReadonlySet<TranslationKey> = new Set<TranslationKey>([
  "chat.reply.failed",
  "chat.reply.busy",
  "chat.consult.error",
  "chat.consult.limitReached",
  "errors.network",
  "chat.image.reply.readingOff",
  "chat.image.reply.busy",
  "chat.image.reply.limitReached",
  "chat.image.reply.unavailable",
  "chat.image.reply.tooLarge",
  "chat.image.reply.wrongType",
]);

// The analysis replies that are an apology, not an answer: the backend's own
// "could not read it" and "do not understand" lines.
const FAILURE_CONSULT_KINDS: ReadonlySet<string> = new Set(["degraded", "unsupported", "needs_context"]);

/**
 * Whether this message is the assistant saying a request failed or could not
 * be understood: nothing the User keeps, so it can be deleted.
 *
 * Never a proposal, an answer or anything the User wrote.
 */
export function isFailureReply(message: ChatMessage): boolean {
  if (message.role !== "assistant" || message.action || message.actionType) return false;
  if (message.consult) return FAILURE_CONSULT_KINDS.has(message.consult.kind);
  if (message.textKey && FAILURE_TEXT_KEYS.has(message.textKey)) return true;
  // Written before replies were stored as keys: still carrying a way out of the failure.
  return Boolean(message.retryText || message.retryImageMessageId || message.offerManualEntry);
}

/** Messages the thread shows: a deleted failure reply is kept in the store (so it stays deleted after a sync) but never drawn. */
export function isShown(message: ChatMessage): boolean {
  return !message.dismissed;
}
