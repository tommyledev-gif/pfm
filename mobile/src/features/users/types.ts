import { UserRole, UserStatus } from "@/lib/constants";

// Mirrors backend/internal/dto/user_response.go's UserResponse — the
// explicit field whitelist (no password_hash/invite_token/invite_expires_at).
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  // Tên đăng nhập, chosen once at activation; null for accounts activated
  // before it existed and for anyone not activated yet.
  username: string | null;
  status: UserStatus;
  role: UserRole;
  activated_at: string | null;
  created_at: string;
  // Public URL of the uploaded avatar; null = none. Filled by GET /users/me
  // and the account-switch responses, null in the admin user list.
  avatar_url: string | null;
  // Pending users only: the earliest moment POST
  // /admin/users/:id/resend-invite accepts (1 minute after the invite, then
  // 30 minutes after each resend). null for active/disabled users.
  invite_resend_available_at: string | null;
}

// GET /users/me (backend dto.MeResponse): the caller's own User plus what the
// app should offer them. can_delete_accounts is missing from a backend older
// than the field, which reads as false.
export interface Me extends User {
  can_delete_accounts?: boolean;
}

export interface PaginationInfo {
  next_cursor: string | null;
  total: number;
}

export interface ListUsersResult {
  data: User[];
  pagination: PaginationInfo;
}

export interface InviteUserRequest {
  email: string;
  role: UserRole;
}

export interface InviteUserResult {
  user_id: string;
  email: string;
  status: UserStatus;
  invite_expires_at: string;
}
