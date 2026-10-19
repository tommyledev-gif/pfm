import { SwitchResponse } from "@/features/accounts/types";
import { User } from "@/features/users/types";

// Mirrors dto.SearchUsersResponse (GET /admin/users/search) — one page of at
// most common.AccountSearchLimit accounts, no cursor.
export interface SearchUsersResult {
  data: User[];
}

// Mirrors dto.RevokeAllSessionsResponse — same shape as a switch: a fresh
// session pair for THIS device (spec BR-12).
export type RevokeAllSessionsResponse = SwitchResponse;

// Mirrors dto.DeviceSessionResponse (GET /auth/sessions): a device the User
// is signed in on, or saved as a switchable account on.
export interface DeviceSession {
  id: string;
  /** What the phone called itself; null for web and older sessions. */
  device_name: string | null;
  /** RFC 3339, UTC. */
  created_at: string;
  /** RFC 3339, UTC. Moves on each renewal, about every 12 min in use. */
  last_used_at: string;
  is_current: boolean;
}

// Mirrors dto.ChangePasswordRequest (PUT /users/me/password).
export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}
