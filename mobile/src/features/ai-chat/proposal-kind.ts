import { TRANSACTION_KIND_LABELS, TransactionKind } from "@/lib/constants";
import { TransactionActionPayload } from "@/features/ai-chat/types";

/**
 * The sign a proposal's amount is shown with. A transfer only moves money
 * between the User's own wallets, neither a gain nor a loss, so (as on
 * TransactionRow) it carries none.
 */
export function proposalAmountSign(type: TransactionKind): string {
  if (type === "transfer") return "";
  return type === "income" ? "+" : "-";
}

/**
 * The category a proposal is shown under. A transfer is filed under the
 * server's own system category, so the one it carried before the User made it
 * a transfer (kept on the payload for switching back) is never named.
 */
export function proposalCategoryName(
  payload: Pick<TransactionActionPayload, "type" | "category_id">,
  resolveCategoryName: (id: string) => string | undefined,
): string | undefined {
  return payload.type === "transfer" ? TRANSACTION_KIND_LABELS.transfer : resolveCategoryName(payload.category_id);
}
