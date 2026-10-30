import { formatCurrency } from "@/lib/currency";
import { formatDateDMY, formatTime } from "@/lib/format-date";
import { i18n } from "@/lib/i18n";
import { proposalAmountSign } from "@/features/ai-chat/proposal-kind";
import { TransactionActionPayload } from "@/features/ai-chat/types";

interface ProposalCopyInput {
  payload: TransactionActionPayload;
  categoryName: string;
  walletName: string;
  /** The proposal Wallet's currency. */
  currency: string;
  /** When the proposal appeared in the chat (epoch ms); omitted when unknown. */
  createdAtMs?: number;
}

/**
 * A Transaction proposal as plain text, one field per line — the record, not
 * the assistant's sentence around it. The amount is the full figure in the
 * Wallet's currency (never the shortened "1,2 tr" form) with the same sign
 * the card shows. Dates and times are in the device's local zone.
 */
export function formatProposalForCopy({
  payload,
  categoryName,
  walletName,
  currency,
  createdAtMs,
}: ProposalCopyInput): string {
  const sign = proposalAmountSign(payload.type);
  // One key per line ("Ngày: {{date}}"), read at copy time: the copied text
  // is in the language of the moment.
  const lines = [
    i18n.t("chat.copyText.date", { date: formatDateDMY(payload.occurred_at) }),
    i18n.t("chat.copyText.amount", { amount: `${sign}${formatCurrency(payload.amount, currency)}` }),
    i18n.t("chat.copyText.category", { category: categoryName }),
    i18n.t("chat.copyText.wallet", { wallet: walletName }),
  ];
  if (createdAtMs !== undefined) {
    lines.push(i18n.t("chat.copyText.createdAt", { time: formatTime(new Date(createdAtMs).toISOString()) }));
  }
  return lines.join("\n");
}
