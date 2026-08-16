import axios from "axios";

import { Config } from "@/lib/config";
import { useSessionStore } from "@/stores/session-store";

// Unlike frontend/'s apiClient (which points at a same-origin BFF proxy so
// the browser never sees the JWT), mobile has no server tier of its own to
// hide the token behind — it calls the Go backend directly, over HTTPS, with
// the JWT attached from secure storage (lib/secure-storage.ts via
// session-store.ts). This mirrors Flutter's dio_client.dart precedent, not
// the web client's BFF pattern.
export const apiClient = axios.create({
  baseURL: Config.apiBaseUrl,
  timeout: 15_000,
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
// forces a full re-login, never a silent retry. No manual navigation is
// needed here: clearing the store flips `hasSession` in app/_layout.tsx's
// Stack.Protected guard, which re-renders to the (auth) group on its own.
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (__DEV__) {
      if (error.response) {
        // Server answered with a non-2xx status — an app/backend-level
        // problem (bad credentials, validation, etc.), not a network one.
        console.error(`[Axios] ${error.response.status} ${error.config?.url}`, error.response.data);
      } else if (error.request) {
        // Request left the device but no response ever came back — this is
        // the network-level failure mode (wrong IP/port, firewall blocking
        // the LAN port, phone/PC not on the same network, server not
        // running). Config.apiBaseUrl is logged once at startup — check it
        // matches `ipconfig`'s IPv4 address and the backend's BACKEND_PORT.
        console.error(`[Axios] No response for ${error.config?.url} (baseURL: ${Config.apiBaseUrl})`, error.message);
      } else {
        console.error("[Axios] Request setup error:", error.message);
      }
    }
    if (error.response?.status === 401) {
      await useSessionStore.getState().clear();
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
