import type { WalletCurrency, WalletType } from "@/lib/constants";

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  balance: number;
  currency: WalletCurrency;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface ListWalletsResult {
  data: Wallet[];
}

export interface CreateWalletRequest {
  name: string;
  type: WalletType;
  currency?: WalletCurrency;
  initial_balance?: number;
  is_default?: boolean;
}

export interface UpdateWalletRequest {
  name?: string;
  type?: WalletType;
}
