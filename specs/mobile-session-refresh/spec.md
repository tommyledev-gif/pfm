# Feature Spec: Session Refresh (F-02 extension — `POST /auth/refresh` + mobile auto-refresh)

> Source: explicit user request — "thêm refresh token và tự call để giữ session vì hiện tại cứ vài phút là lại bị logout trong mobile/". Extends SRS Feature-02 (System Security / JWT auth).
> Status: new — **backend + mobile**, not mobile-only. `CURRENT_STATE.md` Active TODOs already flags this: *"`/auth/refresh` endpoint chưa implement — hiện tại 401 = force re-login (không phải bug, là quyết định MVP); worse UX impact on mobile than web."* The 15-minute access token TTL (`backend/internal/common/constants.go: AccessTokenTTL = 15 * time.Minute`) is what the user is experiencing as "logout sau vài phút" — there is no bug in the existing token issuance, only a missing refresh path.
> Related: [security spec](../security/spec.md) (original JWT issuance/logout this extends), [mobile-debug-console](../mobile-debug-console/spec.md) (refresh attempts/failures must be visible there as `api` log entries).

## Context

Today, `POST /auth/login` and `POST /auth/activate` issue an access token (15m TTL) and a refresh token (7d TTL) via `TokenService.GenerateTokenPair` (`backend/internal/service/token_service.go`), and `POST /auth/logout` revokes a refresh token's `jti` into the `revoked_tokens` table. **No endpoint ever consumes the refresh token to issue a new access token** — every client (mobile and web alike, confirmed via `CURRENT_STATE.md` and `frontend/`) stores the refresh token but never uses it, so an access token expiring after 15 minutes forces a full re-login on the next API call's `401`. This spec adds the missing refresh path end-to-end.

**Resolved design decisions:**

1. **New endpoint: `POST /auth/refresh`, unauthenticated (like `/auth/logout`), taking the refresh token in the request body.** Mirrors `/auth/logout`'s existing shape (`dto.LogoutRequest { refresh_token }`) rather than requiring the expired access token as a Bearer header — the whole point is that the access token is already invalid/expired at the moment this is called.
2. **Refresh token rotation on every use.** Each successful `/auth/refresh` call revokes the *presented* refresh token's `jti` (reusing the existing `RevokedTokenRepo.Revoke`, exactly as `/auth/logout` does) and issues a brand-new access+refresh pair via the existing `TokenService.GenerateTokenPair`. This is standard refresh-rotation practice and reuses 100% of existing token infrastructure — no new token-issuance code path, only a new orchestration in `AuthService`. A stolen refresh token that gets used by an attacker becomes detectable (see Edge Cases #3) and a replayed old token is always rejected once rotated.
3. **Mobile calls `/auth/refresh` proactively, not only reactively on a `401`.** "Tự động call để giữ session" (auto-call to keep the session alive) means the mobile client schedules a refresh shortly before the access token's known 15-minute expiry (e.g. at the 12-minute mark), so an in-progress screen never hits a `401` in the first place during normal foreground use. A **reactive** fallback (refresh-then-retry-once on an actual `401`) is also included, to cover the case where the app was backgrounded past the proactive schedule (see US-02).
4. **Concurrent-request de-duplication on the client.** If multiple API calls hit `401` around the same moment (e.g. Home screen's parallel wallet/category/transaction fetches), only one `/auth/refresh` call is made; the others wait for that single in-flight refresh and retry with its result — never N parallel refresh calls each attempting to rotate the same (soon-to-be-revoked) refresh token, which per decision #2's rotation would make all but the first one fail.
5. **Refresh failure (expired/revoked/invalid refresh token) forces the existing full-logout path** — `useSessionStore.clear()`, unchanged from today's `401` handling in `mobile/src/lib/axios.ts`. This spec does not change what happens when a session is genuinely un-recoverable (e.g. the 7-day refresh token itself expired, or the user logged out on another device), only what happens when just the *access* token has expired but the *refresh* token is still good.

Actors:
- **Mobile client** (`mobile/src/lib/axios.ts`, `session-store.ts`) — this spec's primary consumer.
- Web (`frontend/`) is not touched by this spec — same missing capability exists there, but the user's request scopes to mobile only (see Out of Scope).

## Preconditions (feature-level)

- No new migration — reuses the existing `revoked_tokens` table (`003_revoked_tokens.sql`) and `TokenService`/`RevokedTokenRepo` unchanged.
- Caller possesses a syntactically valid, unexpired refresh token (previously issued by `/auth/login` or `/auth/activate`, or by a prior `/auth/refresh` rotation) that has not already been revoked.

### Domain Concept: Refresh Rotation

| Concept | Meaning |
|---|---|
| Rotation | Every successful `/auth/refresh` revokes the input refresh token's `jti` and returns a new access+refresh pair — a refresh token is single-use, exactly like `/auth/logout`'s revocation, just triggered by a different endpoint. |
| Reuse detection | Because the old `jti` is revoked at rotation, presenting an already-rotated (old) refresh token a second time is indistinguishable at the DB layer from presenting a token revoked via `/auth/logout` — both look up as "revoked" and are rejected identically. No separate "theft detection" alerting is added in this MVP slice (see Edge Cases #3, Open Questions #2). |

**Business invariant**: a refresh token, once used successfully by `/auth/refresh` or `/auth/logout`, can never be used again — `revoked_tokens` is the single source of truth for this, checked on every `/auth/refresh` call before issuing a new pair.

---

## US-01: Refresh an Access Token

**As a** mobile user with an active session,
**I want** my access token to be silently renewed before it expires,
**so that** I am not logged out every 15 minutes during normal use.

**API:** `POST /auth/refresh`

### Preconditions
- Request body: `{ "refresh_token": string }` (same shape as `LogoutRequest`).

### Main Flow
1. Mobile schedules a refresh timer when tokens are set (login, activate, or a prior refresh) — fires at `AccessTokenTTL - 3 minutes` from issuance (i.e. ~12 minutes in, given the current 15-minute TTL; see Edge Cases #5 for the "app was backgrounded" case).
2. Timer fires (or a reactive `401` triggers this instead — see US-02); mobile calls `POST /auth/refresh` with the currently-stored refresh token.
3. System parses the refresh token (`TokenService.ParseRefreshTokenUnverified`, same as `Logout` does today) to extract `jti`, `subject` (user ID), `exp`.
4. System validates: `exp` has not passed, and `jti` is not already present in `revoked_tokens` (`RevokedTokenRepo.IsRevoked`).
5. System looks up the user by `subject` to confirm they still exist and are `active` (a disabled/deleted user's refresh token must not silently keep working).
6. System revokes the presented refresh token's `jti` (rotation — decision #2) and calls `TokenService.GenerateTokenPair` to issue a new access+refresh pair for the same user.
7. System returns `200` with `{ access_token, refresh_token }` (same `TokenPairResponse` shape `/auth/login` already returns).
8. Mobile calls `setTokens(...)` (existing `session-store.ts` method) with the new pair and reschedules the next proactive refresh timer from step 1.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-REF-01 | User logged in 12 minutes ago; access token still has ~3 min left; refresh token is valid | Mobile's proactive timer fires and calls `POST /auth/refresh` | `200`; new access+refresh pair returned; old refresh token's `jti` is now in `revoked_tokens` | Happy path — the primary "stay logged in" flow |
| S-REF-02 | Refresh token is well-formed but its `exp` has already passed (>7 days old) | Client calls `POST /auth/refresh` | `401 UNAUTHENTICATED` | Mirrors access-token-expiry semantics — same bare-401 precedent as `JWTAuth` middleware (no reason leaked) |
| S-REF-03 | Refresh token was already used once (already rotated) or was explicitly logged out | Client calls `POST /auth/refresh` with that same old token | `401 UNAUTHENTICATED` | Reuse-after-rotation is rejected (Domain Concept: Reuse detection) |
| S-REF-04 | Refresh token is malformed / not a JWT at all | Client calls `POST /auth/refresh` | `400 INVALID_INPUT` | Same validation-error precedent as `Logout`'s `ParseRefreshTokenUnverified` failure path |
| S-REF-05 | Refresh token is valid, but the user account was disabled after the token was issued | Client calls `POST /auth/refresh` | `401 UNAUTHENTICATED` | New check this spec adds (Main Flow step 5) — a disabled user must not be able to keep refreshing forever |
| S-REF-06 | Refresh token is valid, but the user account was deleted (soft-deleted) after issuance | Client calls `POST /auth/refresh` | `401 UNAUTHENTICATED` | Same as S-REF-05, deletion case |
| S-REF-07 | Refresh token is missing from the request body | Client calls `POST /auth/refresh` with `{}` | `400 INVALID_INPUT` | Handler-level shape validation (`validator` struct tag), before any DB call |
| S-REF-08 | Two devices are logged in as the same user, each with their own refresh token | Device A calls `POST /auth/refresh` | `200`; only Device A's refresh token is rotated — Device B's own refresh token (different `jti`) remains valid and unaffected | Rotation is per-token, not per-user — multi-device sessions coexist independently, same precedent as `/auth/logout` |

### Response Shape
```json
{ "access_token": "...", "refresh_token": "..." }
```
(identical shape to `dto.TokenPairResponse`, reused verbatim — no new DTO type needed beyond the request body.)

### Edge Cases
1. **Rotation must be atomic with issuance** — if `TokenService.GenerateTokenPair` fails after the old token was already revoked, the caller is left with no valid token pair at all (their old one is now revoked, no new one issued). Mitigate by generating the new pair *before* revoking the old one in the service method (revoke last, once the new pair is confirmed signed) — order matters even without a DB transaction spanning both, since token generation is a pure in-memory operation with only a signing-key dependency (it cannot itself fail except on a config error, in which case failing the whole request with `500` and leaving the old token still valid is the safer outcome).
2. **`ParseRefreshTokenUnverified` does not check the signature** (by original design, per its own doc comment) — this is safe for `/auth/refresh` for the same reason it's safe for `/auth/logout`: the subsequent `IsRevoked`/user-lookup/`exp` checks are what actually gate success, not the parse step. A forged token with a fabricated `jti` simply fails the "user exists and matches subject" check or produces a `jti` never found in the legitimate issuance history — it can occupy a harmless revoked-token row at worst, identical to `Logout`'s existing precedent (`token_service.go`'s own comment on this).
3. **No token-theft alerting in this MVP** — if an attacker steals a refresh token and uses it before the legitimate owner does, the legitimate owner's next attempt (proactive or reactive) fails with `401` and force-logs-out, which is the correct fail-safe behavior even without a dedicated "your session was compromised" notification. Flagged in Open Questions #2 as a possible Release-1 follow-up (ties to F-10 Notification Handling), not required for this spec.
4. **Clock skew**: `exp` validation uses server time (`time.Now().UTC()`), same as every other JWT check in this codebase — no client-clock trust anywhere in this flow.
5. **A refresh that happens to race a `/auth/logout` call for the same token** (e.g. user logs out on another screen at the same moment the proactive timer fires) — whichever request's `Revoke` reaches the DB first wins (idempotent upsert, per `RevokedTokenRepository.Revoke`'s existing doc comment); the loser's subsequent `IsRevoked` check (if it runs after) would already see it revoked. This is an accepted, harmless race — worst case the user is logged out slightly earlier than the refresh would have kept them in, never a security issue.

### Definition of Done
- `POST /auth/refresh` implemented: unauthenticated route, validates request shape, parses refresh token, checks not-revoked and not-expired, verifies user still exists and is `active`, rotates (revoke-old, issue-new), returns `200` with a new token pair.
- Unit tests for S-REF-01 through S-REF-08 pass (extends `auth_service_test.go`'s existing fake-repo pattern).
- No new migration, no new DB table — reuses `revoked_tokens` and `users` exactly as they exist today.

### Idempotency
Not idempotent by design (decision #2, rotation) — calling twice with the same refresh token succeeds once, fails the second time (S-REF-03). This is the intended security property, not a defect.

---

## US-02: Mobile Auto-Refresh (Proactive + Reactive)

**As a** mobile user,
**I want** the app to keep my session alive automatically in the background,
**so that** I never see an unexpected logout while actively using the app.

**Client:** `mobile/` only (`src/lib/axios.ts`, `src/stores/session-store.ts`).

### Main Flow
1. **Proactive path**: whenever `session-store.ts`'s `setTokens` is called (login, activate, or a refresh response), it schedules a single timer for `AccessTokenTTL - 3min` from now, which calls the new `POST /auth/refresh` and re-invokes `setTokens` with the result, rescheduling itself. The timer is cleared on `clear()` (logout) so it never fires after logout.
2. **Reactive path (fallback)**: `apiClient`'s existing response interceptor (`mobile/src/lib/axios.ts`), on receiving a `401` from any request *other than* `/auth/login`, `/auth/refresh`, or `/auth/activate` itself, attempts exactly one `POST /auth/refresh` using the stored refresh token, then retries the original failed request once with the new access token. If the refresh call itself fails (any error), the existing `clear()` force-logout behavior runs unchanged.
3. **De-duplication (decision #4)**: if a refresh is already in flight (started by either path) when another `401` arrives, the second caller awaits the same in-flight refresh promise instead of starting a second `/auth/refresh` call, then retries with whatever token that shared refresh produced (or falls through to `clear()` if it failed).
4. On app cold start, `hydrate()` (existing method) restores tokens from secure storage; this spec adds: if the restored access token is already past (or within the 3-minute proactive window of) its expiry, an immediate refresh is triggered right after hydration rather than waiting for the next scheduled tick or a `401`.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-REF-09 | User is actively using the app, access token is 12 minutes old | Proactive timer fires | New token pair is silently stored; user notices nothing; no screen re-render/navigation occurs | Primary "no more surprise logout" outcome |
| S-REF-10 | App was backgrounded (e.g. phone locked) past the point where the access token expired, with no timer able to fire while backgrounded | User reopens the app and an API call fires (e.g. Home screen refetch) | Original call gets `401`; reactive path refreshes once and retries the original call transparently; user sees the screen load normally, no forced re-login | Covers OS-suspended-timer case — reactive path is the safety net for decision #3 |
| S-REF-11 | Home screen mounts and fires 3 parallel queries (wallets, categories, transactions) simultaneously; access token just expired | All 3 requests get `401` around the same time | Exactly one `POST /auth/refresh` call is made; all 3 original requests are retried with the resulting new access token and succeed | De-duplication (decision #4) — no triple-refresh race |
| S-REF-12 | Refresh token itself is expired (>7 days since login) or was revoked elsewhere | Reactive path attempts `POST /auth/refresh` and it fails with `401` | Existing `clear()` force-logout runs; user is routed to the login screen, same as today's un-refreshed behavior | Un-recoverable session — decision #5, unchanged fallback |
| S-REF-13 | App is cold-started; secure storage has a stored access token that is already expired (app was closed for >15 min) | `hydrate()` completes | An immediate refresh attempt fires right after hydration, before the user reaches any protected screen, rather than waiting for a `401` | Main Flow step 4 — avoids a guaranteed first-request `401` right after a cold start |
| S-REF-14 | A request to `POST /auth/refresh` itself somehow returns `401` (e.g. race with logout, S-REF Edge Case #5) | Reactive path's own refresh attempt fails | `clear()` runs directly — the reactive interceptor does not attempt to retry `/auth/refresh` itself again (no infinite refresh loop) | Guards against recursive refresh attempts |
| S-REF-15 | User explicitly logs out while a proactive timer is pending | `clear()` runs | The pending proactive timer is cancelled; no orphaned `POST /auth/refresh` fires after logout using a now-cleared token | Timer lifecycle tied to session lifecycle |

### Edge Cases
1. **Interceptor must exempt `/auth/login`, `/auth/refresh`, and `/auth/activate` from both the token-attach and the 401-triggers-refresh logic** — attaching a stale `Authorization` header to a refresh call is harmless but pointless, and treating a `401` *from* `/auth/refresh` itself as "try refreshing again" would infinite-loop (S-REF-14).
2. **A request retried once after a refresh must not be retried again if it 401s a second time** — mark the retried request (e.g. a custom axios config flag) so a second failure goes straight to `clear()`, never a second refresh-and-retry cycle for the same original request.
3. **The proactive timer must be cleared and rescheduled, never stacked** — each `setTokens` call cancels any existing pending timer before scheduling a new one, so logging in, then immediately refreshing, never results in two competing timers both eventually firing.
4. **JS timers (`setTimeout`) do not fire while the app is fully backgrounded on iOS/Android** — this is exactly why the reactive fallback (US-02 Main Flow step 2) exists; the proactive path is a best-effort optimization for the foreground case, not the sole mechanism (ties to decision #3).
5. **All refresh attempts and outcomes (success/failure) must be visible in [mobile-debug-console](../mobile-debug-console/spec.md)'s log** as `api` category entries — this is the single most useful diagnostic signal for verifying this feature actually works on-device without an attached debugger.

### Definition of Done
- `session-store.ts` schedules/cancels a proactive refresh timer tied to token lifecycle (`setTokens`/`clear`).
- `axios.ts`'s response interceptor implements reactive refresh-and-retry-once on `401`, with in-flight de-duplication, excluding the auth endpoints themselves from the retry logic.
- Cold-start hydration triggers an immediate refresh if the restored access token is already expired/near-expiry.
- Manual on-device verification: leave the app foregrounded past 15 minutes without touching it, confirm no forced logout occurs (S-REF-09); background past 15 minutes then resume and confirm the app recovers without a forced re-login (S-REF-10).

### Idempotency
The reactive retry is explicitly single-attempt per original request (Edge Case #2) — not naturally idempotent if repeated blindly, which is why the "retry once, then give up" rule exists rather than open-ended retrying.

## Out of Scope

- **Web (`frontend/`) auto-refresh** — same missing capability exists there (`CURRENT_STATE.md`: "no `/auth/refresh` on any client"), but the user's request scopes to mobile; the new `POST /auth/refresh` endpoint is available for web to adopt later using the identical request/response shape, with zero backend changes needed.
- **Refresh-token-theft detection/alerting** — resolved out of scope (Edge Case #3); a stolen-then-used token simply forces the legitimate owner to re-login on their next attempt.
- **Configurable/shorter access-token TTL** — `AccessTokenTTL = 15 * time.Minute` is unchanged; this spec makes the existing TTL invisible to the user, it does not change the TTL itself.
- **"Remember me" / longer-than-7-day sessions** — `RefreshTokenTTL = 7 * 24 * time.Hour` is unchanged; once a refresh token itself expires, full re-login is still required (S-REF-12), by design.
- **Biometric/passcode re-auth on resume** — out of scope; this spec is purely about silent token renewal, not an additional auth gate on app resume.

## Open Questions

1. **Proactive refresh lead time (3 minutes before expiry)**: this spec assumes 3 minutes is enough margin to cover normal request latency and won't fire too early to be wasteful, given the 15-minute TTL — no product/SRS source specifies this number. **Recommend the current assumption** (20% of TTL, a common rule of thumb), but flag for tuning if real-world testing shows the timer still occasionally races an expiry.
2. **Refresh-token-reuse alerting (Edge Case #3)**: flagged as a possible Release-1 follow-up tying into F-10 Notification Handling ("your session may have been used elsewhere") — not required for this MVP slice; confirm this is acceptable to defer.
3. **Should web (`frontend/`) adopt the new endpoint in the same effort?** This spec's backend change is client-agnostic and web has the identical missing-refresh problem noted in `CURRENT_STATE.md` — recommend a fast-follow ticket for web once mobile validates the approach on-device, rather than blocking this spec on it.
