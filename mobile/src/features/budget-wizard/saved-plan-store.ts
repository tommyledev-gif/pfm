import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { SavedBudgetPlan } from "@/features/budget-wizard/saved-plan";

/**
 * The wizard runs the User chose to keep, on this device (see SavedBudgetPlan
 * for why it is local).
 *
 * ⚠️ A kept plan is never removed by the app. Saving adds one beside the
 * others, never in place of one; starting a run over ("Bắt đầu lại") only
 * stops using it for that run; confirming a plan leaves it kept. The only way
 * one goes is the User deleting it from the saved-plans list.
 */
interface SavedPlanState {
  /** The active User's plans, newest first. */
  plans: SavedBudgetPlan[];
  /** The newest of them, which the wizard opens on; null when there is none. */
  plan: SavedBudgetPlan | null;
  // False until AsyncStorage has been read back. The wizard checks it before
  // deciding a user has no saved plan — treating "not loaded yet" as "nothing
  // saved" would silently start them from zero on a cold launch.
  hydrated: boolean;
  /**
   * Each User's own list. AsyncStorage is per device, not per account, and
   * several accounts can take turns on one phone (specs/mobile-account-switch
   * AC-09, S-ASW-14): switching A → B → A must give A back their plans and
   * never show them to B.
   */
  byUser: Record<string, SavedBudgetPlan[]>;
  /** Plans saved before plans had an owner (v0/v1 with ownerId null). */
  unowned: SavedBudgetPlan[];
  /** Whose plans `plans` currently are; null while nobody is signed in. */
  activeUserId: string | null;
  savePlan: (plan: SavedBudgetPlan) => void;
  deletePlan: (planId: string) => void;
  /**
   * Hands the store to `userId` (stores/session-scoped-reset.ts, at every
   * session start or user change). Unowned plans are adopted only when
   * `adoptUnowned` — a session restored on launch is the same person who
   * saved them, a fresh login could be anyone.
   */
  claimFor: (userId: string, adoptUnowned: boolean) => void;
  /** Drops a User's plans from this device (saved account removed). */
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

interface PersistedPlanV3 {
  byUser: Record<string, SavedBudgetPlan[]>;
  unowned: SavedBudgetPlan[];
  activeUserId: string | null;
}

const PLAN_STORE_VERSION = 3;

/** A local key for a kept plan: unique on this device, never sent anywhere. */
export function newPlanId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// v1 held one slot + its owner; v2 keys one plan by User; v3 a list per User.
function migratePlan(persisted: unknown, version: number): PersistedPlanV3 {
  if (version >= PLAN_STORE_VERSION) return persisted as PersistedPlanV3;
  let v2 = persisted as PersistedPlanV2;
  if (version < 2) {
    const v1 = (persisted ?? {}) as PersistedPlanV1;
    const plan = v1.plan ?? null;
    const ownerId = v1.ownerId ?? null;
    v2 = { byUser: plan && ownerId ? { [ownerId]: plan } : {}, unowned: plan && !ownerId ? plan : null, activeUserId: ownerId };
  }
  const asList = (plan: SavedBudgetPlan | null | undefined) => (plan ? [{ ...plan, id: plan.id ?? newPlanId() }] : []);
  return {
    byUser: Object.fromEntries(Object.entries(v2.byUser ?? {}).map(([userId, plan]) => [userId, asList(plan)])),
    unowned: asList(v2.unowned),
    activeUserId: v2.activeUserId ?? null,
  };
}

/** `plans` and `plan` for a list, which every change sets together. */
const shown = (plans: SavedBudgetPlan[]) => ({ plans, plan: plans[0] ?? null });

export const useSavedBudgetPlanStore = create<SavedPlanState>()(
  persist(
    (set) => {
      // The list being changed: the active User's, or the unowned one.
      const update = (state: SavedPlanState, change: (plans: SavedBudgetPlan[]) => SavedBudgetPlan[]) => {
        if (!state.activeUserId) {
          const unowned = change(state.unowned);
          return { unowned, ...shown(unowned) };
        }
        const plans = change(state.byUser[state.activeUserId] ?? []);
        return { byUser: { ...state.byUser, [state.activeUserId]: plans }, ...shown(plans) };
      };
      return {
        plans: [],
        plan: null,
        hydrated: false,
        byUser: {},
        unowned: [],
        activeUserId: null,
        savePlan: (plan) => set((state) => update(state, (plans) => [plan, ...plans])),
        deletePlan: (planId) => set((state) => update(state, (plans) => plans.filter((p) => p.id !== planId))),
        claimFor: (userId, adoptUnowned) =>
          set((state) => {
            const adopt = adoptUnowned && state.unowned.length > 0 && !state.byUser[userId]?.length;
            const byUser = adopt ? { ...state.byUser, [userId]: state.unowned } : state.byUser;
            return { activeUserId: userId, byUser, unowned: adopt ? [] : state.unowned, ...shown(byUser[userId] ?? []) };
          }),
        removeUser: (userId) =>
          set((state) => {
            const { [userId]: _dropped, ...rest } = state.byUser;
            return state.activeUserId === userId ? { byUser: rest, ...shown([]) } : { byUser: rest };
          }),
      };
    },
    {
      name: "pfm_budget_plan",
      storage: createJSONStorage(() => AsyncStorage),
      version: PLAN_STORE_VERSION,
      migrate: migratePlan,
      partialize: (state): PersistedPlanV3 => ({
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
          unowned: state?.unowned ?? [],
          activeUserId,
          ...shown(activeUserId ? (byUser[activeUserId] ?? []) : []),
        });
      },
    },
  ),
);
