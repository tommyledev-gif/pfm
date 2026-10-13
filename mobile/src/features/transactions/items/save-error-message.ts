import { getErrorCode, getErrorMessage } from "@/lib/axios";

const SAVE_FALLBACK = "Không thể lưu giao dịch";

// Client copy for the codes the line-item and wallet-move features add
// (pfm-ux-copy: branch on error_code, the server message is only the
// fallback). Every one is refused before anything is written server-side, so
// the balance really is unchanged.
const LINE_ERROR_COPY: Record<string, string | null> = {
  ITEMS_TOTAL_MISMATCH: "Chưa lưu được. Tổng các món lệch số tiền giao dịch. Số dư chưa thay đổi.",
  ITEMS_NOT_ALLOWED: "Giao dịch chuyển tiền không có món.",
  // Changing the wallet of a saved one (PATCH wallet_id). The forms only
  // offer same-currency wallets, so these are backstops.
  WALLET_CURRENCY_MISMATCH: "Chưa lưu được. Chỉ đổi sang ví cùng loại tiền. Số dư chưa thay đổi.",
  TRANSFER_WALLET_IMMUTABLE: "Chưa lưu được. Giao dịch chuyển tiền không đổi được ví. Số dư chưa thay đổi.",
  WALLET_NOT_FOUND: "Chưa lưu được. Không tìm thấy ví đã chọn. Số dư chưa thay đổi.",
  // Shown as StaleEditDialog instead of an inline line.
  TRANSACTION_CHANGED: null,
};

/** Inline error under the Transaction form, or null when another UI handles it. */
export function transactionSaveErrorMessage(error: unknown): string | null {
  const code = getErrorCode(error);
  if (code && code in LINE_ERROR_COPY) return LINE_ERROR_COPY[code];
  return getErrorMessage(error, SAVE_FALLBACK);
}

export function isStaleEditError(error: unknown): boolean {
  return getErrorCode(error) === "TRANSACTION_CHANGED";
}
