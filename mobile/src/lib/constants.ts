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
// (backend/internal/common/constants.go). The refresh lifetime is idle and
// sliding; the server also caps a session at 180 days.
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60;
// How long before the access token's expiry the mobile client proactively
// calls POST /auth/refresh (specs/mobile-session-refresh/spec.md decision #3,
// Open Question #1). Reactive refresh-on-401 (lib/axios.ts) is the fallback
// for whenever this proactive timer couldn't fire (e.g. app backgrounded).
export const PROACTIVE_REFRESH_LEAD_SECONDS = 3 * 60;
// When POST /auth/refresh fails without the server rejecting the token
// (offline, timeout, 5xx), the session is kept and the refresh is retried
// after this delay instead of logging the User out.
export const REFRESH_RETRY_DELAY_SECONDS = 30;

// Offline support (specs/mobile-offline-support). Copy lives here, not in
// each component, because the same sentence is shown from several places
// (every getErrorMessage caller, every useRequireOnline surface).
export const NETWORK_ERROR_MESSAGE = "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.";
export const NEEDS_CONNECTION_MESSAGE = "Cần kết nối mạng để thực hiện thao tác này.";
export const OFFLINE_REFRESH_MESSAGE = "Đang ngoại tuyến — chưa thể làm mới.";
// The offline strip (components/shared/OfflineBanner.tsx) moves the screen's
// content, so a flapping connection must not make it flicker (EC-OFF-04):
// it appears only once offline has lasted OFFLINE_STRIP_SHOW_DELAY_MS, and
// leaves only once the connection has held for ONLINE_STABLE_DELAY_MS —
// after showing "reconnected" for RECONNECTED_STRIP_MS.
export const OFFLINE_STRIP_SHOW_DELAY_MS = 2000;
export const ONLINE_STABLE_DELAY_MS = 1000;
export const RECONNECTED_STRIP_MS = 2000;
export const OFFLINE_NO_DATA_MESSAGE = "Chưa có dữ liệu đã lưu cho mục này. Kết nối mạng để tải.";

// Per-User saved query cache (US-03). Keep age confirmed by the product owner
// (spec decision #8); also the gcTime of every allow-listed query, so a
// restored entry is not garbage-collected before a screen reads it.
export const QUERY_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Part of the persistence buster — bump when a cached response shape changes.
export const QUERY_CACHE_SCHEMA_VERSION = 1;
export const QUERY_CACHE_STORAGE_KEY_PREFIX = "pfm_query_cache:";
export const QUERY_CACHE_PERSIST_THROTTLE_MS = 1000;
// Transactions lists kept (first page each, most recently fetched first) —
// bounds the stored blob below Android's ~2 MB AsyncStorage row limit.
export const MAX_PERSISTED_TRANSACTION_QUERIES = 5;
// Single-Transaction caches (with Items) kept for offline reading.
export const MAX_PERSISTED_TRANSACTION_DETAILS = 20;

// Outbox of Transactions recorded offline (US-04..US-07). Cap confirmed by
// the product owner (spec decision #8).
export const OUTBOX_STORAGE_KEY = "pfm_outbox";
export const OUTBOX_MAX_ITEMS_PER_USER = 200;
// 5xx answers on the same item before it is marked Failed (US-05 step 6).
export const OUTBOX_MAX_SYSTEM_ERRORS = 5;
// Minimum gap between flushes started by "a request just succeeded".
export const OUTBOX_FLUSH_MIN_INTERVAL_MS = 10_000;

// Mirrors common.DefaultListLimit / common.MaxListLimit.
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const USER_ROLES = ["admin", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// "requested": asked for an account from the login screen, waiting for an
// admin to approve it (backend mig 031). Approval makes it "pending".
export const USER_STATUSES = ["requested", "pending", "active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const WALLET_TYPES = ["cash", "bank", "e_wallet", "other"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

// MVP currency allow-list — mirrors the 004_wallets.sql CHECK constraint.
export const WALLET_CURRENCIES = ["VND", "USD"] as const;
export type WalletCurrency = (typeof WALLET_CURRENCIES)[number];
// What an amount is formatted in when its Wallet is unknown (not loaded yet,
// or deleted) — the app's home currency.
export const FALLBACK_CURRENCY: WalletCurrency = "VND";
// The only currency an AI proposal may be saved to — the AI reads every
// amount as VND and never converts. Mirrors the backend's proposalCurrency.
export const PROPOSAL_CURRENCY: WalletCurrency = "VND";
// Mirrors backend common.AIChatConfidenceThreshold: below it an image proposal
// carries the low-confidence label (specs/ai-chat-image-capture BR-09).
export const AI_CONFIDENCE_THRESHOLD = 0.6;

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

// Same emoji migration 022 seeds on the system transfer category — which is
// never in the user's category list, so its icon cannot come from a lookup.
export const TRANSFER_CATEGORY_ICON = "🔁";

// Mirrors common.TransactionNoteMaxLength.
export const TRANSACTION_NOTE_MAX_LENGTH = 500;

// Items of a Transaction — mirror backend common.TransactionItemsMax et al.
// (specs/transaction-line-items plan §2.6); keep both sides in step.
export const TRANSACTION_ITEMS_MAX = 100;
export const TRANSACTION_ADJUSTMENTS_MAX = 10;
export const TRANSACTION_LINE_NAME_MAX_LENGTH = 100;
export const TRANSACTION_ITEM_QUANTITY_MAX = 9999;

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

// Account switching (specs/mobile-account-switch). Key names: the registry
// index (no secrets) and one SecureStore key per saved account's refresh
// token — its own session on this device — so every value stays far under
// SecureStore's ~2 KB guidance.
export const SECURE_STORE_ACCOUNTS_KEY = "pfm_accounts";
export const SECURE_STORE_ACCOUNT_REFRESH_KEY_PREFIX = "pfm_account_rt_";
// Where builds before 2026-10-19 kept each saved account's switch token.
// Read once to trade them for sessions (convert-legacy-accounts.ts), then
// deleted.
export const SECURE_STORE_SWITCH_TOKEN_KEY_PREFIX = "pfm_account_st_";
// A locked account's refresh token, sealed by the biometric vault (logout =
// lock). Encrypted already; SecureStore only keeps it off backups.
export const SECURE_STORE_ACCOUNT_SEALED_KEY_PREFIX = "pfm_account_sealed_";
// This install's random device id (lib/device-identity.ts).
export const SECURE_STORE_DEVICE_ID_KEY = "pfm_device_id";
// Device-wide security preferences (identity check) — AsyncStorage, not a secret.
export const SECURITY_PREFS_STORAGE_KEY = "pfm_security_prefs";
export const MAX_SAVED_ACCOUNTS = 5;
// Settings row: avatars shown before the "+N" circle (spec AC-05).
export const AVATAR_GROUP_MAX_VISIBLE = 3;
// Mirrors common.MinPasswordLength (backend/internal/common/constants.go).
export const MIN_PASSWORD_LENGTH = 8;
// App lock (Security screen, opt-in): back from the background after this
// long, the app asks for the owner check again.
export const APP_LOCK_AFTER_BACKGROUND_MS = 5 * 60 * 1000;
// A switch completes within 10 s in every outcome (AC-08): the outgoing
// User's chat gets this long to sync, the switch request this long to answer.
export const SWITCH_CHAT_FLUSH_TIMEOUT_MS = 3000;
export const SWITCH_REQUEST_TIMEOUT_MS = 6000;
// Logout's server calls + last chat sync share this cap (moved from settings).
export const LOGOUT_FLUSH_TIMEOUT_MS = 4000;

// HTTP statuses the account-switch / security flows branch on.
export const HTTP_STATUS = {
  badRequest: 400,
  unauthorized: 401,
  notFound: 404,
  requestTimeout: 408,
  tooManyRequests: 429,
  serverErrorMin: 500,
} as const;
