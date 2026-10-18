import { TransactionAdjustmentInput, TransactionItemInput } from "@/features/transactions/types";
import { ProposalReviewLines, TransactionActionPayload } from "@/features/ai-chat/types";

// Lines of an image proposal read with doubt (specs/ai-chat-image-capture
// BR-16). The server sends indexes; the client keeps content keys instead, so
// a mark stays on its line when the list is reordered and disappears once the
// User changes that line (the key no longer matches anything).

export function itemReviewKey(item: TransactionItemInput): string {
  return ["item", item.name, item.quantity, item.amount].join("|");
}

export function adjustmentReviewKey(adjustment: TransactionAdjustmentInput): string {
  return ["adjustment", adjustment.kind, adjustment.amount].join("|");
}

/** Keys of the marked lines, from the indexes the server sent. */
export function toReviewLineKeys(payload: TransactionActionPayload, review?: ProposalReviewLines): string[] {
  if (!review) return [];
  const items = payload.items ?? [];
  const adjustments = payload.adjustments ?? [];
  return [
    ...review.items.filter((i) => items[i]).map((i) => itemReviewKey(items[i])),
    ...review.adjustments.filter((i) => adjustments[i]).map((i) => adjustmentReviewKey(adjustments[i])),
  ];
}

/** The marks that still match a line after an edit. */
export function survivingReviewLineKeys(keys: string[] | undefined, payload: TransactionActionPayload): string[] {
  if (!keys?.length) return [];
  const present = new Set([
    ...(payload.items ?? []).map(itemReviewKey),
    ...(payload.adjustments ?? []).map(adjustmentReviewKey),
  ]);
  return keys.filter((key) => present.has(key));
}
