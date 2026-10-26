import { Wallet } from "@/features/wallets/types";

// Shared wallets (specs/shared-wallets): GET /wallets?include_shared=true
// returns the User's own wallets and the ones shared with them. Most screens
// need one of these three slices of it.

/** The User's own wallet. A wallet from an older backend (no `access`) is. */
export const isOwnWallet = (wallet: Wallet) => (wallet.access ?? "owner") === "owner";

/** May the User record transactions into it (owner or editor)? */
export const canRecordInto = (wallet: Wallet) => wallet.access !== "viewer";

/** Shared with someone: either the User's own with members, or someone else's. */
export const isSharedWallet = (wallet: Wallet) => !isOwnWallet(wallet) || (wallet.member_count ?? 0) > 0;

/** The ids of the shared ones, for marking their transactions in a mixed list. */
export const sharedWalletIds = (wallets: Wallet[] | undefined) =>
  new Set((wallets ?? []).filter(isSharedWallet).map((w) => w.id));

/** A transaction touches a shared wallet: its own, or a transfer's other end. */
export const touchesSharedWallet = (ids: Set<string>, t: { wallet_id: string; to_wallet_id: string | null }) =>
  ids.has(t.wallet_id) || (t.to_wallet_id !== null && ids.has(t.to_wallet_id));
