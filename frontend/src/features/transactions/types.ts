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
}

export interface ListTransactionsResult {
  data: Transaction[];
  next_cursor: string | null;
}

export interface CreateTransactionRequest {
  wallet_id: string;
  category_id: string;
  amount: number;
  type: TransactionType;
  occurred_at?: string;
  note?: string;
}

// wallet_id and type are never accepted by PATCH (spec.md Context #5) —
// deliberately absent from this type, mirroring the backend DTO's
// structural exclusion.
export interface UpdateTransactionRequest {
  amount?: number;
  category_id?: string;
  occurred_at?: string;
  note?: string;
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
