import { Budget } from "@/features/budgets/types";
import { Category } from "@/features/categories/types";

// Hand-mirrored from backend/internal/dto/budget_wizard_{request,response}.go.
// There is no codegen between the two (CLAUDE.md), so a field added on one side
// has to be added here by hand.
//
// ⚠️ Every amount is xu (integer cents), never đồng. Convert only at the render
// boundary, through lib/currency.

/** Where a row's amount came from. Drives the confidence badge and band width. */
export type IntentSource = "preset" | "stated" | "manual" | "history";

/** One of the four lifestyle answers on screen 2. */
export type PresetKey = "rented_eating_out" | "with_family" | "own_family" | "student";

export interface PresetShare {
  system_key: string;
  percent: number;
}

export interface Preset {
  key: PresetKey;
  shares: PresetShare[];
}

export interface BudgetWizardPrefill {
  currency: string;
  cycle_start_day: number;
  default_savings_pct: number;
  presets: Preset[];
  categories: Category[];
  existing_budgets: Budget[];
}

export interface CategoryIntentRequest {
  category_id: string;
  category_name: string;
  system_key?: string;
  source: IntentSource;
  /** xu. 0 for a preset intent — the server derives it from the profile share. */
  amount_min: number;
  amount_max: number;
  /** The user pinned this figure: it is neither scaled nor rounded. */
  locked: boolean;
}

export interface BudgetProposalsRequest {
  income: number;
  fixed_total: number;
  savings_target: number;
  currency: string;
  period: "monthly";
  cycle_start_day: number;
  profile_preset?: PresetKey;
  intents: CategoryIntentRequest[];
}

export interface ProposalEntry {
  category_id: string;
  category_name: string;
  system_key?: string;
  /** The band. `amount_max` is what becomes the real budget limit. */
  amount_min: number;
  amount_max: number;
  source: IntentSource;
  locked: boolean;
  confidence: number;
  /** Concrete grounding, or absent. Absent means the row shows its badge alone —
   *  never a filler sentence. */
  evidence?: string;
}

export interface BudgetProposalsResponse {
  disposable: number;
  proposals: ProposalEntry[];
  /** Buffer + rounding remainder + anything a ceiling clipped.
   *  Invariant: sum(amount_max) + unallocated_amount === disposable. */
  unallocated_amount: number;
  over_committed: boolean;
  shortfall: number;
  scaled_down: boolean;
}

/** The draft the user is building. Local by design — it is input, not server
 *  state, and nothing is written until the final confirmation. */
export interface WizardDraft {
  /** xu. */
  income: number;
  fixed: number;
  savingsPct: number;
  cycleStartDay: number;
  preset: PresetKey | null;
}

/** The four lifestyle options, in the order screen 2 lists them. */
export const PRESET_OPTIONS: { key: PresetKey; icon: string; label: string }[] = [
  { key: "rented_eating_out", icon: "🏙", label: "Ở trọ, đi làm, ăn ngoài là chính" },
  { key: "with_family", icon: "🏡", label: "Ở với gia đình, ăn cơm nhà" },
  { key: "own_family", icon: "👨‍👩‍👧", label: "Có gia đình riêng, có con nhỏ" },
  { key: "student", icon: "🎓", label: "Sinh viên" },
];

/** Confidence badge per source — the row's honest label for how much the app
 *  actually knows. `preset` is the lowest and says so in plain words. */
export function confidenceBadge(source: IntentSource): string {
  switch (source) {
    case "stated":
    case "manual":
      return "●●● bạn đã nói";
    case "history":
      return "●●○ từ lịch sử chi tiêu";
    default:
      return "○○○ ước lượng";
  }
}

// --- POST /budgets/bulk -----------------------------------------------------
// Mirrors dto.BulkCreateBudgetsRequest / BulkCreateBudgetsResponse.
//
// ⚠️ This payload does NOT yet carry the `plan` object from spec.md US-08. The
// planning layer's tables exist (migration 020) but the write path that fills
// them is not built, so a wizard run currently persists budgets only. Until it
// lands, a v2 run leaves no plan version behind and Phase 2's calibration has
// nothing to compare against.

export interface BulkLimitItem {
  currency: string;
  /** xu. */
  amount_limit: number;
}

export interface BulkBudgetItem {
  category_id: string;
  period: "monthly";
  limits: BulkLimitItem[];
}

export interface BulkCreateBudgetsRequest {
  budgets: BulkBudgetItem[];
}

export interface BulkCreateBudgetsResponse {
  created_count: number;
}
