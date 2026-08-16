import { TransactionType } from "@/lib/constants";

// Mirrors backend/internal/dto/report_response.go GetSummary response.
// No `percentage` field — computed client-side from amount / matching total.
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

export interface ReportSummaryFilters {
  from?: string;
  to?: string;
  wallet_id?: string;
  category_id?: string;
  type?: TransactionType;
}
