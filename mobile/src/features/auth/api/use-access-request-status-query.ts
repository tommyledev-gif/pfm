import { useQuery } from "@tanstack/react-query";

import { apiClient, unwrap, type ApiEnvelope } from "@/lib/axios";

// Mirrors backend dto.AccessRequestStatusResponse.
interface AccessRequestStatus {
  awaiting_approval: boolean;
}

// Often enough that an approval shows up while the requester waits on the
// login screen; well inside the server's 60-per-15-minutes cap.
const POLL_INTERVAL_MS = 30_000;

/**
 * POST /auth/access-requests/status — whether `email`'s request still waits
 * for an admin. No session. False means "no longer waiting": approved, but
 * also rejected or never filed (the server will not say which), so the login
 * button simply opens and the sign-in itself says what is wrong, if anything.
 *
 * Polls only while the answer is "waiting"; off while `enabled` is false.
 */
export function useAccessRequestStatusQuery(email: string, enabled: boolean) {
  return useQuery({
    queryKey: ["access-request-status", email.toLowerCase()],
    queryFn: async (): Promise<boolean> => {
      const res = await apiClient.post<ApiEnvelope<AccessRequestStatus>>("/auth/access-requests/status", { email });
      return unwrap(res.data).awaiting_approval;
    },
    enabled,
    staleTime: 0,
    refetchInterval: (query) => (query.state.data === false ? false : POLL_INTERVAL_MS),
  });
}
