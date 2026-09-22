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

/** One of the lifestyle answers on screen 2. Mirrors common.BudgetPresetKey. */
export type PresetKey =
  | "rented_eating_out"
  | "with_family"
  | "couple_no_kids"
  | "own_family"
  | "student"
  | "retired";

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

/** The lifestyle options, in the order screen 2 lists them. */
// `description` says what the option implies for the resulting budget, which
// the label alone does not. Picking a living situation is a proxy for a
// spending shape, and a user who cannot see the shape is guessing at which
// label fits them — the one thing this screen exists to avoid.
export const PRESET_OPTIONS: { key: PresetKey; icon: string; label: string; description: string }[] = [
  {
    key: "rented_eating_out",
    icon: "🏙",
    label: "Ở trọ, đi làm",
    description: "Tiền nhà, ăn ngoài và đi lại chiếm phần lớn.",
  },
  {
    key: "with_family",
    icon: "🏡",
    label: "Ở với gia đình",
    description: "Ít tiền nhà và tiền ăn, dư nhiều hơn cho mục khác.",
  },
  {
    // Between "ở với gia đình" and "có gia đình riêng" there was no answer for
    // a couple without children, so they picked own_family and got a
    // children_education line they will never spend on.
    key: "couple_no_kids",
    icon: "💑",
    label: "Vợ chồng son",
    description: "Hai người, chưa có con — ăn ngoài và đi chơi nhiều hơn.",
  },
  {
    key: "own_family",
    icon: "👨‍👩‍👧",
    label: "Có gia đình riêng",
    description: "Thêm chi phí cho con và sinh hoạt cả nhà.",
  },
  {
    key: "student",
    icon: "🎓",
    label: "Sinh viên",
    description: "Thu nhập thấp, chi tiêu gọn quanh ăn uống và đi lại.",
  },
  {
    // The one profile where health is a standing monthly line and transport is
    // the smallest — no commute.
    key: "retired",
    icon: "🧓",
    label: "Đã nghỉ hưu",
    description: "Chi tiêu đều đặn, y tế chiếm phần lớn hơn.",
  },
];

export interface ConfidenceBadge {
  /** 1..3 — how much the app actually knows about this figure. */
  level: 1 | 2 | 3;
  /** The short words shown on the row. */
  label: string;
  /** Read only when the user asks — see ProposalRow's confidence popup. */
  explanation: string;
}

/**
 * How the app came by a row's figure.
 *
 * ⚠️ The level is deliberately NOT rendered as filled/empty dots by default.
 * "●●○" beside a number looks like a rating of the category, or a progress
 * bar, or a signal strength — three readings, none of them the intended one,
 * and a glyph that has to be explained is worse than the words it replaced.
 * The words carry the meaning on the row; the level and its explanation are
 * there for whoever taps to ask.
 */
export function confidenceBadge(source: IntentSource): ConfidenceBadge {
  switch (source) {
    case "stated":
    case "manual":
      return {
        level: 3,
        label: "bạn đã nói",
        explanation: "Con số này là của bạn — bạn đã tự nhập hoặc tự sửa nó, nên tôi không đoán gì cả.",
      };
    case "history":
      return {
        level: 2,
        label: "từ lịch sử chi tiêu",
        explanation: "Tính từ các giao dịch bạn đã ghi trước đây, nên khá gần thực tế của bạn.",
      };
    default:
      return {
        level: 1,
        label: "ước lượng",
        explanation: "Chỉ dựa trên kiểu sống bạn chọn, chưa dựa trên chi tiêu thật. Bạn sửa lại bất cứ lúc nào.",
      };
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
