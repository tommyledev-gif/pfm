import { PROPOSAL_CURRENCY, TransactionKind } from "@/lib/constants";
import { i18n } from "@/lib/i18n";
import { ChatMessage, SavedProposalPatch, TransactionActionPayload } from "@/features/ai-chat/types";
import { Wallet } from "@/features/wallets/types";

// Locale keys; the components pass them to t().
/** Shown on a card that cannot be saved until a VND Wallet is chosen. */
export const WALLET_REQUIRED_MESSAGE = "chat.proposal.walletRequired";
/** Wallet label for a proposal that has no Wallet yet. */
export const NO_WALLET_LABEL = "chat.proposal.noWallet";
/** Edit-form hint when the User owns no VND Wallet at all. */
export const NO_VND_WALLET_HINT = "chat.proposal.noVndWallet";

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
  // The edit form never saves a transfer without one; this only guards a
  // payload changed some other way.
  if (payload.type === "transfer" && !payload.to_wallet_id) return false;
  const wallet = walletById.get(payload.wallet_id);
  return !wallet || wallet.currency === PROPOSAL_CURRENCY;
}

/**
 * Whether the User may no longer write to a Wallet this proposal touches
 * (specs/shared-wallets BR-05, BR-07): a shared one they were made a viewer
 * of, or left. `writable` is the "writable" Wallet list, undefined while it
 * loads, which locks nothing.
 */
export function lostWriteAccess(
  payload: Pick<TransactionActionPayload, "wallet_id" | "to_wallet_id">,
  writable: Wallet[] | undefined,
): boolean {
  if (!writable) return false;
  return [payload.wallet_id, payload.to_wallet_id].some((id) => Boolean(id) && !writable.some((w) => w.id === id));
}

/**
 * A saved proposal whose Transaction the User can no longer edit or delete:
 * only its recorder may, and only while they can still write to every Wallet
 * it touches (BR-07), so the server refuses both with 403. An unsaved one is
 * never locked: its Wallet is picked again from the writable ones.
 */
export function isWriteRevoked(message: ChatMessage, writable: Wallet[] | undefined): boolean {
  const payload = message.action?.payload;
  if (!message.confirmed || !message.transactionId || !payload) return false;
  return lostWriteAccess(payload, writable);
}

/** The Wallet a proposal names: "Chưa chọn ví" without one, "A → B" for a transfer. In the current language. */
export function proposalWalletName(payload: TransactionActionPayload, walletById: Map<string, Wallet>): string {
  const nameOf = (id: string) => walletById.get(id)?.name ?? i18n.t("common.field.wallet");
  const source = payload.wallet_id === null ? i18n.t(NO_WALLET_LABEL) : nameOf(payload.wallet_id);
  return payload.type === "transfer" && payload.to_wallet_id ? `${source} → ${nameOf(payload.to_wallet_id)}` : source;
}

/**
 * How far an image proposal's lines are from its amount, in xu: items, plus
 * tax and fee, minus discounts. 0 when they add up or there are no items.
 * Image proposals keep the printed total even when the lines miss it
 * (spec BR-15); typed proposals always add up.
 */
export function proposalLinesGap(payload: TransactionActionPayload): number {
  const items = payload.items ?? [];
  if (items.length === 0) return 0;
  let total = items.reduce((sum, item) => sum + item.amount, 0);
  for (const adjustment of payload.adjustments ?? []) {
    const direction = adjustment.direction ?? (adjustment.kind === "discount" ? "subtract" : "add");
    total += direction === "subtract" ? -adjustment.amount : adjustment.amount;
  }
  return total - payload.amount;
}

/**
 * The wallet and type part of a saved proposal's PATCH: the wallet it moved
 * to, and the type it changed to, with a new transfer's destination. Each
 * only when it changed, since the server moves balances for each.
 */
export function savedMovePatch(
  original: TransactionActionPayload,
  wallet: Wallet,
  type: TransactionKind,
  destination: Wallet | null,
): SavedProposalPatch {
  const retyped = type !== original.type;
  return {
    ...(wallet.id !== original.wallet_id ? { wallet_id: wallet.id } : {}),
    ...(retyped ? { type } : {}),
    ...(retyped && type === "transfer" && destination ? { to_wallet_id: destination.id } : {}),
  };
}

/**
 * Whether "confirm all" on the pending-review screen may save this card.
 * ⚠️ A card that looks like a saved Transaction is skipped and counted as not
 * saved (spec BR-17): saving it is the User's call, on the card itself.
 */
export function isConfirmAllEligible(message: ChatMessage): boolean {
  return Boolean(message.action) && !message.action?.possible_duplicate && proposalLinesGap(message.action!.payload) === 0;
}
