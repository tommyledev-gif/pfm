import { nextMessageId } from "@/features/ai-chat/message-id";
import { ChatAction, ChatMessage, ChatResponse } from "@/features/ai-chat/types";

interface ReplyFanoutOptions {
  /** The user's own words that produced this reply — kept on every card so a
   *  confirm can record it as a recent phrase (de-duplicated by the store). */
  sourceText?: string;
  edited?: boolean;
}

/**
 * Turns one assistant reply into thread messages: one card per proposal, in
 * the order returned, so no proposal is ever dropped (spec BR-14, AC-36).
 *
 * A reply with zero or one proposal stays a single message, exactly as before
 * (AC-40). With two or more, the lead-in is its own text-only message and
 * each proposal follows as its own card, so confirm / edit / discard /
 * swipe-delete keep acting on one proposal at a time (AC-37).
 */
export function toReplyMessages(reply: ChatResponse, { sourceText, edited }: ReplyFanoutOptions): ChatMessage[] {
  const leadIn: ChatMessage = {
    id: nextMessageId(),
    role: "assistant",
    text: reply.message,
    intent: reply.intent === "ambiguous" ? "ambiguous" : undefined,
    actionType: reply.action_type,
    edited,
    sourceText,
  };

  if (reply.actions.length <= 1) {
    const action = reply.actions[0];
    return [action ? { ...leadIn, ...cardFields(action) } : leadIn];
  }

  return [
    leadIn,
    ...reply.actions.map((action) => ({
      id: nextMessageId(),
      role: "assistant" as const,
      text: "",
      edited,
      sourceText,
      ...cardFields(action),
    })),
  ];
}

function cardFields(action: ChatAction): Pick<ChatMessage, "action" | "editHistory"> {
  return { action, editHistory: [{ payload: action.payload, timestamp: Date.now(), source: "created" }] };
}
