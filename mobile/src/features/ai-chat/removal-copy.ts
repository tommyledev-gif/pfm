import { formatCurrency } from "@/lib/currency";
import { formatDateShort } from "@/lib/format-date";
import { i18n } from "@/lib/i18n";
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
 *
 * Read at call time, during render, in the app's current language.
 */
export function removalDialogCopy(
  message: ChatMessage | null,
  isPersisted: boolean,
  { currency, resolveCategoryName }: RemovalCopyOptions,
): RemovalDialogCopy {
  const payload = message?.action?.payload;
  if (!payload) return { title: "", message: "", confirmLabel: i18n.t("common.action.delete") };

  if (!isPersisted) {
    return {
      title: i18n.t("chat.removal.discard.title"),
      message: i18n.t("chat.removal.discard.body"),
      confirmLabel: i18n.t("common.action.discard"),
    };
  }

  const name = payload.note || proposalCategoryName(payload, resolveCategoryName) || i18n.t("chat.proposal.fallbackName");
  return {
    title: i18n.t("chat.removal.delete.title"),
    message: [
      i18n.t("chat.removal.delete.summary", {
        name,
        amount: formatCurrency(payload.amount, currency),
        date: formatDateShort(payload.occurred_at),
      }),
      "",
      i18n.t("chat.removal.delete.body"),
    ].join("\n"),
    confirmLabel: i18n.t("common.action.delete"),
  };
}
