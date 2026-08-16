# PFM — Tech Stacks

_Last updated: 2026-08-16_
_Updated by: /renew-docs_

> Versions extracted from actual config files (`backend/go.mod`, `mobile/pubspec.yaml`, `frontend/package.json`, `docker-compose.yml`), not from memory or prior planning docs.

---

## Implementation Status

| Component | Status |
|---|---|
| Backend (Go) | **Done for MVP** — F-01, F-02, F-03, F-04, F-05, F-06, F-07, F-10 all implemented in `backend/` |
| Web frontend (Next.js, `frontend/`) | **Done for MVP** — `features/{auth,users,wallets,categories,budgets,transactions,reports,notifications}` all exist |
| Mobile (Flutter, `mobile/`) | **Phase 0 only, paused** — `features/{auth,admin,home}` exist; F-03→F-07/F-10 mobile UI intentionally not built (`CLAUDE.md`) |
| AI Service (Python) | **Not started** — no `ai-service/` directory; blocks `specs/ai-chat-assistant/spec.md` |
| Infra (Docker Compose) | **Done** — `docker-compose.yml` at repo root: `postgres`, `backend`, `frontend` (Flutter web build), `web` (Next.js) |
| API spec (`api-spec/openapi.yaml`) | **Not started** — no `api-spec/` directory; `docs/open-ai.md` is a hand-drafted, aspirational OpenAPI 3.1 sketch, not a generated/enforced contract, and it is already ahead of actual code in places (documents `/auth/refresh` and a `CreateTransactionRequest.idempotency_key`, neither implemented) |

---

## Architecture Overview

```
[Next.js Web (frontend/)] ─┐
                            ├─▶ [Go + Fiber Backend :8080] ──▶ [PostgreSQL 16-alpine]
[Flutter Web (mobile/)]  ───┘

Python AI Service: not started, no internal REST path wired yet.
```

---

## 1. Mobile App (Flutter) — Phase 0 implemented (`auth`, `admin`), rest paused

| Layer | Package | Version | Notes |
|---|---|---|---|
| SDK constraint | Dart | `>=3.9.0 <4.0.0` | `pubspec.yaml` `environment.sdk` — no separate Flutter version pin present |
| State management | `flutter_riverpod` | `^3.0.0` | + `riverpod_annotation ^4.0.0` for codegen |
| Routing | `go_router` | `^14.6.2` | |
| Networking | `dio` | `^5.7.0` | |
| API client codegen | `retrofit` | `^4.9.2` | Type-safe client generated over `dio` — **is** in use (contradicts earlier planning docs that called this "not started") |
| JSON codegen | `json_annotation` | `^4.9.0` | |
| Secure storage | `flutter_secure_storage` | `^9.2.2` | JWT access + refresh token storage |
| Icons | `cupertino_icons` | `^1.0.8` | |

**Code-gen tools (dev dependencies):**

| Tool | Version |
|---|---|
| `build_runner` | `^2.4.13` |
| `riverpod_generator` | `^4.0.0` |
| `retrofit_generator` | `^10.2.8` |
| `json_serializable` | `^6.9.0` |
| `flutter_lints` | `^5.0.0` |

**Not actually a dependency today** (present in `CLAUDE.md`'s intended mobile stack, absent from `pubspec.yaml`): `drift`, `flutter_form_builder`, `fl_chart`, `envied`. These are aspirational for when mobile work resumes on F-03+, not currently installed.

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

## 3. AI Service — Python — not started

No `ai-service/`, `ai_service/`, or `python_service/` directory exists in the repository. `specs/ai-chat-assistant/spec.md` (Release 1, "Create Transaction via Chat") specifies its minimal required shape once built:

| Layer | Planned choice | Notes |
|---|---|---|
| Framework | FastAPI | Per `CLAUDE.md` |
| LLM (primary) | Groq SDK | Free tier — explicit budget constraint noted in `docs/features.md` §6 |
| LLM (fallback) | Anthropic SDK | For cases Groq's free tier can't handle |
| Internal transport | REST over the Docker network | Requires a new `docker-compose.yml` service entry — none exists today |

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
| Docker Compose (`docker-compose.yml`, repo root) | Orchestrates `postgres`, `backend`, `frontend` (Flutter web build), `web` (Next.js) on one bridge network (`pfm_network`) |
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
| LLM | Groq (primary), Anthropic (fallback) — not yet implemented | Anthropic-only | Budget — Groq free tier prioritized per `docs/features.md` §6 |
| Auth token gen (invite) | `crypto/rand` | UUID | UUIDs are not a cryptographically secure token source |
| Mobile networking | `dio` + `retrofit` | Plain `dio` / `http` | Type-safe generated client, already adopted in `auth`/`admin` features |
