import { BudgetWizardPrefill, CategoryIntentRequest, PresetKey } from "@/features/budget-wizard/types";
import { i18n, TranslationKey } from "@/lib/i18n";

/** Why the wizard could not build a proposal, when the reason is the server's
 *  state rather than the user's input. Kept separate from ordinary request
 *  failures because the fix is different: these need a deploy, not a retry. */
export type WizardProblem = "server_outdated" | "categories_unmigrated";

export const PROBLEM_KEYS: Record<WizardProblem, TranslationKey> = {
  server_outdated: "budgetWizard.problem.serverOutdated",
  categories_unmigrated: "budgetWizard.problem.categoriesUnmigrated",
};

/** The sentence for each problem, in the app language at the moment it is
 *  read (getters, not values). Prefer PROBLEM_KEYS + t() in a component. */
export const PROBLEM_MESSAGES: Record<WizardProblem, string> = {
  get server_outdated() { return i18n.t(PROBLEM_KEYS.server_outdated); },
  get categories_unmigrated() { return i18n.t(PROBLEM_KEYS.categories_unmigrated); },
};

/**
 * The categories a preset needs, resolved through system_key against what the
 * user actually has.
 *
 * ⚠️ Every field of the prefill response is read defensively, including ones the
 * current server always sends. A client must not crash because a field it
 * expected is absent — and this one did: `prefill.data?.presets.find(...)`
 * guarded `data` but not `presets`, so a server response without that key threw
 * "Cannot read property 'find' of undefined" the moment a preset was tapped.
 * Optional chaining has to cover the whole path, not just its head.
 *
 * Returns a `problem` rather than an empty array when it cannot build the
 * intents, so the caller can say something specific instead of sending a request
 * that is going to be rejected anyway.
 *
 * Pure, and split out of useBudgetWizardState to keep that hook inside the
 * 300-line limit (CLAUDE.md).
 */
export function resolvePresetIntents(
  prefill: BudgetWizardPrefill | undefined,
  key: PresetKey,
): { intents: CategoryIntentRequest[]; problem: WizardProblem | null } {
  const presets = prefill?.presets;
  // No preset table at all means this app build is talking to a server that
  // predates the v2 wizard. Nothing downstream can work — POST
  // /ai/budget-proposals would reject the new payload too — so say that plainly
  // rather than failing later and more obscurely.
  if (!presets || presets.length === 0) return { intents: [], problem: "server_outdated" };

  const presetDef = presets.find((p) => p.key === key);
  if (!presetDef?.shares?.length) return { intents: [], problem: "server_outdated" };

  const categories = prefill?.categories ?? [];
  const intents = presetDef.shares
    .map((share): CategoryIntentRequest | null => {
      const match = categories.find((c) => c.system_key === share.system_key);
      if (!match) return null;
      return {
        category_id: match.id,
        category_name: match.name,
        system_key: share.system_key,
        source: "preset" as const,
        // Zero on purpose: the server owns the allocation. Computing it here too
        // would mean two implementations of the same formula, free to drift
        // apart.
        amount_min: 0,
        amount_max: 0,
        locked: false,
      };
    })
    .filter((v): v is CategoryIntentRequest => v !== null);

  // Categories carry no system_key until migration 019 has run, so every preset
  // line resolves to nothing. Distinct from the case above: the server is new
  // enough to send presets but its database has not been migrated.
  if (intents.length === 0) return { intents, problem: "categories_unmigrated" };
  return { intents, problem: null };
}
