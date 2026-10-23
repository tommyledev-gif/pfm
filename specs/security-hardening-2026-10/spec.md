# Feature Spec: Security & Robustness Hardening, October 2026 (OWASP Top 10 pass)

> Source: owner request 2026-10-23 ("research kỹ, fix toàn bộ 10 OWASP nếu có trong PFM, improve security, performance, API, architecture, maintainable code").
> Status: Hardening of shipped features. Touches F-01 User Management, F-02 System Security, F-06 Transaction Management (import), Feature-12 AI Chat (thread sync, AI Service), infrastructure and CI/CD.
> Clients: none need a release. Every change is server-side, infra or CI. The two user-visible strings (password length, import row cap) arrive through existing error codes the clients already render (`WEAK_PASSWORD`, `INVALID_INPUT`).
> Scenario prefix: `S-HRD-NN`. Feature code for tasks: `HRD`.

## Context

The owner asked for a full OWASP Top 10 (2021) pass over the backend, the AI Service and the infrastructure. The research for this spec read every route, middleware, the token/session code, every hand-written SQL statement (for user isolation), the upload/import paths, the AI Service routers and services, both compose files, the Dockerfiles and the GitHub workflows, and ran `go vet`, the test suites and `govulncheck`.

Most of the system is already in good shape and this spec does **not** redo it: every ID lookup that lacks `AND user_id` is followed by an ownership check in its service (`getOwned*`, `resolveWalletAccess`); tokens pin HMAC and check expiry; sessions are checked on every request; login is timing-equalised and rate limited per IP and per account; uploads are decoded with pixel/byte caps; OTA updates are code-signed; containers run as non-root; Postgres is loopback-only in production.

What remains are the findings below, each verified in code, grouped by OWASP category.

### Findings (verified)

| ID | OWASP 2021 | Finding | Where |
|---|---|---|---|
| F-1 | A06 Vulnerable Components | `fasthttp v1.51.0` has GO-2026-4950 (authorization bypass via double-encoded paths) — the HTTP server under every route. `klauspost/compress v1.18.0` (GO-2026-5841), `excelize` pseudo-version (GO-2026-6695, panic on a crafted pivot cache) — excelize parses **user-uploaded** files. | `backend/go.mod` |
| F-2 | A06 | Runtime image `alpine:3.20` reached end of support 2026-04-01: no more security fixes for `ca-certificates`/musl. | `backend/Dockerfile` |
| F-3 | A04 Insecure Design / A05 | `.xlsx` import opens the upload with excelize defaults: up to **16 GiB** of decompressed data accepted, so a 5 MB zip bomb can exhaust memory/disk. No cap on row count either; a large file produces an import token bigger than the 6 MB body limit, so Commit then fails with an opaque 413. | `TransactionImportService.readWorksheetRows` |
| F-4 | A04 / A07 | A password longer than 72 bytes makes `bcrypt.GenerateFromPassword` fail, which surfaces as **500 INTERNAL_ERROR** on activation and on password change. The length rule is duplicated in two services and the activation page. | `AuthService.Activate`, `SessionRevocationService.ChangePassword` |
| F-5 | A04 | `POST /auth/logout` and `POST /auth/switch-token/revoke` are unauthenticated and write the **unverified** token's `jti`/`exp` into `revoked_tokens`. Anyone can insert unlimited rows with `exp` in year 9999, which retention never purges. Neither route (nor `/auth/refresh`, `/auth/activate`) has any rate limit. | `AuthService.Logout`, `AccountSwitchService.Revoke`, `routes.go` |
| F-6 | A05 Security Misconfiguration | No security response headers anywhere. The two HTML pages the backend serves (`/activate`, `/approve-access`) carry a one-time token in the query string, yet have no CSP, no `frame-ancestors` (the admin approval button can be framed), no `Referrer-Policy`, and may be cached. | `main.go`, `activate_page_handler.go`, `approve_access_page_handler.go` |
| F-7 | A09 Logging & Monitoring | No access log and no request id: an incident cannot be reconstructed (who called what, from where, with what result). The "auth rejected" warning has no client IP. | `main.go`, `response.Error` |
| F-8 | A01 / A07 | The AI Service accepts requests from anyone who can reach it — there is no service-to-service credential, only network placement. Anything on the Docker network (or a future port mapping) can spend the Groq/Anthropic quota and read the prompts. FastAPI's `/docs` and `/openapi.json` are exposed. Request fields have no size bounds. | `ai-service/app/main.py`, schemas, backend AI clients |
| F-9 | A09 | `extract_service` and `category_suggestion_service` log `str(exc)` of provider errors. For a Groq 400 that string contains `failed_generation` — the model's reading of the user's message (amounts, names, notes). `consult_service` and `vision_provider` already avoid this with a code-only helper, duplicated in both files. | `ai-service/app/services/*` |
| F-10 | A04 (reliability) | The Anthropic fallback model `claude-3-5-haiku-20241022` was **retired on 2026-02-19**: every fallback call fails, so any Groq failure is a 503 for the user. | `ai-service/app/core/config.py` |
| F-11 | A04 (resource consumption) | `POST /ai/chat/thread/sync` has no bound on message count, `client_message_id` length or payload size, and upserts one row per round trip without a transaction (a failure half-way leaves the thread half-synced). | `dto.SyncChatThreadRequest`, `ChatThreadService.Sync` |
| F-12 | A05 | Local compose publishes Postgres on all interfaces (`${POSTGRES_PORT}:5432`), so anyone on the same Wi-Fi can reach the dev database. Production containers keep every Linux capability and a writable root filesystem they do not need. | `docker-compose.yml`, `backend/docker-compose.yml` |
| F-13 | A03 Injection (CI) / A08 Integrity | `add-ssh-key.yml` interpolates `${{ github.event.inputs.public_key }}` straight into a remote shell script: the input is executed on the VPS. Third-party actions are referenced by movable tags (a re-pointed tag runs new code with `VPS_SSH_KEY` and Docker Hub secrets in reach — this happened to `trivy-action` tags in 2026). `govulncheck@latest` is unpinned. | `.github/workflows/*` |
| F-15 | A03 / A04 (found during implementation) | `POST /auth/activate` stores `full_name` as sent: no length cap, control or zero-width characters, markup. The profile rename (`normalizeFullName`) refuses all of these because the name is shown to other users; activation skipped it. | `AuthService.Activate` |
| F-14 | Maintainability | Four backend AI clients repeat the same HTTP boilerplate (no response size cap on three of them); two AI Service services repeat the same Groq-primary/Anthropic-fallback tool-call code; `vision_provider` imports a private helper from `extract_service`. | `backend/internal/service/ai_*_client.go`, `ai-service/app/services/*` |

## Preconditions

- Backend, AI Service and Postgres run as today (`backend/docker-compose.yml` in production, root `docker-compose.yml` locally).
- No database schema change is needed by any story.

---

## US-01: Patched dependencies and base image [A06]

**As the** operator, **I want** the API to run on dependency versions without known exploitable advisories **so that** a published bug cannot be used against the server.

### Main Flow
1. `fasthttp` ≥ v1.70.0, `klauspost/compress` ≥ v1.18.7 and the fixed `excelize` revision are required in `go.mod`.
2. The runtime image is a supported Alpine release.
3. `govulncheck ./...` reports no vulnerability in imported packages (module-level advisory for the unused `x/crypto/openpgp` package is not imported and stays informational).

### Scenarios
| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-HRD-01 | Updated `go.mod` | `go build ./... && go test ./...` | Passes | No API change |
| S-HRD-02 | Updated `go.mod` | `govulncheck -show verbose ./...` | No "Package Results" entries | Module-only `x/crypto/openpgp` advisory may remain (not imported) |
| S-HRD-03 | Updated Dockerfile | Image built | Runtime stage is `alpine:3.22` | Supported to 2027-05 |

### Edge Cases
1. A fasthttp minor bump changes defaults Fiber relies on → the full handler/middleware test suite must still pass; any behavior change is a release blocker.
2. excelize stays on a pseudo-version (the repo already tracks master for a fix) — the newer revision is pinned exactly, never `@latest`.
3. The bump must not pull a toolchain change (`go` / `toolchain` lines stay).

### Definition of Done
- [ ] S-HRD-01..03 pass. [ ] `go mod tidy` leaves no diff.

---

## US-02: Import cannot be used to exhaust the server [A04, A05]

**As the** operator, **I want** a crafted `.xlsx` to be refused cheaply **so that** one upload cannot take the API down for everyone.

**API:** `POST /transactions/import/preview` (unchanged contract)

### Main Flow
1. Handler keeps the 5 MiB upload cap.
2. Service opens the workbook with a total decompressed-size cap and a per-part XML cap (both named constants).
3. A workbook whose first sheet has more than **10,000** data rows (header excluded, blank rows excluded) is refused before any row is validated.

### Scenarios
| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-HRD-04 | `.xlsx` whose parts decompress beyond the cap (zip bomb) | Preview | `400 INVALID_INPUT` "Tệp không phải là tệp .xlsx hợp lệ." path, memory stays bounded | Same message as any unreadable workbook — no new code |
| S-HRD-05 | Valid workbook, 10,001 data rows | Preview | `400 INVALID_INPUT` with message "Tệp có quá 10.000 dòng. Tách thành nhiều tệp nhỏ hơn." | Validation error, client's fault |
| S-HRD-06 | Valid workbook, exactly 10,000 data rows | Preview | `200`, rows validated as today | Boundary |
| S-HRD-07 | Valid workbook with 10,000 data rows plus trailing blank rows | Preview | `200` | Blank rows do not count |

### Edge Cases
1. ⚠️ No financial write happens in Preview; Commit is unchanged, so no partial import can result from this story.
2. The cap is checked on data rows, not raw rows, so spreadsheets with formatting-only trailing rows are not refused.
3. A legitimate 5 MB workbook decompresses to well under the cap (OOXML compresses text ~5–10×); the cap is sized at ~20× the upload limit.

### Out of Scope
- Moving the import token to server-side storage (spec `transaction-export-import` Open Question #3).

### Definition of Done
- [ ] S-HRD-04..07 covered by service tests.

---

## US-03: Password length is a validation error, never a 500 [A07, A04]

**As a** User activating an account or changing a password, **I want** an over-long password to be refused with a clear message **so that** I know what to change instead of seeing "an unexpected error occurred".

**API:** `POST /auth/activate`, `PUT /users/me/password`

### Main Flow
1. One password rule lives in `common` and is applied by both services: at least 8 characters, at most 72 bytes (bcrypt's input limit).
2. Breaking the max returns `400 WEAK_PASSWORD` with "Mật khẩu tối đa 72 ký tự không dấu."
3. `/activate` page checks the same byte length before submitting.
4. Login (`POST /auth/login`) is unchanged: bcrypt compare never errors on long input. Its DTO gains `max=256` like the change-password DTO already has, so a multi-megabyte password field is rejected at the boundary.
5. (F-15) A display name given at activation follows the profile name rules (NFC, collapsed spaces, ≤ 60 characters, letters/digits/space and `. , ' ’ -`). A violation is `400 INVALID_FULL_NAME` with the same message the profile screen shows; the `/activate` page checks it on blur and shows it under the name field. The invite is not consumed.

### Scenarios
| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-HRD-08 | Valid invite token | Activate with a 73-byte password (ASCII) | `400 WEAK_PASSWORD`, invite token not consumed | Was 500 |
| S-HRD-09 | Valid invite | Activate with 72 ASCII bytes | `200` | Boundary |
| S-HRD-10 | Valid invite | Activate with 30 Vietnamese characters that encode to > 72 bytes | `400 WEAK_PASSWORD` | Bytes, not runes, are what bcrypt reads |
| S-HRD-11 | Signed-in user, correct current password | Change to a 73-byte password | `400 WEAK_PASSWORD`; old password still works; no session ended | Was 500 after sessions were checked |
| S-HRD-12 | Any | Login with a 300-char password field | `400 INVALID_INPUT` | DTO `max=256` |
| S-HRD-12b | Valid invite | Activate with full name `<script>`, a 61-char name, or one with a NUL / zero-width character | `400 INVALID_FULL_NAME`, invite not consumed | Was stored as sent |
| S-HRD-12c | Valid invite | Activate with `"  Lê   Thị  Lan "` | `200`, stored as `Lê Thị Lan` | Same normalisation as the profile screen |

### Edge Cases
1. Existing accounts whose password exceeds 72 bytes cannot exist (hashing would have failed), so no migration.
2. The check runs before the invite lookup's bcrypt work, so an over-long password costs no hashing.
3. The message names "không dấu" because a letter with diacritics takes 2–3 bytes; the count is exact for unaccented text.

### Definition of Done
- [ ] S-HRD-08..12 covered by service/handler tests. [ ] No other `bcrypt.GenerateFromPassword` caller remains unguarded.

---

## US-04: Unauthenticated token endpoints cannot be abused [A04, A07]

**As the** operator, **I want** logout/revoke to only ever record tokens this server issued, and the public token routes to be rate limited, **so that** nobody can fill the deny-list or hammer the database without a credential.

**API:** `POST /auth/logout`, `POST /auth/switch-token/revoke`, `POST /auth/refresh`, `POST /auth/activate`

### Main Flow
1. Logout verifies the refresh token (signature + expiry).
   - Session-bound → that session ends (as today).
   - Verified, pre-session (legacy) → its `jti` is deny-listed with its real `exp` (as today).
   - Malformed (not a JWT) → `400 INVALID_INPUT` (as today).
   - Signature invalid or already expired → `200`, nothing written. A token that fails verification can never be refreshed anyway, so there is nothing to revoke.
2. Switch-token revoke follows the same rule with the switch-token parser.
3. One shared per-IP limiter (60 requests / minute / client IP, IPv6 by /64) covers `/auth/refresh`, `/auth/logout`, `/auth/activate`, `/auth/switch-token/revoke`.

### Scenarios
| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-HRD-13 | Token signed with another key, `exp` = year 9999 | `POST /auth/logout` | `200`; `revoked_tokens` unchanged | Was: row inserted |
| S-HRD-14 | Expired genuine refresh token | Logout | `200`; nothing written | Idempotent as before |
| S-HRD-15 | Genuine session-bound refresh token | Logout | `200`; session revoked | Unchanged |
| S-HRD-16 | Genuine legacy (no `sid`) refresh token | Logout | `200`; `jti` deny-listed | Unchanged |
| S-HRD-17 | Body `refresh_token: "abc"` | Logout | `400 INVALID_INPUT` | Unchanged |
| S-HRD-18 | Forged switch token | `POST /auth/switch-token/revoke` | `200`; nothing written | Was: row inserted (or 500 on FK) |
| S-HRD-19 | Same client IP | 61st request within one minute across the four routes | `429 RATE_LIMITED` | Shared counter |

### Edge Cases
1. ⚠️ An old app build logging out with an expired token still gets `200` — client behavior unchanged.
2. Households behind one NAT share the limit; 60/min is ~4× the busiest legitimate pattern (each saved account refreshes once per 15 min; activation is a handful of submits).
3. The limiter keys on `ClientIP` (Cloudflare-aware), never `c.IP()`.

### Definition of Done
- [ ] S-HRD-13..19 covered. [ ] `ParseRefreshTokenUnverified` / `ParseSwitchTokenUnverified` removed (no caller left).

---

## US-05: Security headers and a locked-down HTML surface [A05]

**As the** operator, **I want** every response to carry safe browser defaults and the token-bearing pages to allow nothing but their own inline code **so that** clickjacking, MIME sniffing, token leakage via Referer and injected script are all ruled out.

### Main Flow
1. Every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`, `Strict-Transport-Security: max-age=31536000` (browsers ignore it over plain HTTP, so local dev is unaffected), `Permissions-Policy` denying camera/microphone/geolocation.
2. `/activate` and `/approve-access`: additionally `Content-Security-Policy` with `default-src 'none'`, the page's own inline script and style allowed **by SHA-256 hash only**, `connect-src 'self'`, `form-action 'none'`, `frame-ancestors 'none'`, `base-uri 'none'`; and `Cache-Control: no-store`.
3. Hashes are computed from the page constants at startup, so editing a page can never silently break its CSP.

### Scenarios
| ID | Given | When | Then |
|---|---|---|---|
| S-HRD-20 | Any API route | Request | Response carries the six baseline headers |
| S-HRD-21 | `GET /activate?token=…` | Request | CSP present with two `sha256-` sources matching the page's script and style; `Cache-Control: no-store` |
| S-HRD-22 | A page is edited | Server starts | CSP hashes match the new content (computed, not hand-copied) |
| S-HRD-23 | Error response (404/500) | Request | Baseline headers present too |

### Edge Cases
1. OTA manifest/asset and APK responses keep their own `Cache-Control`; the headers above do not touch caching.
2. CORS behavior is unchanged (headers are additive).
3. `X-Frame-Options` and CSP `frame-ancestors` are both sent (old and new browsers).

### Definition of Done
- [ ] S-HRD-20..23 covered by middleware/handler tests.

---

## US-06: Every request is traceable [A09]

**As the** operator, **I want** one structured log line per request with a request id, **so that** I can reconstruct an incident and correlate a user's report with server logs.

### Main Flow
1. Each request gets an id: the client's `X-Request-ID` when it is a well-formed UUID, otherwise a new UUID. The id is returned in the `X-Request-ID` response header.
2. After the handler runs, one log line: `request_id`, `method`, route **path without query string** (tokens travel in query strings on `/activate`), `status`, `latency_ms`, `ip` (ClientIP), `user_id` when authenticated, response size.
3. 5xx at `error` level, 4xx at `warn` only for 401/403/429 (security signals), everything else `info`. Successful health probes are not logged.
4. "auth rejected" and "unhandled error" log lines include `request_id` and `ip`.

### Scenarios
| ID | Given | When | Then |
|---|---|---|---|
| S-HRD-24 | No `X-Request-ID` | Any request | Response has a UUID `X-Request-ID`; log line carries the same id |
| S-HRD-25 | `X-Request-ID: <uuid>` | Request | Echoed unchanged |
| S-HRD-26 | `X-Request-ID: "a\nb"` / 300 chars | Request | Ignored, a new UUID is used (no log injection) |
| S-HRD-27 | `GET /activate?token=SECRET` | Request | Log has `path=/activate`, never `SECRET` |
| S-HRD-28 | `GET /api/v1/health` returns 200 | Probe | No log line |

### Edge Cases
1. Never logged: query strings, headers (Authorization, device headers), request or response bodies.
2. Panics are still caught by `Recover` (first middleware); the request logger sits after it and logs the resulting 500.

### Definition of Done
- [ ] S-HRD-24..28 covered by middleware tests.

---

## US-07: The AI Service only answers the backend [A01, A07, A05]

**As the** operator, **I want** the AI Service to require a shared secret from the backend, hide its API docs and bound its inputs, **so that** nothing else on the network can spend the LLM quota or read prompts.

### Main Flow
1. New env `AI_SERVICE_TOKEN` (≥ 32 bytes) shared by both services through `.env.prod`.
2. Backend sends it as `X-Internal-Token` on every AI Service call.
3. AI Service: when the token is configured, every route except `/health` requires the header (constant-time compare) → otherwise `401`. When it is not configured, requests pass and a warning is logged once at startup (keeps existing deployments working until the env is set).
4. AI Service serves no `/docs`, `/redoc`, `/openapi.json` unless `AI_SERVICE_EXPOSE_DOCS=true` (local only).
5. Request schemas get upper bounds that sit above what the backend can send: message 4,000 chars, history 50 turns, wallets 200, categories 500, image base64 8 MiB, caption 500, max_items ≤ 50.

### Scenarios
| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-HRD-29 | Token configured | `POST /extract` without header | `401` | System → backend maps any non-200 to its existing 502/degraded path |
| S-HRD-30 | Token configured | Wrong header | `401` | Constant-time compare |
| S-HRD-31 | Token configured | Correct header | Normal response | |
| S-HRD-32 | Token configured | `GET /health` without header | `200` | Docker healthcheck has no secret |
| S-HRD-33 | Token not configured | Any route | Works as today | Rollout safety |
| S-HRD-34 | Default config | `GET /docs` | `404` | |
| S-HRD-35 | Token configured | Backend calls `/extract` | Header present, call succeeds | Backend client test |
| S-HRD-36 | `message` of 5,000 chars | `POST /extract` | `422` | Backend never sends > 1,000 |

### Edge Cases
1. ⚠️ Rollout order: deploy both images first, then add `AI_SERVICE_TOKEN` to `VPS_ENV_PROD` and redeploy. Set on only one side, every AI call fails (backend degrades to 502 `AI_SERVICE_UNAVAILABLE`, no data written — AI calls never write money).
2. A token shorter than 32 bytes is refused at backend startup when set (same stance as `JWT_SECRET`).
3. The token is never logged on either side.

### Definition of Done
- [ ] S-HRD-29..36 covered (pytest + Go client test). [ ] Both compose files pass the variable to both services. [ ] Runbook documents rollout and rotation.

---

## US-08: AI Service logs never contain user content; the fallback works again [A09, A04]

**As the** operator, **I want** provider errors logged as type + status + provider code only, and the fallback pointed at a live model, **so that** logs carry no personal data and a Groq outage does not take the chat down.

### Main Flow
1. One helper describes a provider error for logs: `error_type`, `status_code`, `error_code`. All four services use it; no `str(exc)` of a provider error reaches a log.
2. Groq-primary/Anthropic-fallback tool calling lives in one module used by extract and category suggestion; schema helpers (`$ref` inlining) live in a shared module, not in `extract_service`.
3. Default fallback model becomes `claude-haiku-5-5` (successor of the retired Haiku line). Its requests send no `temperature` (that model rejects non-default sampling with 400); forced tool choice stays (supported, it skips thinking). Output is still validated by the Pydantic schema; a reply without a tool call (including `stop_reason: "refusal"`) is a failure handled like today.

### Scenarios
| ID | Given | When | Then |
|---|---|---|---|
| S-HRD-37 | Groq raises a 400 whose body has `failed_generation: "…user text…"` | `/extract` falls back | Log record has `error_code`, `status_code`, no `failed_generation` text |
| S-HRD-38 | Groq fails, Anthropic succeeds | `/extract` | 200 with the Anthropic result |
| S-HRD-39 | Anthropic request built | Inspect kwargs | `model == settings.anthropic_model`, no `temperature` key, forced tool choice |
| S-HRD-40 | Both fail | `/extract` / `/suggest-category-name` | 503 as today |

### Out of Scope
- Changing the Groq models or prompts.

### Definition of Done
- [ ] S-HRD-37..40 covered by pytest with fakes (no live call). [ ] Existing 221 tests still pass.

---

## US-09: Chat thread sync is bounded and atomic [A04, performance]

**API:** `POST /ai/chat/thread/sync`

### Main Flow
1. Request bounds: 1–500 messages, `client_message_id` 1–200 chars, each `payload` a JSON value of at most 64 KiB.
2. All upserts of one request run in one database transaction, sent as one batch (one round trip).

### Scenarios
| ID | Given | When | Then |
|---|---|---|---|
| S-HRD-41 | 501 messages | Sync | `400 INVALID_INPUT` |
| S-HRD-42 | One payload of 65 KiB | Sync | `400 INVALID_INPUT` naming the field |
| S-HRD-43 | 3 valid messages, DB fails on the 2nd | Sync | `500`; none of the 3 written |
| S-HRD-44 | 200 valid messages | Sync | `200`; one round trip |

### Edge Cases
1. Mobile sends only changed messages (ids like `msg_<ms>_<n>`, ~25 chars) — far inside the bounds. An older build resending a long thread is still within 500 per request in practice; if not, it gets 400 and retries on the next change (sync is a cache, never the source of money data).

### Definition of Done
- [ ] S-HRD-41..44 covered (service + repository integration test).

---

## US-10: Infrastructure least privilege [A05]

### Main Flow
1. Local compose binds Postgres to `127.0.0.1` by default (`POSTGRES_BIND_ADDRESS` to override).
2. Production `pfm-backend` and `ai-service`: `read_only: true`, `tmpfs: /tmp`, `cap_drop: [ALL]`, `security_opt: [no-new-privileges:true]`. The AI image sets `PYTHONDONTWRITEBYTECODE=1` and uvicorn runs with `--no-server-header`.
3. Both services receive `AI_SERVICE_TOKEN`.

### Scenarios
| ID | Given | When | Then |
|---|---|---|---|
| S-HRD-45 | Hardened backend container | Start, `/api/v1/health/ready`, an `.xlsx` import, an upload | All work |
| S-HRD-46 | Hardened ai-service container | Start, `/health` | Works |
| S-HRD-47 | `docker compose config` on both files | Render | Valid |

### Edge Cases
1. ⚠️ Postgres keeps its current settings (its entrypoint switches user at start); only stateless services are locked down.
2. `/data/app-updates` stays a read-only bind mount.

---

## US-11: CI cannot be turned against the VPS [A03, A08]

### Main Flow
1. `add-ssh-key.yml` passes the key through an environment variable, validates it as one OpenSSH public-key line, and never interpolates it into the script.
2. Every third-party action is pinned to a full commit SHA with the version in a comment.
3. `govulncheck` is installed at a fixed version.

### Scenarios
| ID | Given | When | Then |
|---|---|---|---|
| S-HRD-48 | Input `ssh-ed25519 AAA… x"; rm -rf ~ #` | Workflow runs | Rejected by the format check, nothing executed |
| S-HRD-49 | All workflows | grep `uses:` | Every non-local `uses:` ends in a 40-hex SHA |

---

## US-12: One AI client path in the backend [maintainability, A04]

### Main Flow
1. The four backend AI clients share one helper that marshals the request, sets `Content-Type` and `X-Internal-Token`, checks the status, and decodes a size-capped body (1 MiB).
2. Each client keeps its own wire types and status handling (image keeps its 429 busy branch).
3. `AnalyticsService.visibleCategories` loads all requested categories in one query (`GetCategoriesByIDs`), keeping the first-failure-in-request-order semantics.

### Definition of Done
- [ ] Existing client/service tests pass unchanged. [ ] New test: oversized AI response → error, not unbounded read.

---

---

## Second pass (2026-10-23, owner: "fix the rest")

Items first listed as out of scope, plus what the first pass's testing found. Each is fixed and tested.

| ID | OWASP | Finding | Fix | Verified by |
|---|---|---|---|---|
| F-16 | ⚠️ A04 (money) | Import keyed rows by content only: two identical purchases in one file (same day, amount, category, wallet, note) collapsed into one Transaction, the second reported as "skipped". | The n-th repeat of a content key gets a key derived from it (`occurrenceKey`); the first copy keeps the plain key, so files imported earlier still match and re-importing stays a no-op. | `TestImport_IdenticalRowsAreTwoTransactions` |
| F-17 | A04 | `AIChatRateLimiter` sat on the whole `/ai` group, so the thread sync after every message spent the 30/hour model budget: ~15 messages locked a user out of chat. | Per-route limiters: model routes (`/ai/chat`, `/ai/suggest-category-name`) share one 30/hour budget; thread GET/sync and wizard prefill/proposals get `AILocalRateLimiter` (600/hour). | `rate_limit_ai_test.go` |
| F-18 | A05 | Account-deletion operator email hard-coded in backend and in the app bundle. | `ACCOUNT_DELETION_OPERATOR_EMAIL` (empty = tool closed); `GET /users/me` returns `can_delete_accounts`; the app reads that instead of carrying the email. | `TestAccountDeletionPolicy`, `TestGetMe_CanDeleteAccounts` |
| F-19 | 🔴 A07 | `TEST_ACCOUNTS` (mobile) shipped in release bundles, which are downloadable without sign-in (OTA, APK), with password `change-me-123` for accounts that include the deletion-tool admin. | List is `__DEV__`-only, like `DEV_LOGIN`. **The passwords themselves must be changed in production: old bundles stay public.** | tsc, eslint |
| F-20 | A08 / A03 | Deploy scripts pasted `VPS_ENV_PROD` and the Docker Hub token into the remote script text (`$`, backticks, quotes were expanded or executed); images (and `:latest`) were pushed before the Trivy scan, which never blocked. | Secrets travel via `envs` (drone-ssh exports them single-quoted, verified against its 1.8.0 source and a simulation: `.env.prod` is byte-identical to the secret). Build → scan (blocking, HIGH/CRITICAL with a fix) → push. | Local Trivy baseline: 0 findings on both images |
| F-21 | Maintainability | 15 Go files over the 300-line rule; `.pyc` files tracked in git. | Split at declaration boundaries (no code change, declaration counts equal before/after); `.pyc` untracked (already in `.gitignore`). | Full test suite incl. live Postgres and `-race` |
| — | Client | Mobile import calls used the 15 s default timeout; a 10,000-row commit takes ~47 s. | Preview 60 s, commit 180 s per request. | — |

## Out of Scope

- Web client (`frontend/`, frozen).

## Open Questions

1. **Import row cap = 10,000** (explicit assumption): derived from the 6 MiB body limit on Commit (~340 bytes of base64 token per row, so 10,000 rows stay near 3.5 MB and leave room for long notes; 20,000 was the first estimate and does not fit). Owner may prefer a different number.
2. **Public token-route limit = 60/min/IP** (explicit assumption).
3. **Fallback model** `claude-haiku-5-5` (assumption: keep the Haiku tier the project chose). Needs `ANTHROPIC_API_KEY` set in production to matter at all.
4. **`AI_SERVICE_TOKEN` enforcement** is opt-in until the env var is set; owner decides when to roll it out (runbook steps provided).
