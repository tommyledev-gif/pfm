import { TransactionAdjustmentInput, TransactionItemInput } from "@/features/transactions/types";
import { TransactionActionPayload } from "@/features/ai-chat/types";

function itemKey(item: TransactionItemInput): string {
  return [item.name, item.quantity, item.unit_price ?? "", item.amount].join("|");
}

function adjustmentKey(a: TransactionAdjustmentInput): string {
  return [a.kind, a.direction ?? "", a.label ?? "", a.amount].join("|");
}

/**
 * Whether an edit changed the items or adjustments of a proposal. Editing a
 * confirmed proposal PATCHes its Transaction, and PATCH replaces both lists
 * whenever either is sent ([] removes them), so they are sent only when they
 * actually changed: an untouched list stays exactly as saved.
 */
export function proposalLinesChanged(before: TransactionActionPayload, after: TransactionActionPayload): boolean {
  const same = <T>(a: T[] = [], b: T[] = [], key: (x: T) => string) =>
    a.length === b.length && a.every((x, i) => key(x) === key(b[i]));
  return !same(before.items, after.items, itemKey) || !same(before.adjustments, after.adjustments, adjustmentKey);
}
