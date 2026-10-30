import { QueryClient } from "@tanstack/react-query";

import { i18n } from "@/lib/i18n";
import { checkBudgetLimit } from "@/features/budgets/check-budget-limit";
import { invalidateAfterTransactionCreated } from "@/features/transactions/api/create-transaction-request";
import { OutboxPayload } from "@/features/transactions/outbox/outbox-types";
import { Transaction } from "@/features/transactions/types";
import { useToastStore } from "@/stores/toast-store";

// Keys, translated when the toast is shown. serverError is read by
// flush-outbox.ts as the stored text of a failed item, so it is translated
// at that moment (a getter).
export const SYNC_COPY = {
  synced: "transactions.sync.synced",
  failed: "transactions.sync.failed",
  replayDiffers: "transactions.sync.replayDiffers",
  get serverError(): string {
    return i18n.t("transactions.sync.serverError");
  },
} as const;

export interface AcceptedSend {
  payload: OutboxPayload;
  transaction: Transaction;
}

export interface FlushOutcome {
  accepted: AcceptedSend[];
  failed: number;
}

const DATE_ONLY_LENGTH = 10;

// EC-OFF-17: an edit made after a lost-answer send cannot win — the server
// answers the key with the version it already booked.
function replayDiffers({ payload, transaction }: AcceptedSend): boolean {
  return (
    transaction.amount !== payload.amount ||
    transaction.wallet_id !== payload.wallet_id ||
    transaction.type !== payload.type ||
    (payload.category_id !== undefined && transaction.category_id !== payload.category_id) ||
    (payload.occurred_at !== undefined &&
      transaction.occurred_at.slice(0, DATE_ONLY_LENGTH) !== payload.occurred_at.slice(0, DATE_ONLY_LENGTH)) ||
    (transaction.note ?? "") !== (payload.note ?? "")
  );
}

/**
 * After a run: refresh what changed, then one summary toast, then the budget
 * checks — a budget alert, being more actionable, takes the single toast slot
 * last (plan Finding #10). Balances always come from the server (EC-OFF-18).
 */
export async function reportFlush(queryClient: QueryClient, { accepted, failed }: FlushOutcome): Promise<void> {
  if (accepted.length === 0 && failed === 0) return;
  const toast = useToastStore.getState();
  if (failed > 0) toast.show(i18n.t(SYNC_COPY.failed, { count: failed }), "warning");
  else if (accepted.some(replayDiffers)) toast.show(i18n.t(SYNC_COPY.replayDiffers), "info");
  else toast.show(i18n.t(SYNC_COPY.synced, { count: accepted.length }), "info");

  if (accepted.length === 0) return;
  invalidateAfterTransactionCreated(queryClient);
  const checkedCategories = new Set<string>();
  for (const { transaction } of accepted) {
    if (checkedCategories.has(transaction.category_id)) continue;
    checkedCategories.add(transaction.category_id);
    await checkBudgetLimit(queryClient, transaction);
  }
}
