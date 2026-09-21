import { BudgetProposalsResponse, ProposalEntry } from "@/features/budget-wizard/types";

// Pure transforms on a proposal, split out of useBudgetWizardState so that hook
// stays state and transitions only (CLAUDE.md's 300-line rule).
//
// ⚠️ ONE INVARIANT RUNS THROUGH ALL THREE: the buffer absorbs every change, and
// no row the user did not touch is ever rewritten. Re-asking the server after an
// edit would re-run the allocator and rebalance the untouched rows — the app
// overruling a decision it was not asked to revisit. `unallocated_amount` is
// therefore always re-derived as `disposable − sum(amount_max)`, never adjusted
// by a delta, so it cannot drift out of step with the rows it describes.

/** A row the user pinned to a figure of their own. */
export function withEditedAmount(
  response: BudgetProposalsResponse,
  categoryId: string,
  amountXu: number,
): BudgetProposalsResponse {
  const proposals: ProposalEntry[] = response.proposals.map((p) =>
    p.category_id === categoryId
      ? { ...p, amount_min: amountXu, amount_max: amountXu, source: "manual", locked: true }
      : p,
  );
  return reconcile(response, proposals);
}

/**
 * Append a row the user asked for, funded out of the buffer.
 *
 * Picking a category already on the plan updates that row instead of adding a
 * second one — two rows for one category would both be written as budgets and
 * the later one would silently win server-side.
 */
export function withAddedRow(
  response: BudgetProposalsResponse,
  categoryId: string,
  name: string,
  amountXu: number,
): BudgetProposalsResponse {
  const exists = response.proposals.some((p) => p.category_id === categoryId);
  const proposals: ProposalEntry[] = exists
    ? response.proposals.map((p) =>
        p.category_id === categoryId
          ? { ...p, amount_min: amountXu, amount_max: amountXu, source: "manual", locked: true }
          : p,
      )
    : [
        ...response.proposals,
        {
          category_id: categoryId,
          category_name: name,
          amount_min: amountXu,
          amount_max: amountXu,
          source: "manual" as const,
          locked: true,
          confidence: 1,
        },
      ];
  return reconcile(response, proposals);
}

export function withRemovedRow(response: BudgetProposalsResponse, categoryId: string): BudgetProposalsResponse {
  return reconcile(
    response,
    response.proposals.filter((p) => p.category_id !== categoryId),
  );
}

function reconcile(response: BudgetProposalsResponse, proposals: ProposalEntry[]): BudgetProposalsResponse {
  const allocated = proposals.reduce((sum, p) => sum + p.amount_max, 0);
  return { ...response, proposals, unallocated_amount: response.disposable - allocated };
}
