# PFM — Tech Stacks

_Last updated: 2026-08-22_
_Updated by: /renew-docs_

> Versions extracted from actual config files (`backend/go.mod`, `mobile/package.json`, `frontend/package.json`, `docker-compose.yml`, `.github/workflows/*`), not from memory or prior planning docs.
>
> **2026-08-22 update:** confirmed via `git log --date=format:...` (not assumed) — the prior "2026-08-21" doc pass was written early that day, so most of what follows is dated 2026-08-21 too, just later. One dependency addition, `expo-splash-screen` (commit `ed677b7`, 2026-08-21 16:13, bundled with the mobile app's rename to "Budgest"); no backend/frontend/AI-service *library* dependency changes, though backend gained a new *endpoint* (`POST /auth/refresh`) and two additive migrations (wallet/budget icon columns), both 2026-08-21 (`5d4718e`/`5bbb85d`/`f7487dc`). Only one new GitHub Actions workflow, `add-ssh-key.yml`, is actually dated **2026-08-22** (`2fd2d87`, 09:09). See §1, §2, §7, §9 (decision log) below.

---

## Implementation Status

| Component | Status |
|---|---|
| Backend (Go) | **Done for MVP** — F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-10 all implemented in `backend/`, plus Feature-12 AI Chat (US-01 only). Since 2026-08-16: category photo upload (R2), real SMTP invite emails, a self-served `/activate` HTML page. Since 2026-08-21: `POST /auth/refresh` (rotating refresh tokens), Wallet/Budget icon upload (`POST /wallets/icon`, `POST /budgets/icon`, migrations 013/014), `GET /api/v1/health` deploy-verification probe |
| Web frontend (Next.js, `frontend/`) | **Done for MVP** — `features/{auth,users,wallets,categories,budgets,transactions,reports,notifications,ai-chat}` all exist |
| Mobile (React Native/Expo, `mobile/`) | **Full feature parity with backend MVP, plus mobile-only extras, as of 2026-08-22** — rebuilt from Flutter to React Native (Expo) on 2026-08-16, then (commits `455bfb1` → `fe4f6cc`) every Profile entry-point row that used to be inert became a real CRUD screen: Wallets, Categories (+ photo upload), Budgets, Transactions, Users (admin invite), AI Chat, Notifications. Since then: Wallet/Budget icon upload, session auto-refresh, a Debug Console, and Loading Skeletons all shipped (§1). App renamed to "Budgest". Ships as an EAS-built internal `.apk` (`mobile/eas.json`) |
| AI Service (Python) | **Implemented** — `ai-service/`, Feature-12 US-01 only (create-transaction-via-chat); Groq primary / Anthropic fallback via tool/function calling |
| Infra (Docker Compose) | `postgres`, `backend`, `ai-service`, `web` (Next.js). `mobile/` is deliberately **not** containerized — ships via EAS Build instead (see §CI/CD). No `redis`/`nginx` |
| CI/CD (GitHub Actions) | **Implemented since last update** — `ci-pr.yml` (PR gate), `backend-test.yml` (shared `go vet`/`go test`), `deploy-backend.yml` and `deploy-ai-service.yml` (path-filtered auto-deploy to the VPS on push to `develop`) — see §6 |
| API spec (`api-spec/openapi.yaml`) | **Not started** — no `api-spec/` directory; `docs/open-ai.md` is a hand-drafted, aspirational OpenAPI 3.1 sketch, not a generated/enforced contract, and it is already ahead of actual code in places (documents `/auth/refresh`, though `CreateTransactionRequest.idempotency_key` is now real) |

---

## Architecture Overview

```
[Next.js Web (frontend/)] ─┐
                            ├─▶ [Go + Fiber Backend :8080] ──▶ [PostgreSQL 16-alpine]
[React Native (mobile/, Expo)] ─┘   (mobile calls the backend directly — no BFF, unlike frontend/)
                                            │
                                            ▼
                                 [Python AI Service :8000] (internal only, Groq primary / Anthropic fallback)
```

---

## 1. Mobile App (React Native + Expo, `mobile/`) — rebuilt 2026-08-16, screens built same session, extended through 2026-08-21/22

`mobile/` was deleted (Flutter) and rebuilt from scratch as React Native + Expo, then had its full screen set built against the design handoff. See `docs/architecture.md` §3 for the full rationale and structure.

⚠️ **Pinned to SDK 54, not the latest (57)** — two rounds of trial and error the same day: 57 → real-device Expo Go failure → 56 → same failure → confirmed via the tester's own Expo Go app (Profile tab: client `54.0.8`, "supported SDK 54") that the Play Store build was several SDKs behind, not just one. Downgrading `expo` alone isn't enough — use `npx expo install --fix` to realign every dependent package, and if that hits an `ERESOLVE` peer conflict, `rm -rf node_modules package-lock.json && npm install` first. Full story in `mobile/AGENTS.md`; don't bump the SDK again without having someone check Expo Go's own Profile tab on a real device first.

| Layer | Package | Version | Notes |
|---|---|---|---|
| Framework | `expo` | `^54.0.36` | `mobile/package.json` |
| Runtime | `react-native` | `0.81.5` | |
| UI library | `react` | `19.1.0` | |
| Language | `typescript` | `~5.9.2` | strict mode, `@/*` path alias to `src/*` (Metro/Expo CLI supports `tsconfig` paths natively — no `babel-plugin-module-resolver` needed) |
| Routing | `expo-router` | `~6.0.24` | file-based, `Stack.Protected guard={...}` for auth gating — verified present and working at this version too, not assumed from newer-SDK docs |
| Navigation deps | `react-native-safe-area-context` / `react-native-screens` | `~5.6.0` / `~4.16.0` | required by `expo-router` |
| Web preview | `react-native-web` / `react-dom` | `^0.21.2` / `19.1.0` | enables `npx expo start --web` |
| Server state | `@tanstack/react-query` | `^5.101.4` | same choice as `frontend/` — one state-management mental model across both clients |
| Client/global state | `zustand` | `^5.0.15` | same choice as `frontend/`; used for the session store only so far |
| HTTP client | `axios` | `^1.19.0` | calls the Go backend directly (no BFF — mobile has no server tier to hide the JWT behind) |
| Secure storage | `expo-secure-store` | `~15.0.8` | JWT access + refresh token storage, plus the login email (see below) |
| SVG / icons + chart | `react-native-svg` | `15.12.1` (pinned) | Hand-drawn icon set (`src/components/ui/Icon.tsx`) + the Insights donut chart, no icon font/charting library |
| Blur | `expo-blur` | `~15.0.8` | `BlurView` behind the floating bottom-nav pill |
| Image picking | `expo-image-picker` | `~17.0.11` | Icon photo upload — Category (`CategoryFormModal.tsx`), and (**new 2026-08-21**) Wallet (`WalletFormModal.tsx`) + Budget forms, all via `POST /{categories,wallets,budgets}/icon` |
| Splash screen | `expo-splash-screen` | `~31.0.13` | **New 2026-08-21** — custom splash image + background color config plugin, added with the app rename to "Budgest" |
| Date pickers | `react-native-calendars` | `^1.1314.0` | Transaction date + report date-range filters (`DateRangePickerModal`/`SingleDatePickerModal`) |
| Storage (transitive) | `@react-native-async-storage/async-storage` | `2.2.0` | Peer dependency of another package, not used directly — session persistence stays on `expo-secure-store` |

**Dev dependencies:** `typescript ~5.9.2`, `eslint ^9.0.0` + `eslint-config-expo ~10.0.0` (installed via `npx expo lint`). ⚠️ `expo-status-bar` (`~3.0.9`, a regular dependency for the native module) must still not be listed in `app.json`'s `plugins` array on this SDK — breaks with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` if present; confirmed still excluded from `plugins` as of 2026-08-22.

**Not yet installed:** any form library — every Drawer-based form (Wallet/Category/Budget/Transaction) is plain `useState`, small enough not to need `react-hook-form`. No offline/local-DB layer (the old Flutter stack listed `drift` as intended but never adopted it; TanStack Query's cache is still the only client persistence). No gesture/animation library (`react-native-reanimated`, `react-native-gesture-handler`) either — the new Debug Console's draggable bubble and the Loading Skeletons' pulse animation are both built on React Native core's `PanResponder`/`Animated` APIs instead, a deliberate choice to avoid a native module that would force a fresh EAS build (see decision log, §9).

**Session refresh, Debug Console, and Loading Skeletons all landed in one commit** (`5d4718e`, 2026-08-21 14:37 — its message, "enhancement: skeleton, add debug bubble", doesn't even mention the refresh work bundled into it; confirmed by checking which commit touched `mobile/src/lib/refresh-scheduler.ts`/`backend/internal/service/auth_service.go`/`specs/mobile-session-refresh/`):

- **Session refresh** (`specs/mobile-session-refresh/`): no new package — `lib/refresh-scheduler.ts` (proactive timer) and `stores/session-store.ts`'s `refreshSession()` (reactive, de-duplicated via a module-level promise) both call `POST /auth/refresh` using plain `axios`/`expo-secure-store` already in the dependency set.
- **Debug Console** (`specs/mobile-debug-console/`): `src/components/debug/{DebugBubble,DebugLogViewer}.tsx` + `src/stores/debug-log-store.ts` (in-memory 500-entry ring buffer, cleared on cold start — no persistence layer). Ships in every build, including release `.apk`, not gated behind `__DEV__`.
- **Loading Skeletons** (`specs/mobile-loading-skeletons/`): `src/components/ui/SkeletonBlock.tsx` (shared pulsing-opacity primitive on RN's `Animated` API) + one skeleton composition per screen (Home, Transactions, Insights, Categories, Users) — UI-only, no new dependency, no query/DTO change.

**App identity (new 2026-08-21, `ed677b7`):** `app.json`'s `expo.name` is now `"Budgest"` (Android package unchanged, `com.example.pfm`), with a new app icon, splash image, and logo asset.

**Distribution:** EAS Build (`mobile/eas.json`, CLI `>= 12.0.0`) — a `preview` profile (`buildType: apk`, internal distribution) and a `production` profile (`autoIncrement: true`), both hardcoded to `EXPO_PUBLIC_API_BASE_URL=https://api.example.com/api/v1` (no separate staging target). Matches CLAUDE.md's "no App Store/Play Store — `.apk`/`.ipa` test builds only" constraint.

**No `GET /users/me` endpoint exists** — the JWT's `AccessClaims` carry only `user_id`/`role`, no name/email (`backend/internal/service/token_service.go`). Profile's displayed name/email come from the email typed at login, persisted via `expo-secure-store` alongside the tokens (`src/stores/session-store.ts`) — not re-verified against the server on each load.

---

## 2. Backend — Go

| Layer | Library | Version | Status |
|---|---|---|---|
| Go | — | `1.23.0` (bumped from `1.22`) | `go.mod` |
| Web framework | `github.com/gofiber/fiber/v2` | `v2.52.5` | ✅ |
| DB driver | `github.com/jackc/pgx/v5` | `v5.6.0` | ✅ — used by sqlc-generated code |
| Query layer | `sqlc` | config in `backend/sqlc.yaml` (`sql_package: pgx/v5`) | ✅ — generates into `internal/repository/sqlc`; no GORM anywhere |
| Auth | `github.com/golang-jwt/jwt/v5` | `v5.2.1` | ✅ — access + refresh tokens; `POST /auth/refresh` implemented since 2026-08-21 (`AuthService.Refresh`, rotates on each use, checked against `revoked_tokens`) |
| Validation | `github.com/go-playground/validator/v10` | `v10.22.0` | ✅ |
| UUID | `github.com/google/uuid` | `v1.6.0` | ✅ |
| Logging | `go.uber.org/zap` | `v1.27.0` | ✅ |
| Password hashing | `golang.org/x/crypto` (bcrypt) | `v0.36.0` (bumped from `v0.24.0`) | ✅ |
| Object storage | `github.com/minio/minio-go/v7` | `v7.0.90` | ✅ — new since last update; S3-compatible client used against Cloudflare R2 for category-icon photo uploads (`internal/service/icon_uploader.go`), not against any actual MinIO server |
| Email | stdlib `net/smtp` (no third-party SMTP dependency) | — | ✅ — new since last update; `internal/service/smtp_email_sender.go` sends invite-activation emails, behind an `EmailSender` interface with a `LogEmailSender` fallback when `SMTP_HOST` is unset |
| Rate limiting | Fiber's built-in `middleware/limiter` | (bundled with `fiber/v2`) | ✅ — used for `/auth/login` (by IP) and `/admin/users/invite` (by user ID); no other route is rate-limited yet |
| Migrations | Numbered `.sql` files under `backend/db/migrations/`, mounted directly into Postgres's `docker-entrypoint-initdb.d/` | — | ⚠️ manual — `golang-migrate` is not a dependency in `go.mod`; no automated apply-on-boot for an existing DB volume |
| API spec generation | — | — | ❌ not adopted — no `oapi-codegen`/`api-spec/openapi.yaml`; handlers/DTOs in `internal/handler/`, `internal/dto/` are hand-written |

**Why sqlc over GORM:** type-safe generated Go from raw SQL, no N+1/reflection surprises, handles the project's `GROUP BY`/`SUM`/date-range aggregate queries (Budget spend, Financial Reporting) directly.

---

## 3. AI Service — Python (`ai-service/`) — implemented (Feature-12 US-01 only)

Per `specs/ai-chat-assistant/spec.md` (Release 1, "Create Transaction via Chat" only — no edit/query/advice intents).

| Layer | Package | Version | Notes |
|---|---|---|---|
| Framework | `fastapi` | `0.141.1` | `ai-service/requirements.txt` |
| ASGI server | `uvicorn` | `0.52.3` | |
| Validation | `pydantic` | `2.13.4` | `model_json_schema()` doubles as the tool/function-calling schema passed to both LLM providers — single source of truth, see below |
| Settings | `pydantic-settings` | `2.15.0` | |
| LLM (primary) | `groq` | `1.6.0` | Free tier — budget constraint noted in `docs/features.md` §6 |
| LLM (fallback) | `anthropic` | `0.122.0` | Only invoked on a Groq exception/timeout |
| HTTP client | `httpx` | `0.28.1` | |
| Internal transport | REST over the Docker network | — | `docker-compose.yml`'s `ai-service` entry, internal-only, no host port; reached at `http://ai-service:8000/extract` via `AI_SERVICE_URL` |

**Tool/function calling, not prose-described JSON mode** — found necessary via live testing: with `response_format: {"type": "json_object"}` and a prose-described schema, Groq returned different field names than requested (`amount`/`type`/`date` instead of `amount_vnd`/`tx_type`/`occurred_at`). Forcing a tool call against `ExtractResponse.model_json_schema()` (same schema used for Pydantic validation) makes the provider's output structurally conform by construction. Both Groq (`tools`/`tool_choice`) and Anthropic (`tools`/`tool_choice`) use this same approach.

**`temperature=0`** — the SDK default was observed to return a different, sometimes wrong, Category for the identical input across repeated calls; this is a deterministic-classification task, not creative generation.

---

## 4. Web Frontend — Next.js (`frontend/`)

| Layer | Package | Version |
|---|---|---|
| Framework | `next` | `^15.0.2` |
| UI library | `react` / `react-dom` | `^19.0.0` |
| Data fetching | `@tanstack/react-query` | `^5.59.0` |
| HTTP client | `axios` | `^1.7.7` |
| State | `zustand` | `^5.0.0` |
| Styling | `tailwindcss` | `^3.4.14` (+ `tailwindcss-animate ^1.0.7`, `autoprefixer ^10.4.20`) |
| UI primitives | `@radix-ui/react-{dialog,label,select,slot}` | `^1.1.x` / `^2.1.x` |
| Utility | `class-variance-authority`, `clsx`, `tailwind-merge` | `^0.7.0` / `^2.1.1` / `^2.5.4` |
| Icons | `lucide-react` | `^0.454.0` |
| Type checking | `typescript` | `^5.6.3` |
| Lint | `eslint` + `eslint-config-next` | `^9.13.0` / `^15.0.2` |

**BFF pattern:** `frontend/src/app/api/proxy/[...path]/route.ts` proxies every backend call server-side to `API_PROXY_TARGET` (`http://backend:8080` in compose); `frontend/src/app/api/auth/{activate,login,logout}` are thin dedicated passthroughs.

---

## 5. Database

| Tool | Version | Notes |
|---|---|---|
| PostgreSQL | `16-alpine` (`docker-compose.yml` image tag) | Primary DB |
| Extensions | `uuid-ossp` (`001_init.sql`) | No `pgvector` enabled anywhere — earlier planning docs describing it as active were incorrect |

---

## 6. Infrastructure

| Tool | Purpose |
|---|---|
| Docker Compose (`docker-compose.yml`, repo root) | Orchestrates `postgres`, `backend`, `ai-service`, `web` (Next.js) on one bridge network (`pfm_network`). `mobile/` is not a service — see §1 |
| — | No Nginx, Redis, or reverse-proxy service defined |

---

## 7. CI/CD (GitHub Actions, `.github/workflows/`) — new since last update

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci-pr.yml` | PR → `develop` | Gate check, no deploy |
| `backend-test.yml` | `workflow_call` from `ci-pr.yml` / `deploy-backend.yml` | `go vet` + `go test` — single definition shared by both callers |
| `deploy-backend.yml` | Push to `develop` touching `backend/**`, or manual dispatch | Test → build/push Docker image (Docker Hub) → Trivy scan → SSH deploy to VPS |
| `deploy-ai-service.yml` | Push to `develop` touching `ai-service/**` | Equivalent pipeline for the Python AI Service |
| `add-ssh-key.yml` | New since 2026-08-21 | Registers/rotates the SSH key the deploy workflows use to reach the VPS from a personal machine |

Mobile has no CI workflow — it ships via **EAS Build** (`mobile/eas.json`) directly, outside GitHub Actions.

---

## 8. Conventions (unchanged across the codebase)

### Money handling
- Stored as `BIGINT` integer cents (e.g. `150000` = 1,500.00 VND)
- Never `FLOAT`/`DOUBLE PRECISION`, in any layer
- Display layer divides by 100 with locale formatting

### Timezone
- All timestamps stored as `TIMESTAMPTZ` (UTC) in DB
- Client converts to local timezone for display

### API versioning
- Base path: `/api/v1/`

### Response envelope (from `backend/internal/response/response.go`)

Every handler responds through this single `Body` envelope, success or failure — no ad-hoc `c.Status().JSON()` bodies:
```json
// success
{ "success": true, "message": "transaction created successfully", "data": { ... } }
// error
{ "success": false, "message": "wallet not found", "error_code": "WALLET_NOT_FOUND", "details": {} }
```
This is a `{success, data}`-wrapped envelope, **not** the bare `{error_code, message, details}` shape `CLAUDE.md`'s "API Design" section describes — actual code added a `success`/`message` wrapper around it. The web frontend's `unwrap()` helper (`frontend/src/lib/axios.ts`) exists specifically to strip this envelope back to a bare payload for TanStack Query hooks.

---

## 9. Tech Decision Log

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Query layer | sqlc | GORM | Type safety, explicit SQL, no N+1 magic |
| API design | Hand-written Go handlers | oapi-codegen (originally planned) | Never actually wired up — `docs/open-ai.md` remains a manual sketch |
| Vector DB | (none enabled) | pgvector | Planned for later AI/RAG use, not enabled in any current migration |
| LLM | Groq (primary), Anthropic (fallback), tool/function calling | Prose-described JSON schema (`response_format: json_object`) | Prose mode was observed live to not reliably hold the requested field names — tool calling makes output conform to schema by construction |
| Mobile framework | React Native (Expo) | Flutter (previous choice) | User-directed change 2026-08-16, no further rationale recorded — `mobile/` was deleted and rebuilt from scratch |
| Mobile state management | TanStack Query + Zustand | Riverpod (Flutter-only, dropped with Flutter) | Matches `frontend/`'s exact pairing — one state-management mental model across both clients |
| Auth token gen (invite) | `crypto/rand` | UUID | UUIDs are not a cryptographically secure token source |
| Category icon storage | Cloudflare R2 via `minio-go` (S3-compatible) | `aws-sdk-go-v2`, storing bytes in Postgres | Lighter client for a single-bucket/single-op use case; keeps large binary blobs out of the DB |
| Invite email delivery | Real SMTP (`net/smtp`, `smtp_email_sender.go`) | Continuing to only log the invite link | Users need an actual clickable link outside the dev machine's logs; an `EmailSender` interface keeps a `LogEmailSender` fallback for local dev / missing config |
| Mobile distribution | EAS Build → internal `.apk` | Manual `expo export` bundling, App/Play Store submission | Matches CLAUDE.md's "no store submission, `.apk`/`.ipa` test builds only" constraint |
| CI/CD | GitHub Actions, path-filtered per-package workflows | Single monolithic pipeline | A frontend/mobile-only push shouldn't rebuild or redeploy the Go API or AI Service |
| Session refresh token rotation | New pair minted before the old `jti` is revoked | Revoke-then-mint | A mid-request crash leaves the old token merely still-valid for its remaining TTL rather than stranding the caller with zero valid credentials (`specs/mobile-session-refresh/spec.md` Edge Case #1) |
| Debug Console / Loading Skeletons dependencies | RN core (`PanResponder`, `Animated`) only | `react-native-reanimated`/`react-native-gesture-handler`/`react-content-loader` | Avoids a new native module, which would force a fresh EAS build given the SDK-54 pinning constraints already documented in `mobile/AGENTS.md` |
