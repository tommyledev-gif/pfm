import { ErrorCodeKeys, errorText, getErrorCode } from "@/lib/api-envelope";
import { i18n, TranslationKey } from "@/lib/i18n";

// Client copy for the codes the line-item and wallet-move features add
// (pfm-ux-copy: branch on error_code, the server message is never shown).
// Every one is refused before anything is written server-side, so the
// balance really is unchanged. TRANSACTION_CHANGED is absent: it is shown as
// StaleEditDialog instead of an inline line.
export const SAVE_ERROR_KEYS: ErrorCodeKeys = {
  ITEMS_TOTAL_MISMATCH: "transactions.saveError.ITEMS_TOTAL_MISMATCH",
  ITEMS_NOT_ALLOWED: "transactions.items.notOnTransfer",
  // Changing the wallet of a saved one (PATCH wallet_id). The forms only
  // offer same-currency wallets, so these are backstops.
  WALLET_CURRENCY_MISMATCH: "transactions.saveError.WALLET_CURRENCY_MISMATCH",
  TRANSFER_WALLET_IMMUTABLE: "transactions.saveError.TRANSFER_WALLET_IMMUTABLE",
  WALLET_NOT_FOUND: "transactions.saveError.WALLET_NOT_FOUND",
};

/** Inline error under the Transaction form, or null when another UI handles it. */
export function transactionSaveErrorMessage(error: unknown): string | null {
  if (isStaleEditError(error)) return null;
  return errorText(error, "errors.saveTransactionFallback", SAVE_ERROR_KEYS);
}

/**
 * The sentence for a refused save known only by its error_code — a failed
 * outbox item stores the code, and is put into words when shown (spec BR-10),
 * so it follows the language. Undefined when the code has no sentence.
 */
export function saveErrorKey(code: string): TranslationKey | undefined {
  const own = SAVE_ERROR_KEYS[code];
  if (own) return own;
  const shared = `errors.code.${code}`;
  return i18n.exists(shared) ? (shared as TranslationKey) : undefined;
}

export function isStaleEditError(error: unknown): boolean {
  return getErrorCode(error) === "TRANSACTION_CHANGED";
}
