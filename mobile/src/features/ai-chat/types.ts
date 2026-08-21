import { TransactionType } from "@/lib/constants";

// Mirrors backend/internal/dto/chat_{request,response}.go — POST /ai/chat.
export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface TransactionActionPayload {
  wallet_id: string;
  category_id: string;
  amount: number;
  type: TransactionType;
  note: string | null;
  occurred_at: string;
}

export interface ChatAction {
  type: "create_transaction";
  payload: TransactionActionPayload;
  idempotency_key: string;
  confidence: number;
}

export interface ChatResponse {
  message: string;
  intent: "create_transaction" | "ambiguous";
  actions: ChatAction[];
  conversation_id: string;
}

// Client-only chat thread state — there is no chat-history GET endpoint.
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: ChatAction;
  confirmed?: boolean;
  // Edits never mutate a message that already has a resolved action in
  // place — they append a corrected message at the end of the thread
  // instead, so the original stays as an honest record of what the AI (or
  // the user) actually said at the time.
  edited?: boolean; // this message is the corrected result of editing an earlier one
  superseded?: boolean; // an edited replacement for this message now exists further down the thread
  // Copied from ChatResponse.intent for an assistant reply with no action —
  // the now-rare true clarifying question (missing amount / not a
  // transaction at all), as opposed to a normal reply. Used to stop
  // long-press-to-edit from opening on the AI's own question text (there's
  // nothing for the user to "correct" in a question), while leaving actual
  // transaction proposals — always editable via EditTransactionModal — and
  // user messages untouched.
  intent?: "ambiguous";
  // Set client-side (never from the backend) when requestAssistantReply
  // catches a RATE_LIMITED or AI_SERVICE_UNAVAILABLE error — renders an
  // inline "create manually" button on this message instead of just an
  // error string, since the user was already mid-flow trying to log
  // something.
  offerManualEntry?: boolean;
}
