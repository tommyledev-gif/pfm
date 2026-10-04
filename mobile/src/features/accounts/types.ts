import { UserRole } from "@/lib/constants";
import { User } from "@/features/users/types";

// Mirrors backend/internal/dto/account_switch_dto.go.
export interface SwitchTokenResponse {
  switch_token: string;
  /** RFC 3339, UTC. */
  expires_at: string;
  user: User;
}

// POST /auth/switch and POST /auth/sessions/revoke-all share this shape.
export interface SwitchResponse {
  access_token: string;
  refresh_token: string;
  switch_token: string;
  /** RFC 3339, UTC. */
  switch_token_expires_at: string;
  user: User;
}

/**
 * One User remembered on this device (spec "Saved Account"). Never holds a
 * password or the switch token itself — the token lives under its own
 * SecureStore key. All dates are ISO UTC strings; screens render local time.
 */
export interface SavedAccount {
  userId: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  switchIssuedAt: string;
  switchExpiresAt: string;
  lastUsedAt: string;
  /** The server refused this account's switch token (401/400). */
  expired: boolean;
  /** The last switch got no answer, so its token may be used up (BR-16). */
  switchInterrupted: boolean;
}

/** What a fresh switch token is stored with. */
export interface IssuedSwitchToken {
  token: string;
  expiresAt: string;
}
