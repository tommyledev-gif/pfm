import type { WalletCurrency } from "@/lib/constants";

export type BudgetStatus = "within" | "exceeded";

export interface LimitEntry {
  currency: WalletCurrency;
  amount_limit: number;
  spent: number;
  remaining: number;
  status: BudgetStatus;
}

export interface Budget {
  id: string;
  category_id: string;
  category_name: string;
  period: string;
  start_date: string;
  limits: LimitEntry[];
  status: BudgetStatus;
  created_at: string;
  updated_at: string;
}

export interface ListBudgetsResult {
  data: Budget[];
}

// `limits` is keyed by currency ("VND" | "USD") — mirrors the backend's
// dto.CreateBudgetRequest/UpdateBudgetRequest map shape exactly.
export interface CreateBudgetRequest {
  category_id: string;
  limits: Record<string, number>;
  period?: string;
  start_date?: string;
}

// A FULL REPLACEMENT of the Budget's currency entries, never a per-currency
// merge (spec.md Edge Case US-04 #1) — the client must resend every
// currency it wants to keep.
export interface UpdateBudgetRequest {
  limits: Record<string, number>;
}
