import { WalletCurrency } from "@/lib/constants";
import { Wallet } from "@/features/wallets/types";

// Home's hero card shows a single balance number, but wallets can carry
// different currencies — sum only the wallets sharing the primary currency
// (the default wallet's, or the first wallet's if none is default) rather
// than adding incompatible currencies together.
export function primaryCurrency(wallets: Wallet[]): WalletCurrency | undefined {
  return wallets.find((w) => w.is_default)?.currency ?? wallets[0]?.currency;
}

export function totalBalance(wallets: Wallet[]): { amount: number; currency: WalletCurrency } | null {
  const currency = primaryCurrency(wallets);
  if (!currency) return null;
  const amount = wallets.filter((w) => w.currency === currency).reduce((sum, w) => sum + w.balance, 0);
  return { amount, currency };
}
