import { isAxiosError } from "axios";

import { NETWORK_ERROR_MESSAGE } from "@/lib/constants";

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

export function getErrorMessage(error: unknown, fallback: string): string {
  if (isNetworkError(error)) return NETWORK_ERROR_MESSAGE;
  if (isAxiosError<ApiEnvelope<unknown>>(error)) {
    return error.response?.data?.message ?? fallback;
  }
  return fallback;
}

// Lets a caller branch on a specific backend failure (e.g. "RATE_LIMITED" vs
// "AI_SERVICE_UNAVAILABLE") instead of just displaying a message — same
// isAxiosError guard as getErrorMessage above.
export function getErrorCode(error: unknown): string | undefined {
  if (isAxiosError<ApiEnvelope<unknown>>(error)) {
    return error.response?.data?.error_code;
  }
  return undefined;
}
