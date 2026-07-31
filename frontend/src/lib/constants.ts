// App-wide constants — no magic values inline in components (dev.md rule).
// Numbers here mirror backend/internal/common/constants.go so the two never drift.

export const SESSION_COOKIE_NAME = "PFM_SESSION";
export const REFRESH_COOKIE_NAME = "PFM_REFRESH";

// Mirrors common.AccessTokenTTL / common.RefreshTokenTTL (backend/internal/common/constants.go).
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

// Mirrors common.DefaultListLimit.
export const DEFAULT_PAGE_SIZE = 20;

// Mirrors common.MinPasswordLength — client-side check is a UX aid only,
// the backend is the source of truth (implementation-checklist.md).
export const MIN_PASSWORD_LENGTH = 8;

export const ROUTES = {
  login: "/login",
  activate: "/activate",
  app: "/app",
  users: "/app/users",
} as const;

export const USER_ROLES = ["admin", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["pending", "active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
