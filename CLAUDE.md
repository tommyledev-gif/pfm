# PFM — Personal Finance Management

Mobile app quản lý chi tiêu cá nhân. React Native (Expo) + Go + Python AI service.

## Architecture

[React Native App (Expo)] → HTTPS → [Go Backend :8080] → [PostgreSQL 16]
↓ REST internal
[Python AI Service :8000]


Infra: Docker Compose (backend, ai-service, postgres, Next.js web only — `mobile/` is not containerized, see below). Không deploy App Store/Play Store. Android: APK build trên máy bằng `npm run apk` (ký bằng release key riêng, cài đè được), code JS/TS ship qua OTA tự host (`expo-updates` → backend `/api/v1/app-updates`, `npm run ota:publish`) — xem `docs/ops-runbook.md` §8. Setup máy release mới: `docs/mobile-release-setup.md`, kiểm tra bằng `npm run ota:check`.

> **Frontend priority:** `frontend/` (Next.js web) is feature-complete-first priority. `mobile/` (React Native + Expo, migrated from Flutter 2026-08-16) has only an initial project scaffold — Expo Router, TanStack Query, Zustand, Axios, and secure-store are wired, but no feature screens (auth, wallets, etc.) exist yet. Build mobile features only when explicitly requested.
>
> **Mobile is not Dockerized.** Expo's dev flow is `npx expo start` (Metro bundler + Expo Go / simulator), not a container. `npx expo export --platform web` can produce a static bundle if a containerized web preview is ever needed later.

## Tech Stack

**Mobile:** React Native (Expo SDK, TypeScript) · Expo Router (file-based routing, `Stack.Protected` for auth-gated routes) · TanStack Query (server state) · Zustand (client/global state — same pairing as `frontend/`, for one consistent mental model across both clients) · Axios (calls the Go backend directly — no BFF proxy on mobile, unlike `frontend/`) · expo-secure-store (JWT storage)

**Backend:** Go 1.22+ · Fiber v2 · sqlc (không dùng GORM) · pgx/v5 · golang-jwt v5 · go-playground/validator v10 · golang-migrate · Zap logger

**AI Service:** Python 3.12+ · FastAPI · Pydantic v2 · Groq SDK (primary, free tier) · Anthropic SDK (fallback) · tool/function calling for structured extraction (prose-described JSON schemas are not reliable — see `specs/ai-chat-assistant/`)

**API contract:** No `api-spec/openapi.yaml`/codegen pipeline exists — every backend DTO, and every mobile/web API type, is hand-written to match. Keep them in sync by hand across `backend/internal/dto/`, `frontend/src/features/*/types.ts`, and `mobile/src/features/*/types.ts`.

## Folder Structure

pfm/
├── CLAUDE.md
├── .claude/commands/ # /ba /qc /dev slash commands
├── api-spec/
│ └── openapi.yaml # source of truth cho tất cả API
├── mobile/
│ ├── app/ # Expo Router file-based routes (thin — compose from src/features)
│ │ ├── _layout.tsx # Root layout: providers + Stack.Protected auth guard
│ │ ├── (auth)/ # Unauthenticated route group
│ │ └── (app)/ # Authenticated route group
│ └── src/
│ ├── features/{feature}/
│ │ ├── api/ # TanStack Query hooks (use-*-query.ts, use-*-mutation.ts) — same convention as frontend/
│ │ ├── components/ # screen-specific components
│ │ └── types.ts
│ ├── components/{ui,shared}/ # reusable primitives / cross-feature components
│ ├── lib/ # axios.ts, query-client.ts, secure-storage.ts, constants.ts, currency.ts
│ └── stores/ # global Zustand stores (session, ui prefs)
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
├── frontend/src/
│   ├── app/app/{feature}/     # Next.js route pages
│   └── features/{feature}/
│       ├── api/               # TanStack Query hooks (use-*-query.ts, use-*-mutation.ts)
│       ├── components/        # table, skeleton, dialogs
│       └── types.ts
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
- JWT: access token 15 phút, refresh token 60 ngày (trượt theo mỗi lần refresh, không quá hạn tuyệt đối của session).
- Session: mỗi lần đăng nhập là 1 dòng `sessions` (mig 028); token mang `sid`, `JWTAuth` kiểm tra session mỗi request nên thu hồi có hiệu lực ngay. Session gắn với thiết bị (mig 033: `device_id`, `device_name` từ header `X-Device-Id` / `X-Device-Name`): mỗi thiết bị một session cho mỗi tài khoản, đăng nhập lại trên cùng máy thu hồi session cũ. Hết hạn sau 60 ngày không dùng hoặc tuyệt đối 180 ngày. Tối đa 5 session/user (session dùng lâu nhất bị thu hồi), refresh token dùng lại → thu hồi cả session. Đăng xuất một thiết bị (`DELETE /auth/sessions/:id`); đổi mật khẩu (`PUT /users/me/password`) thu hồi mọi session, thiết bị đang đổi nhận session mới. Chi tiết: `docs/ops-runbook.md` §5.
- Mobile: mỗi tài khoản đã lưu trên máy giữ refresh token của session riêng; chuyển tài khoản = `POST /auth/refresh` bằng token của tài khoản đó. Switch token 180 ngày (`/auth/switch-token`, `/auth/switch`, `/auth/switch-token/revoke`) đã deprecated, chỉ còn cho bản app cũ. Spec: `specs/mobile-account-switch/` (bản sửa 2026-10-19).
- Passkey (WebAuthn, mig 032): opt-in, đăng nhập bằng passkey gắn với tài khoản, server xác minh. Chuyển tài khoản KHÔNG dùng passkey (chỉ vân tay/khóa màn hình của máy + session đã lưu) (`PasskeyService`, go-webauthn). RP `api.example.com`, backend tự phục vụ `/.well-known/assetlinks.json`. Chỉ chạy trên dev/EAS build (`react-native-passkey`), Expo Go giữ check vân tay trên máy. Cách bật: `docs/ops-runbook.md` §7.
- `JWT_SECRET` ≥ 32 byte (server và `deploy.sh` từ chối nếu ngắn hơn). Không commit `.env*` thật — `backend/.env.prod` từng bị commit (xem runbook §6).
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
- Mobile: server state qua TanStack Query only — never copy API data vào `useState`/Zustand (giống rule của `frontend/`).
- TypeScript: `const` by default, không dùng `any`.
- Go: wrap error với context — `fmt.Errorf("service.Create: %w", err)`.
- SQL: viết trong `.sql` file → sqlc gen. Không raw string query trong Go.
- Mọi chữ user nhìn thấy theo skill `pfm-ux-copy` — xem mục **UX Copy** bên dưới.

## UX Copy (user-facing text)

Every string a user can see follows the `pfm-ux-copy` skill — `.claude/skills/pfm-ux-copy/SKILL.md` (source archive: `docs/pfm-ux-copywriting.skill`). That covers labels, buttons, titles, empty states, errors, toasts, confirm dialogs, placeholders, `accessibilityLabel`, push/notification text, backend `message` strings that reach the UI, and AI-service replies and their prompts. Load the skill before writing or changing any of these, then the reference it names for the case at hand: `vi-style.md` (banned words, before/after), `patterns.md` (per component), `glossary.md` (terms), `llm-runtime-prompt.md` (AI replies).

Non-negotiables (the skill has the full list and the reasoning):
- Facts first; one string = one idea = one next action. Title + button must make sense on their own.
- None of: "—", "!", emoji, "nhé/nha/ạ", "Vui lòng", "Rất tiếc", "Oops", "thành công", "Bạn có thể…/Hãy…", "chúng tôi", or marketing words (thông minh, hành trình, đồng hành, tối ưu…).
- Buttons name what happens on tap ("Xóa giao dịch" / "Giữ lại"), never "Có/Không".
- Errors say what failed + what to do + the money/data state; "Số dư chưa thay đổi" only when the write is atomic.
- One concept = one word per `glossary.md` (a wallet is always "ví", never "nguồn tiền"/"tài khoản"). New terms go into the glossary first.
- Money and dates go through the shared formatters (`formatCurrency`, the format-date helpers) — never hand-written "đ", "VNĐ", "k", "1/10".

Current reality: neither client has an i18n layer — strings are Vietnamese, hardcoded in components. Until one is adopted, write the VI string in place (no EN needed); the skill's locale-key/plural rules and `scripts/lint_copy.py` apply only once locale files exist. Adopting i18next is its own decision, not something to start inside a feature.

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

## Slash Commands (Workflow)

/cook-state ← chạy đầu session mới, hoặc sau mỗi feature xong → tạo/update CURRENT_STATE.md
/cook-ba ← BA: tìm feature tiếp theo, viết spec.md
/cook-plan ← Architect: viết plan.md từ spec vừa tạo
/cook-implementation ← Dev: implement theo spec + plan
/cook-qc ← QC: viết test_cases.md từ spec + plan + code
/renew-features ← refresh docs/features.md + roadmap (có hỏi clarification)
/renew-docs ← sync docs/architecture.md + docs/tech_stacks.md theo code thực tế


Skill definitions: `.claude/skills/agents/{ba,plan,dev,qc}.md` · UX copy: `.claude/skills/pfm-ux-copy/`

## Git

> **Do not ever git commit — commit is done by me.**

⚠️ Keep this section, and anything else you want to survive, ABOVE the
GitNexus start marker below. Everything between the GitNexus markers is
regenerated wholesale by `npx gitnexus analyze`; this rule used to live in
there and was silently deleted on the first re-index (2026-09-26). Do not
spell the literal marker in this prose — analyze matches it and truncates
this paragraph (happened 2026-10-03).

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **pfm** (13396 symbols, 42550 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "develop"})`.
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
| `gitnexus://repo/pfm/context` | Codebase overview, check index freshness |
| `gitnexus://repo/pfm/clusters` | All functional areas |
| `gitnexus://repo/pfm/processes` | All execution flows |
| `gitnexus://repo/pfm/process/{name}` | Step-by-step execution trace |

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
