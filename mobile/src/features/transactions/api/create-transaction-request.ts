import { QueryClient } from "@tanstack/react-query";

import { checkBudgetLimit } from "@/features/budgets/check-budget-limit";
import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";
import { CreateTransactionRequest, Transaction } from "@/features/transactions/types";

interface CreateTransactionOptions {
  // Set by the outbox flusher: the request is cancelled rather than sent
  // with any other User's session (specs/mobile-offline-support BR-OFF-P06).
  ownerUserId?: string;
}

/** POST /transactions — shared by the online form/proposal path and the outbox flusher. */
export async function createTransactionRequest(
  body: CreateTransactionRequest,
  { ownerUserId }: CreateTransactionOptions = {},
): Promise<Transaction> {
  const res = await apiClient.post<ApiEnvelope<Transaction>>("/transactions/", body, { ownerUserId });
  return unwrap(res.data);
}

/** Refreshes what a new Transaction changes server-side; nothing is patched by hand. */
export function invalidateAfterTransactionCreated(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ["transactions"] });
  queryClient.invalidateQueries({ queryKey: ["wallets"] });
  queryClient.invalidateQueries({ queryKey: ["report-summary"] });
}

export async function afterTransactionCreated(queryClient: QueryClient, transaction: Transaction): Promise<void> {
  invalidateAfterTransactionCreated(queryClient);
  // Refetches budgets itself (fresher than a bare invalidate, see that
  // helper's doc comment) and updates the ["budgets"] cache as a side
  // effect — no separate invalidateQueries(["budgets"]) needed.
  await checkBudgetLimit(queryClient, transaction);
}
