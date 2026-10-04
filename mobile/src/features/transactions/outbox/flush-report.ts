import { QueryClient } from "@tanstack/react-query";

import { checkBudgetLimit } from "@/features/budgets/check-budget-limit";
import { invalidateAfterTransactionCreated } from "@/features/transactions/api/create-transaction-request";
import { OutboxPayload } from "@/features/transactions/outbox/outbox-types";
import { Transaction } from "@/features/transactions/types";
import { useToastStore } from "@/stores/toast-store";

export const SYNC_COPY = {
  synced: (n: number) => `Đã đồng bộ ${n} giao dịch.`,
  failed: (n: number) => `${n} giao dịch không thể đồng bộ — vui lòng kiểm tra.`,
  replayDiffers: "Giao dịch này đã được lưu trước đó; thay đổi sau không được áp dụng. Hãy sửa trong danh sách.",
  serverError: "Lỗi máy chủ",
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
  if (failed > 0) toast.show(SYNC_COPY.failed(failed), "warning");
  else if (accepted.some(replayDiffers)) toast.show(SYNC_COPY.replayDiffers, "info");
  else toast.show(SYNC_COPY.synced(accepted.length), "info");

  if (accepted.length === 0) return;
  invalidateAfterTransactionCreated(queryClient);
  const checkedCategories = new Set<string>();
  for (const { transaction } of accepted) {
    if (checkedCategories.has(transaction.category_id)) continue;
    checkedCategories.add(transaction.category_id);
    await checkBudgetLimit(queryClient, transaction);
  }
}
