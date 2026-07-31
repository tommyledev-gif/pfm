import type { UserRole, UserStatus } from "@/lib/constants";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  status: UserStatus;
  role: UserRole;
  activated_at: string | null;
  created_at: string;
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
