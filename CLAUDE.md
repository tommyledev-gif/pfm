# PFM — Personal Finance Management

Mobile app quản lý chi tiêu cá nhân. Flutter + Go + Python AI service.

## Architecture

[Flutter App] → HTTPS → [Go Backend :8080] → [PostgreSQL 16]
↓ REST internal
[Python AI Service :8000]


Infra: Docker Compose. Không deploy App Store/Play Store — chỉ build .apk/.ipa để test.

> **Frontend priority:** implementation currently focuses on `frontend/` (web) first; `mobile/` (Flutter) is paused until explicitly requested.

## Tech Stack

**Mobile:** Flutter (Dart) · Riverpod 2.x codegen · go_router · drift (SQLite offline) · dio + retrofit · fl_chart · flutter_form_builder · flutter_secure_storage · envied

**Backend:** Go 1.22+ · Fiber v2 · sqlc (không dùng GORM) · pgx/v5 · golang-jwt v5 · go-playground/validator v10 · golang-migrate · Zap logger · oapi-codegen (API-first)

**AI Service:** Python 3.12+ · FastAPI · Pydantic v2 · Groq SDK (primary, free tier) · Anthropic SDK (fallback) · FastAPI BackgroundTasks

**API contract:** `api-spec/openapi.yaml` là single source of truth. oapi-codegen gen Go server stubs. openapi-generator gen Dart client.

## Folder Structure

pfm/
├── CLAUDE.md
├── .claude/commands/ # /ba /qc /dev slash commands
├── api-spec/
│ └── openapi.yaml # source of truth cho tất cả API
├── mobile/lib/
│ └── features/{feature}/
│ ├── data/ # repository impl, API calls, drift
│ ├── domain/ # pure Dart model + interface
│ └── presentation/
│ ├── pages/
│ ├── widgets/
│ └── providers/ # Riverpod providers
├── backend/
│ ├── cmd/server/
│ └── internal/
│ ├── handler/ # HTTP only, gọi service
│ ├── service/ # business rules, owns DB tx
│ ├── repository/ # sqlc wrapper, data access only
│ ├── model/ # domain structs, zero framework import
│ ├── dto/ # request/response shapes
│ ├── middleware/ # auth, rate limit, logging
│ └── common/ # error codes, constants
│ └── db/
│ ├── migrations/ # .sql numbered files
│ └── queries/ # .sql source → sqlc generates Go
├── ai-service/app/
│ ├── routers/ # FastAPI route handlers
│ ├── services/ # LLM orchestration
│ ├── schemas/ # Pydantic models
│ └── core/ # config, groq client, logging
└── infra/
└── docker-compose.yml


## Data Conventions

| Rule | Detail |
|------|--------|
| Money | `BIGINT` integer cents (xu) — **never float** |
| IDs | UUID v4 (`uuid_generate_v4()`) |
| Timestamps | `TIMESTAMPTZ` UTC stored, client converts to local |
| Soft delete | `deleted_at TIMESTAMPTZ NULL` — không hard delete financial records |
| User isolation | Mọi query phải có `AND user_id = $n` — không leak cross-user data |

## Auth Flow

- **Invite-only** — không có self-register. Admin invite → email với token → user activate.
- Invite token: `crypto/rand` 32 bytes hex — không dùng UUID cho security token.
- Token expiry: 72h. Activation: atomic UPDATE (clear token + set status=active trong 1 query).
- JWT: access token 15 phút, refresh token 7 ngày.
- Roles: `admin` | `member`.

## Core DB Schema (MVP)

```sql
users        (id, email, full_name, password_hash, status, role, invited_by, invite_token, invite_expires_at, activated_at, created_at, updated_at, deleted_at)
wallets      (id, user_id, name, type, balance BIGINT, currency, is_default, created_at, updated_at, deleted_at)
categories   (id, user_id NULLABLE, name, icon, type, created_at, deleted_at)  -- user_id NULL = system default
budgets      (id, user_id, category_id, amount_limit BIGINT, period, start_date, created_at, updated_at, deleted_at)
transactions (id, user_id, wallet_id, category_id, amount BIGINT, type, note, occurred_at, created_at, updated_at, deleted_at)
notifications(id, user_id, type, title, body, is_read, created_at)
```

Wallet balance update và transaction insert luôn trong **cùng 1 DB transaction**.

## Critical Rules

- File > 300 lines → tách ra. Không có ngoại lệ.
- Không dùng float cho tiền — ở bất kỳ layer nào.
- Không log sensitive data (password, token, email trong prod log).
- Validation: shape/type ở handler, business rules ở service. Không mix.
- Handler không import repository trực tiếp — qua service.
- `ref.watch` trong `build()` only. `ref.read` trong callbacks/actions only.
- Dart: `final` by default. `const` constructor everywhere possible.
- Go: wrap error với context — `fmt.Errorf("service.Create: %w", err)`.
- SQL: viết trong `.sql` file → sqlc gen. Không raw string query trong Go.

## MVP Features

| # | Feature | Status |
|---|---------|--------|
| F-01 | User Management (invite/activate/list) | **Phase 0** |
| F-02 | System Security (JWT auth) | **Phase 0** |
| F-03 | Wallet Management | MVP |
| F-04 | Category Management | MVP |
| F-05 | Budget Management | MVP |
| F-06 | Transaction Management | MVP |
| F-07 | Financial Reporting (summary) | MVP |
| F-10 | Notification Handling | MVP |
| F-08 | Financial Goal | Release 1 |
| F-11 | Dashboard | Release 1 |
| F-09 | Investment Portfolio | Release 2 |

## API Design

Base: `/api/v1`  
Format: JSON request/response  
Pagination: cursor-based (không dùng offset)  
Error shape: `{ error_code: string, message: string, details?: object }`  
Money trong API: integer cents  
Full spec: `api-spec/openapi.yaml`

## Agents

- `/ba` — BA agent: viết spec, user story, edge cases, open questions
- `/qc` — QC agent: viết test cases, coverage analysis, security scenarios  
- `/dev` — Dev agent: implement theo spec, đúng stack, đúng convention

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **PFM** (251 symbols, 246 relationships, 0 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/PFM/context` | Codebase overview, check index freshness |
| `gitnexus://repo/PFM/clusters` | All functional areas |
| `gitnexus://repo/PFM/processes` | All execution flows |
| `gitnexus://repo/PFM/process/{name}` | Step-by-step execution trace |


> Do not ever git commit, commit is done by me

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
