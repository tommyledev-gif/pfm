import { PROPOSAL_CURRENCY } from "@/lib/constants";
import { TransactionActionPayload } from "@/features/ai-chat/types";
import { Wallet } from "@/features/wallets/types";

/** Shown on a card that cannot be saved until a VND Wallet is chosen. */
export const WALLET_REQUIRED_MESSAGE = "Chọn ví VND để lưu giao dịch.";
/** Wallet label for a proposal that has no Wallet yet. */
export const NO_WALLET_LABEL = "Chưa chọn ví";
/** Edit-form hint when the User owns no VND Wallet at all. */
export const NO_VND_WALLET_HINT = "Chưa có ví VND. Tạo ví VND để lưu giao dịch.";

/**
 * Whether an AI proposal can be saved as-is. The amount was read as VND and
 * is never converted (spec BR-13), so a proposal without a Wallet (the User
 * has no VND Wallet) or on a known non-VND Wallet (kept from before that
 * rule) must go through the edit form first (AC-31, AC-32).
 *
 * A Wallet id missing from the map (deleted since) counts as savable on
 * purpose: the confirm then fails with the backend's existing not-found
 * error on that card (spec EC-21) instead of silently doing nothing.
 */
export function isSavableProposal(payload: TransactionActionPayload, walletById: Map<string, Wallet>): boolean {
  if (payload.wallet_id === null) return false;
  const wallet = walletById.get(payload.wallet_id);
  return !wallet || wallet.currency === PROPOSAL_CURRENCY;
}
