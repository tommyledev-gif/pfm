import { WalletCurrency } from "@/lib/constants";

export type BudgetStatus = "within" | "exceeded";

// Mirrors backend/internal/dto/budget_response.go — "spent" lives per
// currency inside `limits[]`, not as a separate top-level field, and is not
// yet computed from real transactions server-side (always 0 today);
// surfaced as-is, not recomputed client-side.
export interface BudgetLimit {
  currency: WalletCurrency;
  amount_limit: number;
  spent: number;
  remaining: number;
  status: BudgetStatus;
}

// icon/icon_url added by specs/wallet-budget-icons/spec.md — independent of
// the linked Category's own icon; icon_url takes display precedence over
// icon when both are set.
export interface Budget {
  id: string;
  category_id: string;
  category_name: string;
  period: string;
  start_date: string;
  limits: BudgetLimit[];
  status: BudgetStatus;
  icon: string | null;
  icon_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBudgetRequest {
  category_id: string;
  limits: Partial<Record<WalletCurrency, number>>;
  period?: string;
  start_date?: string;
  icon?: string;
  icon_url?: string;
}
