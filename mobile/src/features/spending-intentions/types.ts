// Mirrors backend/internal/dto/spending_intention_{request,response}.go —
// /spending-intentions and the consult reply of kind "intention"
// (specs/ai-chat-spending-intentions). Amounts are integer cents (xu).

export type IntentionKind = "one_time" | "installment";

/** Where a Budget line's `spent` comes from: this cycle's real spending (the
 *  Budgets screen's own figure), the Category's usual spending (a later month
 *  has no real one yet), or only the limit (no history to take a usual from). */
export type IntentionBudgetBasis = "this_cycle" | "usual" | "limit";

/** The linked Category's Budget for one month, weighed against what is planned in that Category. */
export interface IntentionBudget {
  category_name: string;
  limit: number;
  basis: IntentionBudgetBasis;
  spent: number;
  /** limit minus spent. */
  remaining: number;
  /** What the other plans in the same Category take that month. */
  other_planned: number;
  /** What the Budget leaves after spent and after those plans; absent when spent is unknown. */
  left?: number;
}

/**
 * How one intention sits against the User's own records. Every field after
 * `months` may be absent when it cannot be worked out (no price, no history,
 * no Budget): the line is then left out, never shown as zero.
 */
export interface IntentionAssessment {
  currency: string;
  months: number;
  monthly_burden?: number;
  total?: number;
  /** "YYYY-MM": the plan's month, or the current cycle's once that has passed. */
  assessed_month: string;
  baseline_cycles: number;
  avg_income?: number;
  avg_expense?: number;
  surplus?: number;
  other_planned: number;
  headroom?: number;
  fits_surplus?: boolean;
  short_surplus?: number;
  budget?: IntentionBudget;
  fits_budget?: boolean;
  short_budget?: number;
}

export interface SpendingIntention {
  /** Absent on a proposal that has not been kept. */
  id?: string;
  title: string;
  kind: IntentionKind;
  category_id?: string;
  category_name?: string;
  currency: string;
  total_amount?: number;
  monthly_amount?: number;
  installment_months?: number;
  /** "YYYY-MM". */
  target_month: string;
  note?: string;
  assessment: IntentionAssessment;
}

/** One Budget against everything planned in its Category that month. */
export interface IntentionBudgetLoad extends IntentionBudget {
  fits?: boolean;
  short?: number;
}

/** What all plans take in one month, against the usual surplus and each Budget they touch. */
export interface IntentionMonthLoad {
  /** "YYYY-MM". */
  month: string;
  planned: number;
  headroom?: number;
  fits_surplus?: boolean;
  short_surplus?: number;
  budgets: IntentionBudgetLoad[];
}

/**
 * Everything planned in one currency, weighed together month by month
 * (spec.md A-08): plans in one Category share its Budget, plans in one month
 * share the surplus. `months` lists only months that pay something.
 */
export interface IntentionPortfolio {
  currency: string;
  count: number;
  baseline_cycles: number;
  avg_income?: number;
  avg_expense?: number;
  surplus?: number;
  months: IntentionMonthLoad[];
}

/** The list endpoint's answer: the intentions and what they add up to. */
export interface SpendingIntentionList {
  items: SpendingIntention[];
  portfolios: IntentionPortfolio[];
}

/** The editable set a save or an edit sends. `null` clears a value on an edit. */
export interface SpendingIntentionInput {
  title: string;
  kind: IntentionKind;
  category_id?: string | null;
  currency?: string;
  total_amount?: number | null;
  monthly_amount?: number | null;
  installment_months?: number | null;
  /** "YYYY-MM"; empty means the current cycle's month. */
  target_month?: string;
  note?: string | null;
}

export interface CreateSpendingIntentionRequest extends SpendingIntentionInput {
  /** The card's own id: saving it twice keeps one intention. */
  idempotency_key?: string;
}

/** One proposed intention of a consult reply. */
export interface ConsultIntentionDraft {
  draft: SpendingIntention;
  /** A month already past was read; the current cycle was used instead. */
  month_moved?: boolean;
}

/**
 * What a consult reply of kind "intention" carries: one draft per thing the
 * sentence named, and what they add up to together with what is already kept.
 */
export interface ConsultIntentions {
  items: ConsultIntentionDraft[];
  portfolios: IntentionPortfolio[];
  /** The sentence named more than one message takes; only the first were read. */
  truncated?: boolean;
  /** Items that could not be read (no name, an absurd amount). */
  skipped?: number;
}

/**
 * What became of one draft of a card, by position: absent while it is still a
 * proposal; "saved" with the kept intention's id; "removed" once deleted;
 * "discarded" when dropped without keeping.
 */
export interface IntentionItemState {
  id?: string;
  state?: "saved" | "removed" | "discarded";
}

// Limits the form enforces before the server does (same numbers as
// backend/internal/common/constants_intention.go).
export const INTENTION_TITLE_MAX = 80;
export const INSTALLMENT_MIN_MONTHS = 2;
export const INSTALLMENT_MAX_MONTHS = 60;
/** How many months ahead the form offers. */
export const INTENTION_MONTH_CHOICES = 12;
