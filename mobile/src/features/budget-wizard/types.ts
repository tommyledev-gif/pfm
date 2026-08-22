import { Budget } from "@/features/budgets/types";
import { Category } from "@/features/categories/types";
import { CategoryType, WalletCurrency } from "@/lib/constants";

// Mirrors backend/internal/dto/budget_wizard_{request,response}.go +
// budget_bulk_{request,response}.go — specs/ai-budget-wizard.
export const SPENDING_PREFERENCES = ["very_little", "little", "normal", "a_lot", "priority", "ai_decides"] as const;
export type SpendingPreference = (typeof SPENDING_PREFERENCES)[number];

export const BUDGET_WIZARD_PERIODS = ["monthly", "weekly", "quarterly"] as const;
export type BudgetWizardPeriod = (typeof BUDGET_WIZARD_PERIODS)[number];

export interface BudgetWizardPrefillResponse {
  currency: WalletCurrency;
  categories: Category[];
  existing_budgets: Budget[];
}

export interface BudgetPreferenceInput {
  category_id: string;
  category_name: string;
  spending_preference: SpendingPreference;
}

export interface BudgetProposalsRequest {
  income: number;
  currency: WalletCurrency;
  period: BudgetWizardPeriod;
  preferences: BudgetPreferenceInput[];
}

export interface ProposalEntry {
  category_id: string;
  category_name: string;
  proposed_amount: number;
  percent_of_income: number;
  reasoning: string;
}

export interface BudgetProposalsResponse {
  proposals: ProposalEntry[];
  unallocated_amount: number;
  unallocated_percent: number;
  scaled_down_notice: boolean;
}

export interface SuggestCategoryNameRequest {
  description: string;
}

export interface SuggestCategoryNameResponse {
  suggested_name: string;
  type: CategoryType;
  icon: string;
}

export interface BulkLimitItem {
  currency: WalletCurrency;
  amount_limit: number;
}

export interface BulkBudgetItem {
  category_id: string;
  period: BudgetWizardPeriod;
  limits: BulkLimitItem[];
}

export interface BulkCreateBudgetsRequest {
  budgets: BulkBudgetItem[];
}

export interface BulkCreateBudgetsResponse {
  created_count: number;
  budgets: Budget[];
}

// --- Client-only wizard state (never sent as-is to the API) ---

// A Category the User described in free text that doesn't exist yet
// (spec.md US-03 step 4) — clientId is a temporary key used everywhere a
// real category_id would go (selection set, preferences map, proposal
// placeholder) until POST /categories resolves it to a real id at confirm
// time (US-05 Main Flow step 2).
export interface PendingCustomCategory {
  clientId: string;
  description: string;
  name: string;
  icon: string;
  type: CategoryType;
}

export interface WizardSelection {
  categoryId: string;
  categoryName: string;
  isPending: boolean;
  preference: SpendingPreference;
}
