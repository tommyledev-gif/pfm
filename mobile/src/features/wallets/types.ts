import { WalletCurrency, WalletType } from "@/lib/constants";
import type { WalletColorKey } from "@/lib/wallet-colors";

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
  // Card colour key (src/lib/wallet-colors.ts); null = automatic. Optional
  // because a backend from before card colours does not send it.
  color?: WalletColorKey | null;
  created_at: string;
  updated_at: string;
  // Shared wallets (specs/shared-wallets US-03). Optional for the same
  // reason: absent means the caller's own wallet with no members.
  access?: WalletAccess;
  owner_name?: string | null;
  member_count?: number;
}

/** What the signed-in User may do with a wallet. */
export type WalletAccess = "owner" | "editor" | "viewer";
export type WalletMemberRole = "editor" | "viewer";

/** One row of GET /wallets/{id}/members; the owner comes first with role "owner". */
export interface WalletMember {
  user_id: string;
  name: string;
  username: string | null;
  role: WalletAccess;
  status: "pending" | "active";
  invited_at: string | null;
  accepted_at: string | null;
  /** Invited by email, account not created yet. Absent from older servers. */
  account_pending?: boolean;
}

/**
 * GET /wallets/{id}/members/lookup: the account an invitation would reach,
 * found by an exact email or tên đăng nhập, and where that person already
 * stands with the wallet. Mirrors backend/internal/dto/wallet_invitee.go.
 */
export interface WalletInvitee {
  user_id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  membership: "none" | "pending" | "active" | "self";
}

/** A pending invitation to someone else's wallet (GET /wallets/invitations). */
export interface WalletInvitation {
  wallet_id: string;
  wallet_name: string;
  wallet_currency: WalletCurrency;
  wallet_color: WalletColorKey | null;
  role: WalletMemberRole;
  owner_name: string;
  invited_at: string;
}
