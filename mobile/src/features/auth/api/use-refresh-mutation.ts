import axios from "axios";
import { useMutation } from "@tanstack/react-query";

import { Config } from "@/lib/config";
import { withDeviceHeaders } from "@/lib/device-identity";
import { unwrap, type ApiEnvelope } from "@/lib/api-envelope";
import { LoginResponse } from "@/features/auth/types";

// A dedicated, interceptor-free axios instance — not apiClient
// (lib/axios.ts). Reusing apiClient here would create a circular import
// (session-store.ts -> this file -> axios.ts -> session-store.ts) and would
// also route this call through apiClient's own token-attach/401-retry
// interceptor, which is exactly the recursion specs/mobile-session-refresh/spec.md
// Edge Case #1 warns against — a separate instance sidesteps that by
// construction instead of by an exemption list.
const refreshClient = axios.create({ baseURL: Config.apiBaseUrl, timeout: 15_000 });
// Tells the server which device this session lives on: a session started
// before device-bound sessions learns its device on its next renewal.
refreshClient.interceptors.request.use(withDeviceHeaders);

// Plain async function, not just a hook export — both the proactive
// scheduler and the reactive 401 handler (stores/session-store.ts,
// lib/axios.ts) run outside any React component, so they call this
// directly rather than through useRefreshMutation.
//
// Switching to a saved account is this same call with that account's own
// refresh token, under the switch's shorter timeoutMs (AC-08: 10 s cap).
export async function refreshTokenRequest(refreshToken: string, timeoutMs?: number): Promise<LoginResponse> {
  const res = await refreshClient.post<ApiEnvelope<LoginResponse>>(
    "/auth/refresh",
    { refresh_token: refreshToken },
    timeoutMs ? { timeout: timeoutMs } : undefined,
  );
  return unwrap(res.data);
}

export function useRefreshMutation() {
  return useMutation({
    mutationFn: (refreshToken: string) => refreshTokenRequest(refreshToken),
  });
}
