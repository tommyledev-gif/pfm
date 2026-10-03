import { userIdFromAccessToken } from "@/lib/jwt";
import { useSessionStore } from "@/stores/session-store";

// The signed-in User's id, from the access token's own claims — the session
// store keeps only the token. Null while signed out or for a malformed token,
// and every per-user feature treats null as "nothing to show".
export function useCurrentUserId(): string | null {
  return useSessionStore((s) => userIdFromAccessToken(s.accessToken));
}
