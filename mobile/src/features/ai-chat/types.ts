import { ConsultMessageData } from "@/features/analytics/types";
import { TransactionType } from "@/lib/constants";

// Mirrors backend/internal/dto/chat_{request,response}.go — POST /ai/chat.
export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface TransactionActionPayload {
  // null only when the User owns no VND Wallet — such a proposal must be
  // edited onto a VND Wallet before it can be saved (proposal-wallet.ts).
  wallet_id: string | null;
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
  intent: "create_transaction" | "ambiguous" | "budget_wizard";
  actions: ChatAction[];
  conversation_id: string;
  // Set only when intent === "budget_wizard" (specs/ai-budget-wizard/spec.md
  // US-02) — the client renders a tappable BudgetWizardCard instead of the
  // usual Transaction action cards.
  action_type?: "budget_wizard";
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
  // The real backend Transaction id, set once `confirmed` becomes true
  // (ai-chat.tsx's confirmAction). Editing a confirmed proposal PATCHes this
  // id in place (ai-chat.tsx's editAction) — it must never spawn a second
  // POST /transactions call, which would silently create a duplicate
  // transaction while leaving the original one orphaned.
  transactionId?: string;
  // Every edit — whether the proposal is still unconfirmed or already
  // confirmed — mutates this same message in place; editHistory below
  // records the trail. There is no more "corrective message" chain: editing
  // an already-confirmed proposal PATCHes the real transaction instead of
  // creating a new message/transaction (see ai-chat.tsx's editAction).
  edited?: boolean; // this message has been edited at least once
  superseded?: boolean; // editUserMessage marked this stale reply's card hidden after its user message was corrected
  // Full snapshot trail for this proposal, oldest first (rendered newest
  // first by EditHistoryDialog). Seeded with a "created" entry when the
  // action message is first added; every edit appends an "edited" entry.
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
  // specs/ai-budget-wizard/spec.md US-02 — set on an assistant reply carrying
  // action_type: "budget_wizard"; renders BudgetWizardCard instead of a plain
  // bubble. budgetWizardSubmitted/budgetWizardCreatedCount are client-side
  // state only (US-02 Edge Cases #2, never persisted) — a reopened app
  // always shows the card as tappable again.
  actionType?: "budget_wizard";
  budgetWizardSubmitted?: boolean;
  budgetWizardCreatedCount?: number;
  // Set when this proposal has been removed. The message itself is NEVER
  // deleted from the thread — the thread is the user's record of what they
  // asked for, and quietly dropping entries from it is how "what happened to
  // that transaction?" becomes unanswerable.
  //
  // "deleted" means a real Transaction existed and was soft-deleted server
  // side, so its history is readable via the audit log. "discarded" means the
  // proposal was never confirmed, so no Transaction ever existed and there is
  // nothing server side to read — the local trail below is all there is.
  //
  // ⚠️ Both optional: messages persisted before this existed must keep
  // deserializing. See features/ai-chat/tombstone.ts.
  removalState?: "deleted" | "discarded";
  /** ISO-8601 UTC. Displayed in device-local time. */
  removedAt?: string;
  // specs/ai-chat-query-spending — an analysis reply, stored as received and
  // redrawn from this snapshot on restore, never recomputed (US-06).
  consult?: ConsultMessageData;
  // A user message sent in analysis mode (or a tapped chip). Marked so the
  // edit path never re-sends it as a transaction description.
  consultQuestion?: boolean;
  // On an assistant reply: the exact (trimmed) user message that produced it.
  // Client-only, carried in the synced payload as-is. Lets "Switch to
  // recording" carry the question over, and lets a confirmed proposal's
  // wording become a recent phrase. Absent on replies from older versions.
  sourceText?: string;
}
