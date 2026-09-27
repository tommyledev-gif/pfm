// App-wide constants — no magic values inline in components (dev.md rule,
// same convention as frontend/src/lib/constants.ts). Numbers here mirror
// backend/internal/common/constants.go so mobile and web never drift apart
// from the backend's own source of truth.

export const SECURE_STORE_ACCESS_TOKEN_KEY = "pfm_access_token";
export const SECURE_STORE_REFRESH_TOKEN_KEY = "pfm_refresh_token";
// There is no GET /users/me endpoint and the JWT's AccessClaims only carry
// user_id/role (backend/internal/service/token_service.go) — no name/email.
// The login email is captured client-side and persisted here so Settings has
// something to display; it is not re-verified against the server.
export const SECURE_STORE_EMAIL_KEY = "pfm_user_email";
// Device-local timestamp (ms since epoch) of when the current token pair was
// issued — used only to decide whether a proactive refresh is already due
// right after a cold start (specs/mobile-session-refresh/spec.md S-REF-13).
export const SECURE_STORE_ISSUED_AT_KEY = "pfm_tokens_issued_at";

// Mirrors common.AccessTokenTTL / common.RefreshTokenTTL
// (backend/internal/common/constants.go).
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
// How long before the access token's expiry the mobile client proactively
// calls POST /auth/refresh (specs/mobile-session-refresh/spec.md decision #3,
// Open Question #1). Reactive refresh-on-401 (lib/axios.ts) is the fallback
// for whenever this proactive timer couldn't fire (e.g. app backgrounded).
export const PROACTIVE_REFRESH_LEAD_SECONDS = 3 * 60;

// Mirrors common.DefaultListLimit / common.MaxListLimit.
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const USER_ROLES = ["admin", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["pending", "active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const WALLET_TYPES = ["cash", "bank", "e_wallet", "other"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

// MVP currency allow-list — mirrors the 004_wallets.sql CHECK constraint.
export const WALLET_CURRENCIES = ["VND", "USD"] as const;
export type WalletCurrency = (typeof WALLET_CURRENCIES)[number];

export const CATEGORY_TYPES = ["income", "expense"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

// The two types a Category, a budget, a report or an AI proposal can carry.
export const TRANSACTION_TYPES = ["income", "expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// Every type a stored transaction can have: the two above plus "transfer"
// (money moved between two of the user's own wallets — backend
// 022_transaction_transfer.sql). A transfer is neither income nor expense, so
// it is kept out of TransactionType deliberately: nothing that sums income
// or expense should ever have to think about it.
export const TRANSACTION_KINDS = ["expense", "income", "transfer"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const TRANSACTION_KIND_LABELS: Record<TransactionKind, string> = {
  expense: "Chi",
  income: "Thu",
  transfer: "Chuyển khoản",
};

// Mirrors common.TransactionNoteMaxLength.
export const TRANSACTION_NOTE_MAX_LENGTH = 500;

// Transaction export/import (specs/transaction-export-import). The MIME type
// mirrors common.TransactionExportContentType; UTI is its iOS equivalent,
// needed by the share sheet so "Open in Numbers/Excel" appears.
export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const XLSX_UTI = "org.openxmlformats.spreadsheetml.sheet";
// Mirrors common.TransactionImportMaxUploadBytes — checked client-side too so
// a too-large file fails instantly instead of after a 5MB upload.
export const IMPORT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// Mirrors backend/internal/common/constants.go (CategoryNameMaxLength /
// CategoryIconMaxLength). Hand-kept in sync like every other DTO shape in
// this project — there is no codegen pipeline. Enforced on the inputs so an
// over-long name is stopped at the keyboard instead of coming back as a 400
// the user cannot act on.
export const CATEGORY_NAME_MAX_LENGTH = 50;
export const CATEGORY_ICON_MAX_LENGTH = 32;
