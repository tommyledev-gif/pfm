import { WalletCurrency, WalletType } from "@/lib/constants";

// Mirrors backend/internal/dto/wallet_response.go /
// frontend/src/features/wallets/types.ts exactly.
export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  balance: number; // integer cents
  currency: WalletCurrency;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
