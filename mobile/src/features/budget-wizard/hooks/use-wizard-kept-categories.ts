import { useCallback, useState } from "react";

import { BudgetProposalsResponse, ProposalEntry } from "@/features/budget-wizard/types";

/** One category the user chose to carry across a step-back. Amounts are
 *  deliberately absent — see the hook's note. */
export interface KeptCategory {
  categoryId: string;
  name: string;
  /** True for a row the user invented; it exists in no preset and has to be
   *  re-appended rather than merely kept. */
  added: boolean;
  /** Set only when the category does not exist on the server yet. */
  pendingName?: string;
}

export interface KeptPlanShape {
  kept: KeptCategory[];
  /** Ids of suggested rows the user removed. A removal is a decision and must
   *  survive the round trip, or "keep" silently resurrects it. */
  removedIds: string[];
}

/**
 * What survives stepping back to change an earlier answer.
 *
 * ⚠️ Categories, never amounts. Every amount on the result screen is a share
 * of what is left after income, fixed costs and savings — and those are
 * precisely what the user went back to change. Carrying a figure forward
 * would present arithmetic derived from inputs that no longer exist as if it
 * were a saved preference.
 *
 * ⚠️ This is NOT the saved-plan feature. That is an explicit, persisted choice
 * for a future run and it does restore amounts. This is in-session continuity
 * within one run, held in memory, written nowhere, and the two never read each
 * other.
 */
export function useWizardKeptCategories() {
  const [keptPlan, setKeptPlan] = useState<KeptPlanShape | null>(null);

  const remember = useCallback(
    (proposals: ProposalEntry[], addedIds: string[], pendingCategories: Record<string, string>, removedIds: string[]) => {
      setKeptPlan({
        kept: proposals.map((p) => ({
          categoryId: p.category_id,
          name: p.category_name,
          added: addedIds.includes(p.category_id),
          pendingName: pendingCategories[p.category_id],
        })),
        removedIds,
      });
    },
    [],
  );

  const forget = useCallback(() => setKeptPlan(null), []);

  return { keptPlan, remember, forget };
}

/**
 * Lays a kept category set over a freshly computed proposal.
 *
 * ⚠️ Applied as a diff, not as a replacement. A user who also changed their
 * spending profile asked a different question, and that profile's own rows
 * must still appear — suppressing them with answers given about the previous
 * profile would overrule the choice just made. So only categories the user
 * explicitly removed are dropped, and only categories the user explicitly
 * added are re-appended.
 *
 * Every amount comes from `response`. Nothing is carried over.
 */
export function applyKeptCategories(
  response: BudgetProposalsResponse,
  keptPlan: KeptPlanShape,
): BudgetProposalsResponse {
  const removed = new Set(keptPlan.removedIds);
  const surviving = response.proposals.filter((p) => !removed.has(p.category_id));
  const present = new Set(surviving.map((p) => p.category_id));

  const reAdded: ProposalEntry[] = keptPlan.kept
    .filter((row) => row.added && !present.has(row.categoryId))
    .map((row) => ({
      category_id: row.categoryId,
      category_name: row.name,
      // Zero until the user sets it: the allocator knows nothing about a
      // category it never proposed, and inventing a figure here would be the
      // guess this whole hook exists to avoid.
      amount_min: 0,
      amount_max: 0,
      source: "manual" as const,
      locked: false,
      confidence: 1,
    }));

  const proposals = [...surviving, ...reAdded];
  const allocated = proposals.reduce((sum, p) => sum + p.amount_max, 0);
  return { ...response, proposals, unallocated_amount: response.disposable - allocated };
}
