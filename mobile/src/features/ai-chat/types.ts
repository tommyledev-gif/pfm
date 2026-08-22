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

// One snapshot of a transaction proposal's fields at a point in time —
// logged from the moment an action message is created (source: "created")
// and again on every edit (source: "edited"), so every transaction the AI
// proposes carries a full, traceable history regardless of which edit path
// touched it. Viewed via the "Đã sửa" badge's history dialog.
export interface EditHistoryEntry {
  payload: TransactionActionPayload;
  timestamp: number;
  source: "created" | "edited";
}

// Client-only chat thread state — there is no chat-history GET endpoint.
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  action?: ChatAction;
  confirmed?: boolean;
  // An unconfirmed proposal is mutated in place on edit (nothing is saved
  // yet, so nothing else needs to change) — editHistory below is what
  // records that trail. Only a proposal that was already confirmed (a real
  // transaction already exists) gets a new corrective message appended
  // instead, since the saved record can't be mutated this way; that new
  // message carries originalMessageId pointing back at the root proposal it
  // corrects, and the root's card stops rendering (see ai-chat.tsx) in favor
  // of this one.
  edited?: boolean; // this message has been edited at least once (in place or via a correction chain)
  superseded?: boolean; // a corrective replacement for this message now exists further down the thread — its card is hidden
  // Only set on a corrective message (the confirmed-original-edit path).
  // Points at the root message of the correction chain — "Go to original"
  // scrolls/highlights that message.
  originalMessageId?: string;
  // Full snapshot trail for this proposal, oldest first. Seeded with a
  // "created" entry when the action message is first added; every edit
  // (in place or corrective) appends an "edited" entry, carried forward
  // across a correction chain so the trail is never lost.
  editHistory?: EditHistoryEntry[];
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
