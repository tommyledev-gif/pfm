# PFM — Tech Stacks

_Last updated: 2026-08-16_
_Updated by: /renew-docs_

> Versions extracted from actual config files (`backend/go.mod`, `mobile/package.json`, `frontend/package.json`, `docker-compose.yml`), not from memory or prior planning docs.

---

## Implementation Status

| Component | Status |
|---|---|
| Backend (Go) | **Done for MVP** — F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-10 all implemented in `backend/`, plus Feature-12 AI Chat (US-01 only) |
| Web frontend (Next.js, `frontend/`) | **Done for MVP** — `features/{auth,users,wallets,categories,budgets,transactions,reports,notifications,ai-chat}` all exist |
| Mobile (React Native/Expo, `mobile/`) | **Screens built 2026-08-16** — rebuilt from Flutter to React Native (Expo) earlier the same day, then the full screen set (Home, Transactions, Insights, AI Chat, Notifications, Profile) was implemented against `mobile/design_handoff_pfm_app/`, plus a real login form. Wallets/Categories/Household Members/Security/Help on Profile are entry-point rows only (design handoff scope), no screens behind them yet |
| AI Service (Python) | **Implemented** — `ai-service/`, Feature-12 US-01 only (create-transaction-via-chat); Groq primary / Anthropic fallback via tool/function calling |
| Infra (Docker Compose) | `postgres`, `backend`, `ai-service`, `web` (Next.js). `mobile/` is deliberately **not** containerized — Expo's dev flow is `npx expo start`, not a docker service; the old Flutter-web-build `frontend` service was removed |
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

## 1. Mobile App (React Native + Expo, `mobile/`) — rebuilt 2026-08-16, screens built same session

`mobile/` was deleted (Flutter) and rebuilt from scratch as React Native + Expo, then had its full screen set built against the design handoff. See `docs/architecture.md` §3 for the full rationale and structure.

⚠️ **Pinned to SDK 54, not the latest (57)** — two rounds of trial and error the same day: 57 → real-device Expo Go failure → 56 → same failure → confirmed via the tester's own Expo Go app (Profile tab: client `54.0.8`, "supported SDK 54") that the Play Store build was several SDKs behind, not just one. Downgrading `expo` alone isn't enough — use `npx expo install --fix` to realign every dependent package, and if that hits an `ERESOLVE` peer conflict, `rm -rf node_modules package-lock.json && npm install` first. Full story in `mobile/AGENTS.md`; don't bump the SDK again without having someone check Expo Go's own Profile tab on a real device first.

| Layer | Package | Version | Notes |
|---|---|---|---|
| Framework | `expo` | `^54.0.0` | `mobile/package.json` |
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
| SVG / icons + chart | `react-native-svg` | latest SDK-54-compatible | Added this session: hand-drawn icon set (`src/components/ui/Icon.tsx`) + the Insights donut chart, no icon font/charting library |
| Blur | `expo-blur` | latest SDK-54-compatible | Added this session: `BlurView` behind the floating bottom-nav pill |

**Dev dependencies:** `typescript ~5.9.2`, `eslint ^9.0.0` + `eslint-config-expo ~10.0.0` (installed via `npx expo lint`). ⚠️ `expo-status-bar` must not be listed in `app.json`'s `plugins` array on this SDK — breaks with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` if present.

**Not yet installed:** any form library — the login form and "New budget" modal are plain `useState`, small enough not to need `react-hook-form`. No offline/local-DB layer (the old Flutter stack listed `drift` as intended but never adopted it; TanStack Query's cache is still the only client persistence).

**No `GET /users/me` endpoint exists** — the JWT's `AccessClaims` carry only `user_id`/`role`, no name/email (`backend/internal/service/token_service.go`). Profile's displayed name/email come from the email typed at login, persisted via `expo-secure-store` alongside the tokens (`src/stores/session-store.ts`) — not re-verified against the server on each load.

---

## 2. Backend — Go

| Layer | Library | Version | Status |
|---|---|---|---|
| Go | — | `1.22` | `go.mod` |
| Web framework | `github.com/gofiber/fiber/v2` | `v2.52.5` | ✅ |
| DB driver | `github.com/jackc/pgx/v5` | `v5.6.0` | ✅ — used by sqlc-generated code |
| Query layer | `sqlc` | config in `backend/sqlc.yaml` (`sql_package: pgx/v5`) | ✅ — generates into `internal/repository/sqlc`; no GORM anywhere |
| Auth | `github.com/golang-jwt/jwt/v5` | `v5.2.1` | ✅ — access + refresh tokens; **no `/auth/refresh` endpoint implemented** |
| Validation | `github.com/go-playground/validator/v10` | `v10.22.0` | ✅ |
| UUID | `github.com/google/uuid` | `v1.6.0` | ✅ |
| Logging | `go.uber.org/zap` | `v1.27.0` | ✅ |
| Password hashing | `golang.org/x/crypto` (bcrypt) | `v0.24.0` | ✅ |
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

## 7. Conventions (unchanged across the codebase)

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

## 8. Tech Decision Log

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Query layer | sqlc | GORM | Type safety, explicit SQL, no N+1 magic |
| API design | Hand-written Go handlers | oapi-codegen (originally planned) | Never actually wired up — `docs/open-ai.md` remains a manual sketch |
| Vector DB | (none enabled) | pgvector | Planned for later AI/RAG use, not enabled in any current migration |
| LLM | Groq (primary), Anthropic (fallback), tool/function calling | Prose-described JSON schema (`response_format: json_object`) | Prose mode was observed live to not reliably hold the requested field names — tool calling makes output conform to schema by construction |
| Mobile framework | React Native (Expo) | Flutter (previous choice) | User-directed change 2026-08-16, no further rationale recorded — `mobile/` was deleted and rebuilt from scratch |
| Mobile state management | TanStack Query + Zustand | Riverpod (Flutter-only, dropped with Flutter) | Matches `frontend/`'s exact pairing — one state-management mental model across both clients |
| Auth token gen (invite) | `crypto/rand` | UUID | UUIDs are not a cryptographically secure token source |
