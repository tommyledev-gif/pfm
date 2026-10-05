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
}

// wallet_id and type are never accepted by PATCH (backend dto.
// UpdateTransactionRequest excludes them structurally) — mirrors
// frontend/src/features/transactions/types.ts's UpdateTransactionRequest.
export interface UpdateTransactionRequest {
  amount?: number;
  category_id?: string;
  occurred_at?: string;
  note?: string;
  // Only for a Transaction that has a location; "" clears it. Coordinates and
  // place name are fixed once created.
  location_note?: string;
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
