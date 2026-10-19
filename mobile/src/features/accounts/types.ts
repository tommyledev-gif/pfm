import { UserRole } from "@/lib/constants";
import { User } from "@/features/users/types";

// Mirrors backend/internal/dto/account_switch_dto.go. POST /auth/switch
// (only to trade a switch token left by an older build) and
// POST /auth/sessions/revoke-all share this shape. The switch token comes
// back only from a server that predates device-bound sessions; this app
// never keeps one.
export interface SwitchResponse {
  access_token: string;
  refresh_token: string;
  switch_token?: string;
  /** RFC 3339, UTC. */
  switch_token_expires_at?: string;
  user: User;
}

/**
 * One User remembered on this device (spec "Saved Account"). Never holds a
 * password or a token — the account's own refresh token (its session on
 * this device) lives under its own SecureStore key (lib/account-tokens.ts).
 * All dates are ISO UTC strings; screens render local time.
 */
export interface SavedAccount {
  userId: string;
  email: string;
  fullName: string | null;
  // Tên đăng nhập. Undefined on accounts saved before it was kept.
  username?: string | null;
  // Undefined on accounts saved before avatars existed.
  avatarUrl?: string | null;
  role: UserRole;
  /** When its session on this device runs out (the refresh token's exp). */
  expiresAt: string;
  lastUsedAt: string;
  /**
   * The server refused this account's session (401/400): expired, signed out
   * from another device, password changed. Shown as "Hết phiên"; the next
   * sign-in needs the password (or a passkey).
   */
  expired: boolean;
  /** The last switch got no answer, so its token may be used up (BR-16). */
  switchInterrupted: boolean;
}
