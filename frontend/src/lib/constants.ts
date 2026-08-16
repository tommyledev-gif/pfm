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
  wallets: "/app/wallets",
  categories: "/app/categories",
  budgets: "/app/budgets",
  transactions: "/app/transactions",
  reports: "/app/reports",
  notifications: "/app/notifications",
  aiChat: "/app/ai-chat",
} as const;

export const USER_ROLES = ["admin", "member"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["pending", "active", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

// Mirrors backend/internal/common/constants.go's WalletNameMaxLength.
export const WALLET_NAME_MAX_LENGTH = 100;

// Mirrors model.WalletType (backend/internal/model/wallet.go).
export const WALLET_TYPES = ["cash", "bank", "e_wallet", "other"] as const;
export type WalletType = (typeof WALLET_TYPES)[number];

// MVP currency allow-list — mirrors the 004_wallets.sql CHECK constraint.
// specs/wallet-management/spec.md Open Question #1 flags this as an
// explicit assumption, not a confirmed decision.
export const WALLET_CURRENCIES = ["VND", "USD"] as const;
export type WalletCurrency = (typeof WALLET_CURRENCIES)[number];

// Mirrors backend/internal/common/constants.go's CategoryNameMaxLength/CategoryIconMaxLength.
export const CATEGORY_NAME_MAX_LENGTH = 50;
export const CATEGORY_ICON_MAX_LENGTH = 32;

// Mirrors model.CategoryType (backend/internal/model/category.go).
export const CATEGORY_TYPES = ["income", "expense"] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

// Mirrors common.BudgetPeriodMonthly (backend/internal/common/constants.go)
// — "monthly" is the only accepted value in MVP.
export const BUDGET_PERIODS = ["monthly"] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

// Mirrors model.TransactionType (backend/internal/model/transaction.go).
export const TRANSACTION_TYPES = ["income", "expense"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

// Mirrors common.TransactionNoteMaxLength (backend/internal/common/constants.go).
export const TRANSACTION_NOTE_MAX_LENGTH = 500;

// Mirrors common.AIChatMessageMaxLength (backend/internal/common/constants.go).
export const AI_CHAT_MESSAGE_MAX_LENGTH = 1000;
