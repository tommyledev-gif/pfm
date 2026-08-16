import type { TransactionType } from "@/lib/constants";

export interface TransactionActionPayload {
  wallet_id: string;
  category_id: string;
  amount: number;
  type: TransactionType;
  note: string | null;
  occurred_at: string;
}

// idempotency_key is pre-generated server-side (specs/ai-chat-assistant/spec.md
// Edge Case #2) — the client only ever forwards it, never generates its own.
export interface ChatAction {
  type: "create_transaction";
  payload: TransactionActionPayload;
  idempotency_key: string;
  confidence: number;
}

export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface ChatResponse {
  message: string;
  intent: "create_transaction" | "ambiguous";
  actions: ChatAction[];
  conversation_id: string;
}

// The visible thread is client-only state (useState/useReducer), not
// TanStack Query cache — there is no GET /ai/chat/history in this cut's
// scope, so there is no fetchable resource to mirror
// (specs/ai-chat-assistant/plan.md Architecture note). Each ChatAction's own
// confirm/cancel state lives inside its ConfirmationCard instance (driven by
// its own useCreateTransactionMutation), not lifted up here — every action
// already has a unique idempotency_key, so there is nothing to coordinate
// across cards.
export type ChatThreadItem =
  | { kind: "user"; id: string; content: string }
  | { kind: "assistant"; id: string; content: string; actions: ChatAction[] }
  | { kind: "error"; id: string; message: string };
