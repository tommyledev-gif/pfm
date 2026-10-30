import { isAxiosError } from "axios";

import { MAX_PASSWORD_BYTES, MIN_PASSWORD_LENGTH } from "@/lib/constants";
import { currentLanguage, i18n, TranslationKey } from "@/lib/i18n";

// Split out of axios.ts so the plain response envelope helpers have no
// dependency on session-store.ts — use-refresh-mutation.ts needs these too,
// and importing them from axios.ts directly would create a circular import
// (session-store.ts -> use-refresh-mutation.ts -> axios.ts ->
// session-store.ts).
//
// ApiEnvelope mirrors backend/internal/response/response.go's Body — every
// backend response is wrapped in this shape, success or failure (same
// contract frontend/src/lib/axios.ts's ApiEnvelope documents).
export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data?: T;
  error_code?: string;
  details?: unknown;
}

export function unwrap<T>(envelope: ApiEnvelope<T>): T {
  if (!envelope.success || envelope.data === undefined) {
    throw new Error(envelope.message);
  }
  return envelope.data;
}

// Axios codes that mean the request never got an answer. ERR_CANCELED is
// deliberately absent: a request the app itself aborted is not a network
// problem and must not show the network message.
const NO_ANSWER_ERROR_CODES: readonly string[] = ["ERR_NETWORK", "ECONNABORTED", "ETIMEDOUT"];

// True only when the server never answered (offline, DNS failure, timeout,
// server unreachable). An error that carries a response — any 4xx/5xx — is
// never a network error, whatever its code says (BR-OFF-P03).
export function isNetworkError(error: unknown): boolean {
  if (!isAxiosError(error) || error.response) return false;
  if (error.code === "ERR_CANCELED") return false;
  return Boolean(error.request) || NO_ANSWER_ERROR_CODES.includes(error.code ?? "");
}

/** A screen's own key per backend error_code, ahead of the app-wide map. */
export type ErrorCodeKeys = Partial<Record<string, TranslationKey>>;

// Limits some errors.code.* sentences quote. Not sent in `details` today, so
// they mirror the backend constants named beside each.
const CODE_PARAMS: Record<string, Record<string, number>> = {
  WEAK_PASSWORD: { min: MIN_PASSWORD_LENGTH, max: MAX_PASSWORD_BYTES },
  PASSKEY_LIMIT: { max: 10 }, // common.MaxPasskeysPerUser
  WALLET_MEMBER_LIMIT: { max: 10 }, // common.WalletMemberLimit
  TOO_MANY_BUDGETS: { max: 20 }, // dto.BudgetBulkRequest
};

// Reasons the server already sends in `details.reason` (specs/mobile-language-
// switch translations-errors.md §4), as errors.reason.<CODE>.<reason> keys.
const REASON_CODES = ["INVALID_USERNAME", "INVALID_FULL_NAME"];

function errorDetails(error: unknown): Record<string, unknown> {
  if (!isAxiosError<ApiEnvelope<unknown>>(error)) return {};
  const details = error.response?.data?.details;
  return details && typeof details === "object" ? (details as Record<string, unknown>) : {};
}

// "Try again in {{minutes}} min": from an instant or a number of seconds,
// rounded up so it never says 0.
function waitMinutes(details: Record<string, unknown>): number | undefined {
  const at = typeof details.available_at === "string" ? Date.parse(details.available_at) : NaN;
  const seconds = Number.isFinite(at)
    ? (at - Date.now()) / 1000
    : typeof details.retry_after_seconds === "number"
      ? details.retry_after_seconds
      : undefined;
  return seconds === undefined ? undefined : Math.max(1, Math.ceil(seconds / 60));
}

/**
 * The sentence to show for a failed request, in the app's language
 * (specs/mobile-language-switch §5.6). The server's `message` is never shown
 * (D-09): it is a mix of Vietnamese sentences and English log fragments.
 *
 * 1. No answer from the server → errors.network.
 * 2. The screen's own key for this error_code (`codeKeys`).
 * 3. errors.code.<CODE>, with its placeholders filled from `details`.
 * 4. The screen's `fallbackKey`, else errors.unknown.
 */
export function errorText(error: unknown, fallbackKey?: TranslationKey, codeKeys?: ErrorCodeKeys): string {
  if (isNetworkError(error)) return i18n.t("errors.network");
  const code = getErrorCode(error);
  if (code) {
    const details = errorDetails(error);
    const params = { minutes: waitMinutes(details), ...CODE_PARAMS[code] };
    const screenKey = codeKeys?.[code];
    if (screenKey) return i18n.t(screenKey, params);
    if (REASON_CODES.includes(code)) {
      const reasonKey = `errors.reason.${code}.${String(details.reason)}`;
      if (i18n.exists(reasonKey)) return i18n.t(reasonKey as TranslationKey, params);
      // Transitional (spec edge case US-05 #1): until the backend sends the
      // reason, its Vietnamese sentence is the only place it is said.
      const message = isAxiosError<ApiEnvelope<unknown>>(error) ? error.response?.data?.message : undefined;
      if (message && currentLanguage() === "vi") return message;
    }
    const codeKey = `errors.code.${code}`;
    if (i18n.exists(codeKey)) return i18n.t(codeKey as TranslationKey, params);
  }
  return i18n.t(fallbackKey ?? "errors.unknown");
}

// Lets a caller branch on a specific backend failure (e.g. "RATE_LIMITED" vs
// "AI_SERVICE_UNAVAILABLE") instead of just displaying a message — same
// isAxiosError guard as errorText above.
export function getErrorCode(error: unknown): string | undefined {
  if (isAxiosError<ApiEnvelope<unknown>>(error)) {
    return error.response?.data?.error_code;
  }
  return undefined;
}
