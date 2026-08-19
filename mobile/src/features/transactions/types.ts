import { TransactionType } from "@/lib/constants";

// Mirrors backend/internal/dto/transaction_response.go /
// frontend/src/features/transactions/types.ts.
export interface Transaction {
  id: string;
  wallet_id: string;
  wallet_name: string;
  category_id: string;
  category_name: string;
  amount: number; // integer cents, always positive
  type: TransactionType;
  note: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  wallet_balance?: number; // only present on create/update responses
}

export interface ListTransactionsResult {
  data: Transaction[];
  next_cursor: string | null;
}

export interface ListTransactionsFilters {
  wallet_id?: string;
  category_id?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
  limit?: number;
}

export interface CreateTransactionRequest {
  wallet_id: string;
  category_id: string;
  amount: number;
  type: TransactionType;
  occurred_at?: string;
  note?: string;
  idempotency_key?: string;
}

// wallet_id and type are never accepted by PATCH (backend dto.
// UpdateTransactionRequest excludes them structurally) — mirrors
// frontend/src/features/transactions/types.ts's UpdateTransactionRequest.
export interface UpdateTransactionRequest {
  amount?: number;
  category_id?: string;
  occurred_at?: string;
  note?: string;
}
