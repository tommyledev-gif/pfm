import { formatCurrency } from "@/lib/currency";
import { formatDateShort } from "@/lib/format-date";
import { proposalCategoryName } from "@/features/ai-chat/proposal-kind";
import { ChatMessage } from "@/features/ai-chat/types";

interface RemovalCopyOptions {
  currency: string;
  resolveCategoryName: (id: string) => string | undefined;
}

export interface RemovalDialogCopy {
  title: string;
  message: string;
  confirmLabel: string;
}

/**
 * What the removal confirmation says.
 *
 * ⚠️ The persisted branch names the transaction — amount, category and date.
 * "Are you sure?" alone cannot be answered by someone holding two similar
 * proposals on screen. It also says where the record goes, because people
 * hesitate over deletes precisely because they fear losing the record, and
 * saying it is kept is what makes the action safe to take.
 *
 * The unconfirmed branch says the opposite thing on purpose: nothing is being
 * destroyed, and promising a history that does not exist would be worse than
 * saying nothing. Shared by the chat thread and the home pending list so the
 * two can never word the same decision differently.
 */
export function removalDialogCopy(
  message: ChatMessage | null,
  isPersisted: boolean,
  { currency, resolveCategoryName }: RemovalCopyOptions,
): RemovalDialogCopy {
  const payload = message?.action?.payload;
  if (!payload) return { title: "", message: "", confirmLabel: "Xóa" };

  if (!isPersisted) {
    return {
      title: "Bỏ đề xuất này?",
      message: "Đề xuất này chưa từng được lưu nên không có gì bị xóa. Nó vẫn nằm lại trong cuộc trò chuyện.",
      confirmLabel: "Bỏ",
    };
  }

  const name = payload.note || proposalCategoryName(payload, resolveCategoryName) || "Giao dịch";
  return {
    title: "Xóa giao dịch này?",
    message: [
      `${name} · ${formatCurrency(payload.amount, currency)} · ${formatDateShort(payload.occurred_at)}`,
      "",
      "Giao dịch sẽ biến mất khỏi danh sách nhưng vẫn được giữ trong nhật ký giao dịch.",
    ].join("\n"),
    confirmLabel: "Xóa",
  };
}
