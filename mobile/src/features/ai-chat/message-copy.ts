import { formatCurrency } from "@/lib/currency";
import { formatDateDMY, formatTime } from "@/lib/format-date";
import { proposalAmountSign } from "@/features/ai-chat/proposal-kind";
import { TransactionActionPayload } from "@/features/ai-chat/types";

const COPY_LABELS = {
  date: "Ngày",
  amount: "Số tiền",
  category: "Danh mục",
  wallet: "Ví",
  createdAt: "Tạo lúc",
} as const;

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
  const lines = [
    `${COPY_LABELS.date}: ${formatDateDMY(payload.occurred_at)}`,
    `${COPY_LABELS.amount}: ${sign}${formatCurrency(payload.amount, currency)}`,
    `${COPY_LABELS.category}: ${categoryName}`,
    `${COPY_LABELS.wallet}: ${walletName}`,
  ];
  if (createdAtMs !== undefined) {
    lines.push(`${COPY_LABELS.createdAt}: ${formatTime(new Date(createdAtMs).toISOString())}`);
  }
  return lines.join("\n");
}
