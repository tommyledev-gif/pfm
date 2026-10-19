import axios, { isAxiosError } from "axios";

import { type ApiEnvelope } from "@/lib/api-envelope";
import { Config } from "@/lib/config";
import { withDeviceHeaders } from "@/lib/device-identity";
import { SWITCH_REQUEST_TIMEOUT_MS } from "@/lib/constants";
import { redact } from "@/lib/redact";
import { useDebugLogStore } from "@/stores/debug-log-store";
import { SwitchResponse } from "@/features/accounts/types";

// Plain async functions, not hooks: logout, removing a saved account and
// trading old switch tokens run outside any one screen (same precedent as
// refreshTokenRequest).
//
// They go through a client without apiClient's interceptors: they carry
// their own credential in the body, must never attach the CURRENT User's
// bearer, and a 401 from them must never trigger apiClient's
// refresh-or-logout handling of the current session. Its short timeout keeps
// them inside the logout cap and a switch under 10 s (spec AC-08). It does
// say which device it is, so a traded switch token becomes this device's
// session.
const accountsClient = axios.create({ baseURL: Config.apiBaseUrl, timeout: SWITCH_REQUEST_TIMEOUT_MS });
accountsClient.interceptors.request.use(withDeviceHeaders);

function logOutcome(path: string, outcome: unknown, body: unknown): void {
  const status = isAxiosError(outcome) ? (outcome.response?.status ?? "ERR") : 200;
  useDebugLogStore.getState().append("api", `${status} POST ${path}`, {
    request: redact(body),
    response: redact(isAxiosError(outcome) ? outcome.response?.data : outcome),
  });
}

async function postWithoutSession<T>(path: string, body: Record<string, string>): Promise<T | null> {
  try {
    const res = await accountsClient.post<ApiEnvelope<T>>(path, body);
    logOutcome(path, res.data, body);
    return res.data.data ?? null;
  } catch (error) {
    logOutcome(path, error, body);
    throw error;
  }
}

/**
 * POST /auth/switch (deprecated) — trades a switch token an older build saved
 * for a session on this device. The server sends no new switch token back to
 * a request that names its device; an older server still might.
 */
export async function switchRequest(switchToken: string): Promise<SwitchResponse> {
  const data = await postWithoutSession<SwitchResponse>("/auth/switch", { switch_token: switchToken });
  if (!data) throw new Error("empty switch response");
  return data;
}

/** POST /auth/switch-token/revoke — idempotent, no session needed. */
export async function revokeSwitchTokenRequest(switchToken: string): Promise<void> {
  await postWithoutSession<null>("/auth/switch-token/revoke", { switch_token: switchToken });
}

/** POST /auth/logout — ends a session server-side with its refresh token. */
export async function logoutRequest(refreshToken: string): Promise<void> {
  await postWithoutSession<null>("/auth/logout", { refresh_token: refreshToken });
}

/** Fire-and-forget wrappers for best-effort cleanup (BR-09). */
export function revokeSwitchTokenQuietly(switchToken: string): void {
  revokeSwitchTokenRequest(switchToken).catch(() => {});
}

export function logoutQuietly(refreshToken: string): void {
  logoutRequest(refreshToken).catch(() => {});
}
