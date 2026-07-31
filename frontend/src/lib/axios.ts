import axios from "axios";

// The only axios instance in the app (dev.md: "no raw fetch/axios call
// inside a component"). Base URL is the same-origin BFF proxy, never the Go
// backend's own origin — the browser never sees the JWT (middleware.ts /
// route.ts docs in .claude/commands/dev.md).
export const apiClient = axios.create({
  baseURL: "/api/proxy",
  withCredentials: true,
});

// ApiEnvelope mirrors backend/internal/response/response.go's Body — every
// backend response is wrapped in this shape, success or failure.
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
