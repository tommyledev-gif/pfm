import axios from "axios";

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

export function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError<ApiEnvelope<unknown>>(error)) {
    return error.response?.data?.message ?? fallback;
  }
  return fallback;
}
