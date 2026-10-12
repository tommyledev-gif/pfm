import { SwitchResponse } from "@/features/accounts/types";
import { User } from "@/features/users/types";

// Mirrors dto.SearchUsersResponse (GET /admin/users/search) — one page of at
// most common.AccountSearchLimit accounts, no cursor.
export interface SearchUsersResult {
  data: User[];
}

// Mirrors dto.RevokeAllSessionsResponse — same shape as a switch: a fresh
// session pair + switch token for THIS device (spec BR-12).
export type RevokeAllSessionsResponse = SwitchResponse;
