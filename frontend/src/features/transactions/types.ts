import type { TransactionType } from "@/lib/constants";

export interface Transaction {
  id: string;
  wallet_id: string;
  wallet_name: string;
  category_id: string;
  category_name: string;
  amount: number;
  type: TransactionType;
  note: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  // Only ever present on the mutating endpoints (create/update) — never on
  // GET (spec.md Response Shape). Backend: dto.TransactionResponse.
  wallet_balance?: number;
  // Where the mobile app pinned it when created; null when it was not.
  location: TransactionLocation | null;
}

// Mirrors the `location` object of backend dto.TransactionResponse.
// Coordinates are degrees, not money — plain numbers are fine here.
export interface TransactionLocation {
  latitude: number;
  longitude: number;
  // Reverse-geocoded area, e.g. "Quận 1, TP. Hồ Chí Minh"; null when pinned offline.
  place_name: string | null;
  note: string | null;
}

export interface ListTransactionsResult {
  data: Transaction[];
  next_cursor: string | null;
  // Rows matching the request's filters in full — present on the first page
  // only, null on any cursor-fetched page (the figure can't change while
  // paging through the same filters). Backend: dto.ListTransactionsResponse.
  total: number | null;
}

export interface CreateTransactionRequest {
  wallet_id: string;
  category_id: string;
  amount: number;
  type: TransactionType;
  occurred_at?: string;
  note?: string;
  // Optional, general-purpose (specs/ai-chat-assistant/spec.md Resolved
  // design decision #5) — omitted by the manual "Add transaction" dialog
  // (unchanged 201-every-time behavior); supplied by the AI Chat confirm
  // flow. Reusing a previously-used key returns the original Transaction
  // (200) instead of creating a duplicate.
  idempotency_key?: string;
}

export interface UpdateTransactionRequest {
  amount?: number;
  category_id?: string;
  // Changes what the Transaction is (2026-11-05): becoming income/expense
  // needs a category_id of that type, becoming a transfer needs to_wallet_id
  // (and drops any items). Backend: dto.UpdateTransactionRequest.Type.
  type?: TransactionType;
  // A new transfer's destination; a transfer's own never moves.
  to_wallet_id?: string;
  // Moves an income/expense to another wallet in the same currency; the old
  // wallet gets its effect back and the new one takes it. 422
  // WALLET_CURRENCY_MISMATCH / TRANSFER_WALLET_IMMUTABLE otherwise. Backend:
  // dto.UpdateTransactionRequest.WalletID.
  wallet_id?: string;
  occurred_at?: string;
  note?: string;
  // Moves a pin the Transaction already has (400 INVALID_INPUT when it has
  // none — a pin can't be added after creation). place_name is the new
  // position's area name; omitted/null/"" stores null. Never carries a note —
  // the pin's note is not changed by this field. Backend:
  // dto.TransactionLocationMoveRequest.
  location?: TransactionLocationMove;
}

export interface TransactionLocationMove {
  latitude: number;
  longitude: number;
  place_name?: string | null;
}

// Client-side filter state driving GET /transactions' query params —
// mirrors dto.ListTransactionsQuery.
export interface TransactionFilters {
  walletId?: string;
  categoryId?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
}
