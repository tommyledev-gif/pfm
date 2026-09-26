import { ChatMessage } from "@/features/ai-chat/types";

/**
 * Which pane a stored message belongs to. Both conversations share one
 * persisted, synced thread (chat-store.ts) — splitting storage would need a
 * migration of every thread already on devices and on the server — and each
 * pane shows only its own messages.
 */
export function isConsultMessage(message: ChatMessage): boolean {
  return message.consult !== undefined || message.consultQuestion === true;
}
