import { WalletCurrency } from "@/lib/constants";
import { Wallet } from "@/features/wallets/types";
import { isOwnWallet } from "@/features/wallets/wallet-access";

// Home's hero card shows a single balance number, but wallets can carry
// different currencies — sum only the wallets sharing the primary currency
// (the default wallet's, or the first wallet's if none is default) rather
// than adding incompatible currencies together.
//
// Only the User's own wallets count (specs/shared-wallets BR-10): a wallet
// someone shared with them is that person's money, and counting it here
// would count a household's shared wallet once per member.
export function primaryCurrency(wallets: Wallet[]): WalletCurrency | undefined {
  const own = wallets.filter(isOwnWallet);
  return own.find((w) => w.is_default)?.currency ?? own[0]?.currency;
}

export function totalBalance(wallets: Wallet[]): { amount: number; currency: WalletCurrency } | null {
  const currency = primaryCurrency(wallets);
  if (!currency) return null;
  const amount = wallets
    .filter((w) => isOwnWallet(w) && w.currency === currency)
    .reduce((sum, w) => sum + w.balance, 0);
  return { amount, currency };
}
