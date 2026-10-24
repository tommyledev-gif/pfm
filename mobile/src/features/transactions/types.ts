import { TransactionKind, TransactionType } from "@/lib/constants";

// Mirrors backend/internal/dto/transaction_response.go /
// frontend/src/features/transactions/types.ts.
export interface Transaction {
  id: string;
  wallet_id: string;
  wallet_name: string;
  category_id: string;
  category_name: string;
  amount: number; // integer cents, always positive
  type: TransactionKind;
  note: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  wallet_balance?: number; // only present on create/update responses
  // A transfer's destination; null for income/expense. wallet_id/wallet_name
  // are then the SOURCE wallet.
  to_wallet_id: string | null;
  to_wallet_name: string | null;
  // Where it was pinned when created; null when it was not. Optional only
  // because a copy saved on the device before locations existed has no such
  // field — the server always sends it.
  location?: TransactionLocation | null;
  // Item count on every row (0 when none). items/adjustments only come with a
  // single-Transaction response (GET /:id, create, update) — never on list
  // rows (specs/transaction-line-items plan F4). Optional because copies
  // cached before this feature have none of the three.
  item_count?: number;
  items?: TransactionItem[];
  adjustments?: TransactionAdjustment[];
  // Who recorded it, only on a shared wallet's list and only when that was
  // someone else (specs/shared-wallets BR-13).
  recorded_by?: { id: string; name: string } | null;
}

// --- Items of a Transaction (specs/transaction-line-items) ----------------

export type AdjustmentKind = "tax" | "fee" | "discount" | "other";
export type AdjustmentDirection = "add" | "subtract";

// Money is integer cents of the Transaction's Wallet currency.
export interface TransactionItem {
  name: string;
  quantity: number;
  unit_price: number | null;
  amount: number;
}

export interface TransactionAdjustment {
  kind: AdjustmentKind;
  direction: AdjustmentDirection;
  label: string | null;
  amount: number;
}

// What a create/update sends. quantity defaults to 1 server-side; direction is
// required for "other" only; label only for "other".
export interface TransactionItemInput {
  name: string;
  quantity: number;
  unit_price?: number;
  amount: number;
}

export interface TransactionAdjustmentInput {
  kind: AdjustmentKind;
  direction?: AdjustmentDirection;
  label?: string;
  amount: number;
}

// Mirrors the `location` object of backend dto.TransactionResponse.
// Coordinates are degrees, not money — plain numbers are fine here.
export interface TransactionLocation {
  latitude: number;
  longitude: number;
  // Reverse-geocoded area, e.g. "Quận 1, TP. Hồ Chí Minh" — null when the
  // pin was dropped offline, where no geocoder answers.
  place_name: string | null;
  // The User's own words about the place (directions, which gate…).
  note: string | null;
}

// What a create sends: same shape, the optional parts left out when empty.
export interface TransactionLocationInput {
  latitude: number;
  longitude: number;
  place_name?: string;
  note?: string;
}

export interface ListTransactionsResult {
  data: Transaction[];
  next_cursor: string | null;
  // Rows matching the request's filters in full — present on the first page
  // only, null on any cursor-fetched page (the figure can't change while
  // paging through the same filters). Backend: dto.ListTransactionsResponse.
  total: number | null;
}

export interface ListTransactionsFilters {
  wallet_id?: string;
  category_id?: string;
  // Comma-separated category UUIDs — backs the Transactions screen's
  // multi-select category filter (backend/internal/dto.ListTransactionsQuery.
  // CategoryIDs). Additive with category_id; callers send one or the other.
  category_ids?: string;
  type?: TransactionKind;
  from?: string;
  to?: string;
  // ILIKE substring match against a transaction's note.
  search?: string;
  // Only entries whose wallet is in this currency (the currency pill).
  currency?: string;
  limit?: number;
}

export interface CreateTransactionRequest {
  wallet_id: string;
  // Omitted for a transfer — the server files it under its own system
  // "Chuyển khoản" category.
  category_id?: string;
  // Required for a transfer (the destination), never sent otherwise.
  to_wallet_id?: string;
  amount: number;
  type: TransactionKind;
  occurred_at?: string;
  note?: string;
  idempotency_key?: string;
  location?: TransactionLocationInput;
  items?: TransactionItemInput[];
  adjustments?: TransactionAdjustmentInput[];
}

// type is never accepted by PATCH (backend dto.UpdateTransactionRequest
// excludes it structurally) — mirrors frontend/src/features/transactions/
// types.ts's UpdateTransactionRequest.
export interface UpdateTransactionRequest {
  amount?: number;
  category_id?: string;
  // Moves an income/expense to another wallet: the old one gets its effect
  // back, the new one takes it (at the new amount when amount is sent too).
  // Same currency only (422 WALLET_CURRENCY_MISMATCH), never a transfer (422
  // TRANSFER_WALLET_IMMUTABLE). Send it only when the wallet changed.
  wallet_id?: string;
  occurred_at?: string;
  note?: string;
  // Only for a Transaction that has a location; "" clears it.
  location_note?: string;
  // Moves an existing pin (never adds one to a Transaction without). The old
  // area name goes with the old spot: an omitted place_name is stored empty.
  location?: TransactionLocationMove;
  // Present = replace both lists ([] removes them); absent = leave them.
  items?: TransactionItemInput[];
  adjustments?: TransactionAdjustmentInput[];
  // updated_at of the copy being edited; a newer server copy → 409
  // TRANSACTION_CHANGED instead of a silent overwrite (BR-16).
  expected_updated_at?: string;
}

// PATCH's `location` — where a saved pin was moved to. Its note travels
// separately, as location_note.
export interface TransactionLocationMove {
  latitude: number;
  longitude: number;
  place_name?: string;
}

// --- Export / Import (specs/transaction-export-import) ---------------------

// One resolved, validated row from an import preview — mirrors
// backend/internal/dto.ImportRow exactly.
//
// ⚠️ `amount` is integer cents, already converted from the spreadsheet's
// major-unit Amount column server-side. Render it through formatCurrency like
// any other amount; never divide by 100 here.
export interface ImportRow {
  // 1-based worksheet row number, so a message can name the row the user sees
  // in Excel.
  row: number;
  wallet_id: string;
  category_id: string;
  amount: number;
  type: TransactionType;
  occurred_at: string;
  note: string | null;
  idempotency_key: string;
}

// A row that will not be imported. Same shape for both buckets — a duplicate
// is an intentional skip, an error is a data problem.
export interface ImportRowIssue {
  row: number;
  reason: string;
}

// Response of POST /transactions/import/preview. Nothing is written by this
// call; `import_token` is the entire server-side state it produces, and it
// expires in 5 minutes.
export interface ImportPreview {
  valid: ImportRow[];
  duplicates: ImportRowIssue[];
  errors: ImportRowIssue[];
  import_token: string;
}

// Response of POST /transactions/import/commit — `skipped` is a row whose
// deterministic idempotency key already existed (a re-import or a
// double-tap), `failed` is anything else (e.g. a balance race since preview).
export interface ImportResult {
  imported: number;
  skipped: number;
  failed: number;
  failures: ImportRowIssue[];
}
