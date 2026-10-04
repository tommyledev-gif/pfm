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
  /** The active User's plan — derived from byUser, kept for the wizard's selectors. */
  plan: SavedBudgetPlan | null;
  // False until AsyncStorage has been read back. The wizard checks it before
  // deciding a user has no saved plan — treating "not loaded yet" as "nothing
  // saved" would silently start them from zero on a cold launch.
  hydrated: boolean;
  /**
   * One plan per User. AsyncStorage is per device, not per account, and
   * several accounts can now take turns on one phone
   * (specs/mobile-account-switch AC-09, S-ASW-14): switching A → B → A must
   * give A back their plan and never show it to B.
   */
  byUser: Record<string, SavedBudgetPlan>;
  /** A plan saved before plans had an owner (v0/v1 with ownerId null). */
  unowned: SavedBudgetPlan | null;
  /** Whose plan `plan` currently is; null while nobody is signed in. */
  activeUserId: string | null;
  savePlan: (plan: SavedBudgetPlan) => void;
  clearPlan: () => void;
  /**
   * Hands the store to `userId` (stores/session-scoped-reset.ts, at every
   * session start or user change). An unowned plan is adopted only when
   * `adoptUnowned` — a session restored on launch is the same person who
   * saved it, a fresh login could be anyone.
   */
  claimFor: (userId: string, adoptUnowned: boolean) => void;
  /** Drops a User's plan from this device (saved account removed). */
  removeUser: (userId: string) => void;
}

interface PersistedPlanV1 {
  plan?: SavedBudgetPlan | null;
  ownerId?: string | null;
}

interface PersistedPlanV2 {
  byUser: Record<string, SavedBudgetPlan>;
  unowned: SavedBudgetPlan | null;
  activeUserId: string | null;
}

const PLAN_STORE_VERSION = 2;

// v1 held one slot + its owner; v2 keys plans by User.
function migratePlan(persisted: unknown, version: number): PersistedPlanV2 {
  if (version >= PLAN_STORE_VERSION) return persisted as PersistedPlanV2;
  const v1 = (persisted ?? {}) as PersistedPlanV1;
  const plan = v1.plan ?? null;
  const ownerId = v1.ownerId ?? null;
  return {
    byUser: plan && ownerId ? { [ownerId]: plan } : {},
    unowned: plan && !ownerId ? plan : null,
    activeUserId: ownerId,
  };
}

export const useSavedBudgetPlanStore = create<SavedPlanState>()(
  persist(
    (set) => ({
      plan: null,
      hydrated: false,
      byUser: {},
      unowned: null,
      activeUserId: null,
      savePlan: (plan) =>
        set((state) =>
          state.activeUserId
            ? { plan, byUser: { ...state.byUser, [state.activeUserId]: plan } }
            : { plan, unowned: plan },
        ),
      clearPlan: () =>
        set((state) => {
          if (!state.activeUserId) return { plan: null, unowned: null };
          const { [state.activeUserId]: _dropped, ...rest } = state.byUser;
          return { plan: null, byUser: rest };
        }),
      claimFor: (userId, adoptUnowned) =>
        set((state) => {
          const adopt = adoptUnowned && state.unowned !== null && !state.byUser[userId];
          const byUser = adopt && state.unowned ? { ...state.byUser, [userId]: state.unowned } : state.byUser;
          return {
            activeUserId: userId,
            byUser,
            unowned: adopt ? null : state.unowned,
            plan: byUser[userId] ?? null,
          };
        }),
      removeUser: (userId) =>
        set((state) => {
          const { [userId]: _dropped, ...rest } = state.byUser;
          const isActive = state.activeUserId === userId;
          return { byUser: rest, plan: isActive ? null : state.plan };
        }),
    }),
    {
      name: "pfm_budget_plan",
      storage: createJSONStorage(() => AsyncStorage),
      version: PLAN_STORE_VERSION,
      migrate: migratePlan,
      partialize: (state): PersistedPlanV2 => ({
        byUser: state.byUser,
        unowned: state.unowned,
        activeUserId: state.activeUserId,
      }),
      onRehydrateStorage: () => (state) => {
        // `state` is the store after rehydration — undefined only if reading
        // storage threw, in which case there is nothing to restore and the
        // wizard should stop waiting for one.
        const byUser = state?.byUser ?? {};
        const activeUserId = state?.activeUserId ?? null;
        useSavedBudgetPlanStore.setState({
          hydrated: true,
          byUser,
          unowned: state?.unowned ?? null,
          activeUserId,
          plan: activeUserId ? (byUser[activeUserId] ?? null) : null,
        });
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
