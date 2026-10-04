import axios, { CanceledError } from "axios";

import { Config } from "@/lib/config";
import { userIdFromAccessToken } from "@/lib/jwt";
import { redact } from "@/lib/redact";
import { useDebugLogStore } from "@/stores/debug-log-store";
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

// A request made on behalf of one specific User (the outbox flusher) names
// them here. Optional, so every other request is unaffected.
declare module "axios" {
  interface AxiosRequestConfig {
    ownerUserId?: string;
  }
}

export const OWNER_MISMATCH_MESSAGE = "request owner is not the signed-in user";

// ⚠️ Owner guard (specs/mobile-offline-support BR-OFF-P06, plan Finding #7):
// a queued item of User A must never be booked with User B's session — an
// account switch between enqueue and send makes this a real path.
function ownerMismatch(ownerUserId: string | undefined, accessToken: string | null): boolean {
  return ownerUserId !== undefined && userIdFromAccessToken(accessToken) !== ownerUserId;
}

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useSessionStore.getState();
  if (ownerMismatch(config.ownerUserId, accessToken)) {
    throw new CanceledError(OWNER_MISMATCH_MESSAGE);
  }
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// responseType "arraybuffer" (GET /transactions/export is the only caller
// today) applies to every response, not just the 2xx — so a 4xx JSON error
// envelope also arrives as binary. Left as-is, getErrorMessage finds no
// `message` field, so every failure shows the same generic toast, and the
// debug console renders the body as a useless "{}" (JSON.stringify of an
// ArrayBuffer). Decoding it back into the envelope here — before the logger
// or any caller reads it — is what makes such a failure diagnosable.
//
// TextDecoder is a global in Expo SDK 54 (expo/src/winter installs it), which
// matters because the backend's messages are Vietnamese: a byte-wise
// String.fromCharCode would mangle every accented character.
function decodeBinaryErrorBody(error: { response?: { data?: unknown } }): void {
  const data = error.response?.data;
  if (!error.response || !(data instanceof ArrayBuffer)) return;
  try {
    error.response.data = JSON.parse(new TextDecoder().decode(data));
  } catch {
    // Not JSON at all — an HTML error page from a proxy, say. Leave the raw
    // body in place rather than replacing it with a worse guess.
  }
}

// A request that has already gone through one refresh-and-retry cycle
// carries this flag so a second 401 goes straight to clear() instead of
// looping (specs/mobile-session-refresh/spec.md Edge Case #2).
interface RetriableRequestConfig {
  _retried?: boolean;
}

// /auth/login and /auth/activate call apiClient directly (unlike
// /auth/refresh, which uses its own interceptor-free instance — see
// features/auth/api/use-refresh-mutation.ts) — a 401 from either of those
// is a credentials/invite failure, never a case for attempting a token
// refresh.
function isAuthEndpoint(url: string | undefined): boolean {
  return Boolean(url && (url.includes("/auth/login") || url.includes("/auth/activate")));
}

// A 401 on any other authenticated request means the access token has
// expired — this attempts exactly one silent refresh-and-retry
// (specs/mobile-session-refresh/spec.md US-02) before falling back to the
// original force-logout behavior. Concurrent 401s across parallel requests
// share the same in-flight refresh via session-store.ts's own
// de-duplication, so a burst of requests (e.g. Home screen's parallel
// wallet/category/transaction fetches) triggers exactly one
// POST /auth/refresh, not one per request (S-REF-11).
apiClient.interceptors.response.use(
  (response) => {
    useDebugLogStore
      .getState()
      .append("api", `${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        headers: redact(response.config.headers),
        request: redact(response.config.data),
        response: redact(response.data),
      });
    return response;
  },
  async (error) => {
    decodeBinaryErrorBody(error);
    useDebugLogStore
      .getState()
      .append(
        "api",
        `${error.response?.status ?? "ERR"} ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        {
          headers: redact(error.config?.headers),
          request: redact(error.config?.data),
          response: redact(error.response?.data),
          message: error.message,
        },
      );
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

    const config = error.config as (typeof error.config & RetriableRequestConfig) | undefined;
    const canRetryWithRefresh = error.response?.status === 401 && config && !isAuthEndpoint(config.url) && !config._retried;

    if (canRetryWithRefresh) {
      try {
        const newAccessToken = await useSessionStore.getState().refreshSession();
        // The refresh may have landed on another User's session; the request
        // is then rejected with its original 401 instead of being re-sent.
        if (ownerMismatch(config.ownerUserId, newAccessToken)) return Promise.reject(error);
        config._retried = true;
        config.headers = { ...config.headers, Authorization: `Bearer ${newAccessToken}` };
        return apiClient.request(config);
      } catch {
        // refreshSession() already force-cleared the session if the token
        // was refused, or kept it and scheduled a retry if the network
        // failed — either way, reject the original request below.
      }
    } else if (error.response?.status === 401) {
      await useSessionStore.getState().clear();
    }
    return Promise.reject(error);
  },
);

// Re-exported for every existing `import { unwrap } from "@/lib/axios"` call
// site — the types/helpers themselves now live in lib/api-envelope.ts (no
// session-store dependency), see that file's doc comment for why.
export { unwrap, getErrorMessage, getErrorCode, type ApiEnvelope } from "@/lib/api-envelope";
