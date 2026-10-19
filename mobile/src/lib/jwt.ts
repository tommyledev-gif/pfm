// Minimal, verification-free JWT payload reader.
//
// The backend's access token carries `{ user_id, role }` (backend/internal/
// service/token_service.go's AccessClaims), but neither POST /auth/login nor
// POST /auth/refresh returns `role` in its response body — the token is the
// only place the client can learn it, and there is no GET /users/me endpoint
// (docs/architecture.md §3). So role-dependent UI (hiding the admin-only
// Household Members entry point) reads it from here.
//
// This deliberately does NOT verify the signature: a client cannot hold the
// signing key, and it doesn't need to. Every admin-only action is enforced
// server-side by `RequireRole` on the /admin/* routes — a tampered local
// token would only ever reveal a screen whose own API calls then 403. This
// is a UI affordance, never an authorization decision.
const BASE64_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// Hand-rolled rather than depending on `atob`/Buffer — `atob` is only
// present on some Hermes/RN versions and Buffer isn't polyfilled here, so a
// dozen lines of table lookup removes a runtime unknown from an
// otherwise-trivial path.
function decodeBase64Url(input: string): string | null {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  let output = "";
  let buffer = 0;
  let bits = 0;

  for (const char of padded) {
    if (char === "=") break;
    const value = BASE64_ALPHABET.indexOf(char);
    if (value === -1) return null;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return output;
}

export interface AccessTokenClaims {
  user_id?: string;
  role?: string;
  /** Seconds since epoch (every token the backend signs carries one). */
  exp?: number;
}

// Returns null for anything that isn't a well-formed three-part JWT with a
// JSON payload — a malformed/absent token simply means "no known role", and
// every caller treats that as the least-privileged case.
export function decodeAccessTokenClaims(token: string | null): AccessTokenClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const json = decodeBase64Url(parts[1]);
  if (!json) return null;

  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as AccessTokenClaims;
  } catch {
    return null;
  }
}

export type UserRole = "admin" | "member";

export function roleFromAccessToken(token: string | null): UserRole | null {
  const role = decodeAccessTokenClaims(token)?.role;
  return role === "admin" || role === "member" ? role : null;
}

export function userIdFromAccessToken(token: string | null): string | null {
  const userId = decodeAccessTokenClaims(token)?.user_id;
  return typeof userId === "string" && userId.length > 0 ? userId : null;
}

/**
 * When a token stops working, as an ISO UTC string — for a saved account,
 * when its session on this device runs out (the refresh token's exp already
 * takes the session's 180-day cap into account). null when unreadable.
 */
export function tokenExpiresAt(token: string | null): string | null {
  const exp = decodeAccessTokenClaims(token)?.exp;
  return typeof exp === "number" && Number.isFinite(exp) ? new Date(exp * 1000).toISOString() : null;
}
