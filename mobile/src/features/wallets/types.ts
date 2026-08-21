import { WalletCurrency, WalletType } from "@/lib/constants";

// Mirrors backend/internal/dto/wallet_response.go /
// frontend/src/features/wallets/types.ts exactly. icon/icon_url added by
// specs/wallet-budget-icons/spec.md — icon_url (an uploaded photo, via
// POST /wallets/icon) takes display precedence over icon (a free-text
// emoji/label) when both are set, same convention as Category.
export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  balance: number; // integer cents
  currency: WalletCurrency;
  is_default: boolean;
  icon: string | null;
  icon_url: string | null;
  created_at: string;
  updated_at: string;
}
