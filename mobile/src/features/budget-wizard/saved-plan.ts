import { SavingsChoice } from "@/features/budget-wizard/budget-math";
import { FixedCostItem } from "@/features/budget-wizard/fixed-costs";
import { BudgetProposalsResponse, PresetKey, ProposalEntry } from "@/features/budget-wizard/types";

/** One category line as the user left it on screen 3. */
export interface SavedPlanRow {
  /** The real category id, or the `new:…` placeholder of a row the user invented. */
  category_id: string;
  category_name: string;
  /** xu. */
  amountXu: number;
  /** True for a row the user added by hand — the only ones that may be removed. */
  added: boolean;
  /** Set only when the row's category did not exist yet at save time. */
  pendingName?: string;
  /** The user set this figure by hand. Absent in plans kept before it was
   *  recorded, which restored every row as hand-set — still read that way. */
  manual?: boolean;
}

/**
 * A wizard run the user chose to keep.
 *
 * ⚠️ LOCAL ONLY, and deliberately so: the backend has no plan-storage write path
 * yet (see the note above BulkCreateBudgetsRequest in types.ts — migration 020's
 * tables exist but nothing fills them). Persisting to AsyncStorage is what makes
 * "run it again next month" possible today without waiting on that, and it is
 * non-sensitive UI state, the same call ui-prefs-store.ts already makes.
 *
 * It holds the ANSWERS, not the budgets that were written. Budgets live on the
 * server and are read back through useBudgetsQuery like any other server state;
 * what cannot be recovered from them is how the user got there — the income they
 * declared, the costs they itemised, the profile they picked, and which rows
 * they overruled by hand.
 */
export interface SavedBudgetPlan {
  /** Local key (newPlanId). Plans kept before there was a list got one when the store moved to v3. */
  id: string;
  /** ISO timestamp. Shown to the user, so they can tell a stale plan from a fresh one. */
  savedAt: string;
  currency: string;
  /** xu. */
  income: number;
  fixed: number;
  fixedCostsText: string;
  fixedCostsSuggested: FixedCostItem[];
  savingsChoice: SavingsChoice;
  cycleStartDay: number;
  preset: PresetKey | null;
  rows: SavedPlanRow[];
  /** The User's own categories renamed on screen 3 (id → new name), applied
   *  when the plan is finally confirmed. Absent in plans kept before. */
  renamedCategories?: Record<string, string>;
}

/** "14/09/2026" — what the restored-plan banner and the save button show. */
export function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** A plan's content, without the moment it was kept — for telling whether two
 *  plans say the same thing (the save button reads "saved" while they do). */
export function planSignature(plan: SavedBudgetPlan): string {
  const { savedAt: _savedAt, id: _id, ...content } = plan;
  return JSON.stringify(content);
}

/**
 * Lays a saved plan back over a freshly computed proposal: the rows it kept,
 * in the order it kept them, at the figures it kept.
 *
 * ⚠️ The proposal is still requested from the server rather than read out of the
 * saved plan: the allocator, the presets and the user's categories can all have
 * moved since the plan was kept. The fresh response supplies what the server
 * knows about each row (its badge, its evidence, the category's current name);
 * the saved plan decides which rows there are and what each is set to.
 *
 * ⚠️ The plan as kept, not merged into the fresh one. Overlaying the saved
 * figures on the server's rows brought back every row the user had removed
 * before saving, and moved their own rows below the server's. So a fresh row
 * the plan does not have is dropped, a row the user invented is re-added, and
 * a row whose category no longer exists (deleted since) is left out — writing
 * a budget for it would fail the whole confirm.
 *
 * The buffer absorbs the whole difference, exactly as a live hand-edit does.
 */
export function applySavedPlanRows(
  response: BudgetProposalsResponse,
  rows: SavedPlanRow[],
  /** Every category the User has now; null while not known, which keeps all. */
  categoryIds: ReadonlySet<string> | null,
  renamedCategories: Record<string, string> = {},
): BudgetProposalsResponse {
  const freshById = new Map(response.proposals.map((p) => [p.category_id, p]));
  const proposals: ProposalEntry[] = [];

  for (const row of rows) {
    const fresh = freshById.get(row.category_id);
    if (!fresh && !row.pendingName && categoryIds && !categoryIds.has(row.category_id)) continue;
    // A name the user gave it wins; otherwise the server's, current and in
    // the current language.
    const name = row.pendingName ?? renamedCategories[row.category_id] ?? fresh?.category_name ?? row.category_name;
    const amounts = { amount_min: row.amountXu, amount_max: row.amountXu };
    if (fresh && row.manual === false) {
      proposals.push({ ...fresh, ...amounts, category_name: name });
    } else if (fresh) {
      proposals.push({ ...fresh, ...amounts, category_name: name, source: "manual", locked: true });
    } else {
      proposals.push({ category_id: row.category_id, category_name: name, ...amounts, source: "manual", locked: true, confidence: 1 });
    }
  }

  const allocated = proposals.reduce((sum, p) => sum + p.amount_max, 0);
  return { ...response, proposals, unallocated_amount: response.disposable - allocated };
}
