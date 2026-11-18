import { ConsultMessageData } from "@/features/analytics/types";
import type { IntentionItemState } from "@/features/spending-intentions/types";
import type { TranslationKey } from "@/lib/i18n";
import { TransactionKind } from "@/lib/constants";
import {
  TransactionAdjustmentInput,
  TransactionItemInput,
  TransactionLocationInput,
  UpdateTransactionRequest,
} from "@/features/transactions/types";

// Mirrors backend/internal/dto/chat_{request,response}.go — POST /ai/chat.
export interface ChatRequest {
  message: string;
  conversation_id?: string;
}

export interface TransactionActionPayload {
  // null only when the User owns no VND Wallet — such a proposal must be
  // edited onto a VND Wallet before it can be saved (proposal-wallet.ts).
  wallet_id: string | null;
  // For a transfer this is whatever category it had before the User made it
  // one — kept for switching back, never sent or shown: the server files a
  // transfer under its own system category. A transfer the AI proposed itself
  // carries the nil UUID; switching it to income/expense picks a real one
  // (EditTransactionModal resets a category not in the list).
  category_id: string;
  amount: number;
  // "transfer" when the message moves money between two of the User's own
  // wallets ("chuyển 2tr từ VCB sang MoMo"), or after the User edits a
  // proposal into one (EditTransactionModal).
  type: TransactionKind;
  // A transfer's destination Wallet. Null when the AI could not tell which
  // of the User's wallets it goes to: saving then opens the edit form to pick
  // one (isSavableProposal). Absent or null on income/expense.
  to_wallet_id?: string | null;
  note: string | null;
  occurred_at: string;
  // One purchase listed line by line (specs/transaction-line-items); amount
  // is their sum, after any adjustments. Forwarded unchanged when the
  // proposal is saved. The AI only ever proposes items; adjustments (tax,
  // fee, discount) come from the User editing the proposal.
  items?: TransactionItemInput[];
  adjustments?: TransactionAdjustmentInput[];
  // Where it was pinned, set by the User in the edit form — the AI never
  // proposes one. Sent with the create on confirm (spread into POST
  // /transactions); after that the pin can be moved and re-noted, never
  // added or removed. Absent on proposals from before locations existed.
  location?: TransactionLocationInput;
}

// What editing an already-saved proposal adds to its PATCH besides the
// payload's own fields — each part only when it changed: the wallet it moves
// to, the type it changes to (with a new transfer's destination), the moved
// pin, the pin's note.
export type SavedProposalPatch = Pick<
  UpdateTransactionRequest,
  "wallet_id" | "type" | "to_wallet_id" | "location" | "location_note"
>;

export interface ChatAction {
  type: "create_transaction";
  payload: TransactionActionPayload;
  idempotency_key: string;
  confidence: number;
  // Image proposals only (specs/ai-chat-image-capture). Kept beside the
  // payload, never inside it: the payload is what a confirm sends.
  // Lines read with doubt, by index into payload.items / payload.adjustments
  // as received — turned into content keys on arrival (line-review.ts).
  review_lines?: ProposalReviewLines;
  // The latest saved Transaction this proposal looks like (same Wallet, type,
  // amount, day). A warning; cleared when the User edits the card (BR-17).
  possible_duplicate?: ProposalDuplicate;
}

export interface ProposalReviewLines {
  items: number[];
  adjustments: number[];
}

export interface ProposalDuplicate {
  amount: number;
  occurred_at: string;
}

// Mirrors backend/internal/dto/chat_image_response.go —
// POST /transactions/image-proposals.
export interface ImageProposalsResponse {
  message: string;
  intent: "create_transaction" | "ambiguous";
  actions: ChatAction[];
  truncated: boolean;
  skipped_count: number;
}

// The photo behind a user's image message. localUri lives on this device
// only and is stripped before the thread syncs (AC-23).
export interface ImageCapture {
  localUri?: string;
  caption?: string;
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
  // On a reply the app writes itself (a failure, "no wallet yet"): the copy
  // as a locale key + params, so the bubble follows a language switch
  // (specs/mobile-language-switch BR-10). `text` still holds it in the
  // language it was written in, for search and for older app versions.
  // Absent on messages from before; message-text.ts reads both.
  textKey?: TranslationKey;
  textParams?: Record<string, string | number>;
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
  // Set client-side (reply-fanout.ts) on the backend's "create a wallet
  // first" reply — renders a button that opens the new-wallet form, and the
  // reply's text is the app's own copy rather than the backend's.
  offerCreateWallet?: boolean;
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
  // specs/ai-chat-image-capture. On the user's image message: its photo.
  // Never text-editable (AC-27).
  imageCapture?: ImageCapture;
  // On a proposal read from an image: shows the low-confidence label when the
  // confidence is low (BR-09).
  imageOrigin?: boolean;
  // Content keys (line-review.ts) of the lines marked "Cần kiểm tra" (BR-16).
  reviewLineKeys?: string[];
  // On a failed image reply: the image message to re-send on retry (EC-11, EC-20).
  retryImageMessageId?: string;
  // On a failed text reply: the message to send again on retry, so a dropped
  // request never has to be retyped. Cleared once the retry starts.
  retryText?: string;
  // On an analysis reply of kind "intention" (specs/ai-chat-spending-intentions):
  // what became of each proposal, by position (IntentionItemState).
  intentionStates?: IntentionItemState[];
  // The User deleted this failure reply (failure-reply.ts isFailureReply). It
  // stays in the store, so the deletion syncs with the thread instead of the
  // server copy bringing the bubble back on another device, but is never drawn.
  dismissed?: boolean;
}
