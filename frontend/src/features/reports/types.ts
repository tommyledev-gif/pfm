import type { TransactionType } from "@/lib/constants";

export interface ReportRange {
  from: string;
  to: string;
}

export interface ReportTotal {
  currency: string;
  total_income: number;
  total_expense: number;
  net: number;
}

export interface ReportCategoryEntry {
  category_id: string;
  category_name: string;
  type: TransactionType;
  currency: string;
  amount: number;
}

export interface ReportSummary {
  range: ReportRange;
  totals: ReportTotal[];
  by_category: ReportCategoryEntry[];
}

// Client-side filter state driving GET /reports/summary's query params —
// mirrors dto.ReportSummaryQuery. Same shape as TransactionFilters, kept
// separate (not reused) since the two features' filters can evolve
// independently (spec.md Context decision #1 only merges the report's own
// five User Stories into one endpoint, not this feature with Transactions).
export interface ReportFilters {
  walletId?: string;
  categoryId?: string;
  type?: TransactionType;
  from?: string;
  to?: string;
}
