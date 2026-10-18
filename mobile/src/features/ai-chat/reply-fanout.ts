import { nextMessageId } from "@/features/ai-chat/message-id";
import { toReviewLineKeys } from "@/features/ai-chat/line-review";
import { ChatAction, ChatMessage, ChatResponse, ImageProposalsResponse } from "@/features/ai-chat/types";

interface ReplyFanoutOptions {
  /** The user's own words that produced this reply — kept on every card so a
   *  confirm can record it as a recent phrase (de-duplicated by the store). */
  sourceText?: string;
  edited?: boolean;
  /** The User's wallet list has loaded and is empty. */
  noWallets?: boolean;
  /** The reply was read from a photo (specs/ai-chat-image-capture): its cards
   *  carry the low-confidence label and the line marks. Never a sourceText. */
  imageOrigin?: boolean;
}

const NO_WALLET_REPLY = "Chưa có ví. Tạo ví để ghi giao dịch.";

/**
 * Turns one assistant reply into thread messages: one card per proposal, in
 * the order returned, so no proposal is ever dropped (spec BR-14, AC-36).
 *
 * A reply with zero or one proposal stays a single message, exactly as before
 * (AC-40). With two or more, the lead-in is its own text-only message and
 * each proposal follows as its own card, so confirm / edit / discard /
 * swipe-delete keep acting on one proposal at a time (AC-37).
 */
export function toReplyMessages(
  reply: ChatResponse | ImageProposalsResponse,
  { sourceText, edited, noWallets, imageOrigin }: ReplyFanoutOptions,
): ChatMessage[] {
  // With zero wallets the backend never reaches the AI: it always answers
  // with an "ambiguous" reply telling the User to create a wallet
  // (chat_service.go). That reply gets the app's own copy plus a button that
  // opens the new-wallet form, instead of a sentence that is a dead end.
  if (noWallets && reply.intent === "ambiguous" && reply.actions.length === 0) {
    return [
      {
        id: nextMessageId(),
        role: "assistant",
        text: NO_WALLET_REPLY,
        intent: "ambiguous",
        offerCreateWallet: true,
        edited,
        sourceText,
      },
    ];
  }

  const leadIn: ChatMessage = {
    id: nextMessageId(),
    role: "assistant",
    text: reply.message,
    intent: reply.intent === "ambiguous" ? "ambiguous" : undefined,
    actionType: "action_type" in reply ? reply.action_type : undefined,
    edited,
    sourceText,
  };

  if (reply.actions.length <= 1) {
    const action = reply.actions[0];
    return [action ? { ...leadIn, ...cardFields(action, imageOrigin) } : leadIn];
  }

  return [
    leadIn,
    ...reply.actions.map((action) => ({
      id: nextMessageId(),
      role: "assistant" as const,
      text: "",
      edited,
      sourceText,
      ...cardFields(action, imageOrigin),
    })),
  ];
}

function cardFields(action: ChatAction, imageOrigin?: boolean): Pick<ChatMessage, "action" | "editHistory" | "imageOrigin" | "reviewLineKeys"> {
  const fields = { action, editHistory: [{ payload: action.payload, timestamp: Date.now(), source: "created" as const }] };
  if (!imageOrigin) return fields;
  return { ...fields, imageOrigin, reviewLineKeys: toReviewLineKeys(action.payload, action.review_lines) };
}
