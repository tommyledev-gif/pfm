import axios from "axios";

import { useSessionStore } from "@/stores/session-store";

// Unlike frontend/'s apiClient (which points at a same-origin BFF proxy so
// the browser never sees the JWT), mobile has no server tier of its own to
// hide the token behind — it calls the Go backend directly, over HTTPS, with
// the JWT attached from secure storage (lib/secure-storage.ts via
// session-store.ts). This mirrors Flutter's dio_client.dart precedent, not
// the web client's BFF pattern.
export const apiClient = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
});

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useSessionStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Mirrors Flutter's session_events.dart: a 401 means the access token is
// gone/expired — there is no `/auth/refresh` endpoint (CLAUDE.md), so this
// forces a full re-login, never a silent retry. Actual navigation-on-401
// (redirect to the (auth) group) is wired once a real screen exists to
// redirect to — left as a TODO here deliberately, not implemented, per this
// pass being setup-only, no feature code yet.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await useSessionStore.getState().clear();
      // TODO(auth feature): trigger a redirect to /(auth)/login once the
      // login screen is implemented — needs a navigation ref reachable
      // outside of a component (e.g. via expo-router's router import),
      // deliberately not wired up in this setup-only pass.
    }
    return Promise.reject(error);
  },
);

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
