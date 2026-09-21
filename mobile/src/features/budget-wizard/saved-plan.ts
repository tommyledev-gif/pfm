import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

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
}

interface SavedPlanState {
  plan: SavedBudgetPlan | null;
  // False until AsyncStorage has been read back. The wizard checks it before
  // deciding a user has no saved plan — treating "not loaded yet" as "nothing
  // saved" would silently start them from zero on a cold launch.
  hydrated: boolean;
  savePlan: (plan: SavedBudgetPlan) => void;
  clearPlan: () => void;
}

export const useSavedBudgetPlanStore = create<SavedPlanState>()(
  persist(
    (set) => ({
      plan: null,
      hydrated: false,
      savePlan: (plan) => set({ plan }),
      clearPlan: () => set({ plan: null }),
    }),
    {
      name: "pfm_budget_plan",
      storage: createJSONStorage(() => AsyncStorage),
      version: 1,
      partialize: (state) => ({ plan: state.plan }),
      onRehydrateStorage: () => (state) => {
        // `state` is the store after rehydration — undefined only if reading
        // storage threw, in which case there is nothing to restore and the
        // wizard should stop waiting for one.
        useSavedBudgetPlanStore.setState({ hydrated: true, plan: state?.plan ?? null });
      },
    },
  ),
);

/** "14/09/2026" — what the restored-plan banner and the save button show. */
export function formatSavedAt(savedAt: string): string {
  const date = new Date(savedAt);
  if (Number.isNaN(date.getTime())) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/**
 * Lays a saved plan's own figures back over a freshly computed proposal.
 *
 * ⚠️ The proposal is still requested from the server rather than read out of the
 * saved plan: the allocator, the presets and the user's categories can all have
 * moved since the plan was kept, and replaying a stale allocation would hand
 * back a plan that no longer matches its own inputs. What the server cannot
 * know is which rows the user overruled by hand last time — that is the part
 * worth restoring, and it is all this does.
 *
 * Rows the user invented are re-appended (they exist in no preset), and the
 * buffer absorbs the whole difference, exactly as a live hand-edit does.
 */
export function applySavedPlanRows(
  response: BudgetProposalsResponse,
  rows: SavedPlanRow[],
): BudgetProposalsResponse {
  const savedById = new Map(rows.map((row) => [row.category_id, row]));

  const merged: ProposalEntry[] = response.proposals.map((p) => {
    const saved = savedById.get(p.category_id);
    if (!saved) return p;
    return { ...p, amount_min: saved.amountXu, amount_max: saved.amountXu, source: "manual", locked: true };
  });

  const present = new Set(merged.map((p) => p.category_id));
  for (const row of rows) {
    if (present.has(row.category_id)) continue;
    merged.push({
      category_id: row.category_id,
      category_name: row.category_name,
      amount_min: row.amountXu,
      amount_max: row.amountXu,
      source: "manual",
      locked: true,
      confidence: 1,
    });
  }

  const allocated = merged.reduce((sum, p) => sum + p.amount_max, 0);
  return { ...response, proposals: merged, unallocated_amount: response.disposable - allocated };
}
