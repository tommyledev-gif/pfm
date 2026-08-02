# /renew-docs — Cập nhật docs/architecture.md và docs/tech_stacks.md

Mục tiêu: đọc source of truth thực tế (code, config, migrations) →
ghi lại architecture và tech stack đúng với current state, không phải với ý định ban đầu.

> ⚠️ Không được viết gì từ memory. Mọi thông tin phải đọc từ file thực tế.

---

## BƯỚC 1 — Thu thập thực tế (dùng gitnexus)

```
@.claude/skills/gitnexus/gitnexus-exploring/SKILL.md
```

Đọc các file theo thứ tự sau (đọc từng file, không đọc thừa):

### Infrastructure
- `docker-compose.yml` — services, ports, networks, volumes, env vars
- `.env.example` — env vars required (mask actual values)

### Backend
- `backend/go.mod` — Go version + all dependencies với version
- `backend/cmd/server/routes.go` — tất cả routes đã register
- `backend/internal/` directory tree — package structure
- `backend/db/migrations/` — danh sách migrations (tên file = timeline schema)
- `backend/sqlc.yaml` — sqlc config

### Mobile
- `mobile/pubspec.yaml` — Flutter/Dart version + all dependencies với version
- `mobile/lib/` directory tree — feature structure

### Frontend (nếu có)
- `frontend/package.json` — Next.js version + dependencies

### AI Service (nếu đã có code)
- Scan `ai_service/` hoặc `python_service/` nếu tồn tại

---

## BƯỚC 2 — Ghi docs/architecture.md

```markdown
# PFM — Architecture Design

_Last updated: {date}_
_Updated by: /renew-docs_

> Source of truth: generated from actual codebase, not from initial design intent.

---

## 1. System Overview

```
[Flutter Mobile App]
       │ REST/HTTPS (JWT Bearer)
       ▼
[Go + Fiber Backend]  ──── REST internal ────► [Python FastAPI AI Service]
       │                                                │
       ▼                                                │
[PostgreSQL DB] ◄───────────────────────────────────────┘
       │
  (pgvector ext — if enabled)
```

**Active services** (from docker-compose.yml):
| Service | Image/Build | Port | Description |
|---------|------------|------|-------------|
| ... | ... | ... | ... |

---

## 2. Backend Architecture

**Go version:** {from go.mod}  
**Framework:** Fiber {version}

### Layer structure (from backend/internal/)
```
cmd/server/
  main.go          — entrypoint, DI wiring
  routes.go        — route registration

internal/
  handler/         — HTTP layer, input parsing, response formatting
  service/         — business logic, orchestration
  repository/      — DB access via sqlc-generated code
    sqlc/          — generated, DO NOT EDIT
  model/           — domain structs (sqlc models)
  dto/             — request/response structs
  middleware/      — JWT auth, rate limit, role guard
  common/          — constants, errors, utils
  config/          — env config loading
  response/        — standard response envelope
```

### API Routes (from routes.go)
| Method | Path | Middleware | Handler |
|--------|------|-----------|---------|
| ... | ... | ... | ... |

### Database Schema (from migrations/)
Migrations applied in order:
| Migration | Description |
|-----------|-------------|
| 001_init.sql | ... |
| ... | ... |

**Key tables:** {list từ migration files}

---

## 3. Mobile Architecture

**Flutter version:** {from pubspec.yaml}  
**Dart version:** {from pubspec.yaml}

### Feature structure (from mobile/lib/features/)
```
features/
  {feature}/
    data/          — repository impl, API client
    domain/        — models, abstract repository
    presentation/
      pages/       — screens
      providers/   — Riverpod providers (code-gen)
      widgets/     — reusable UI components
```

### Key dependencies (from pubspec.yaml)
| Package | Version | Purpose |
|---------|---------|---------|
| riverpod | ... | State management |
| go_router | ... | Navigation |
| dio | ... | HTTP client |
| drift | ... | Local SQLite |
| flutter_secure_storage | ... | JWT storage |
| fl_chart | ... | Charts |
| ... | ... | ... |

### Routing (from app_router.dart)
| Route | Page | Guard |
|-------|------|-------|
| /login | LoginPage | unauthenticated only |
| /activate | ActivatePage | token required |
| /home | HomePage | authenticated |
| /admin/users | UserListPage | admin role |
| ... | ... | ... |

---

## 4. AI Service Architecture

**Status:** {NOT_STARTED | IN_PROGRESS | DONE}

{Nếu đã có code, mô tả structure. Nếu chưa:}

Planned:
- Python + FastAPI
- Groq API (primary, free tier) + Anthropic fallback
- Communicates với Go backend via internal REST
- Shares PostgreSQL (+ pgvector extension nếu cần RAG)

---

## 5. Data Flow

### Auth flow
```
Mobile → POST /api/v1/auth/login → Backend validates → JWT (access + refresh)
                                                     → Stored in flutter_secure_storage
Mobile → subsequent requests → Authorization: Bearer {access_token}
Backend → 401 → Dio interceptor clears storage → sessionExpiredController.add()
                                               → Router redirects to /login
```

### Transaction creation flow
```
Mobile → POST /api/v1/transactions
Backend → validate input → check wallet ownership
       → begin DB transaction
       → create transaction record
       → update wallet balance (atomic)
       → check budget → trigger notification if over limit
       → commit → return response
Mobile → update local state → show confirmation
```

{Thêm flows khác nếu có}

---

## 6. Security Design

- **Auth:** JWT access token (short TTL) + refresh token (long TTL, stored in revoked_tokens table)
- **Authorization:** Every request validates user owns the resource (wallet_id check, etc.)
- **Storage:** Tokens in flutter_secure_storage (encrypted on device)
- **Transport:** HTTPS in production, HTTP only in local dev
- **Rate limiting:** {from rate_limit.go — describe strategy}
- **Token revocation:** revoked_tokens table (from 003_revoked_tokens.sql migration)

---

## 7. Decisions & Trade-offs

| Decision | Choice | Reason | Trade-off |
|----------|--------|--------|-----------|
| ORM | sqlc | Type-safe, no reflection | More SQL to write |
| State mgmt | Riverpod code-gen | Compile-time safety | More boilerplate |
| Money type | BIGINT (cents) | Avoid float precision | Must ÷100 at display layer |
| AI budget | Groq first | Free tier sufficient | May need fallback to Anthropic |
| ... | ... | ... | ... |
```

---

## BƯỚC 3 — Ghi docs/tech_stacks.md

```markdown
# PFM — Tech Stacks

_Last updated: {date}_
_Updated by: /renew-docs_

> Versions extracted from actual config files, not from memory.

---

## Mobile (Flutter)

| Tool | Version | Source |
|------|---------|--------|
| Flutter | {from pubspec.yaml `environment.flutter`} | pubspec.yaml |
| Dart | {from pubspec.yaml `environment.sdk`} | pubspec.yaml |
| riverpod_annotation | {version} | pubspec.yaml |
| flutter_riverpod | {version} | pubspec.yaml |
| go_router | {version} | pubspec.yaml |
| dio | {version} | pubspec.yaml |
| drift | {version} | pubspec.yaml |
| flutter_secure_storage | {version} | pubspec.yaml |
| fl_chart | {version} | pubspec.yaml |
| freezed_annotation | {version} | pubspec.yaml |
| json_annotation | {version} | pubspec.yaml |

**Code-gen tools:**
| Tool | Version |
|------|---------|
| build_runner | {version} |
| riverpod_generator | {version} |
| freezed | {version} |
| json_serializable | {version} |

---

## Backend (Go)

| Tool | Version | Source |
|------|---------|--------|
| Go | {from go.mod `go X.XX`} | go.mod |
| fiber | {version} | go.mod |
| sqlc | {check sqlc.yaml or go.mod} | go.mod |
| golang-migrate | {version} | go.mod |
| golang-jwt | {version} | go.mod |
| bcrypt | {version} | go.mod |
| zap/slog | {version or stdlib} | go.mod |
| viper | {if used} | go.mod |
| testify | {version} | go.mod |

---

## Database

| Tool | Version | Notes |
|------|---------|-------|
| PostgreSQL | {from docker-compose.yml image tag} | Primary DB |
| pgvector | {if enabled} | Vector extension for AI/RAG |

---

## Infrastructure

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | - | Container runtime |
| Docker Compose | {from docker-compose.yml `version` if specified} | Local orchestration |
| Nginx | {if in docker-compose} | Reverse proxy |

---

## AI Service (Planned / In Progress)

| Tool | Version | Notes |
|------|---------|-------|
| Python | 3.11+ | Runtime |
| FastAPI | latest | Web framework |
| Groq SDK | latest | Primary LLM (free tier) |
| Anthropic SDK | latest | Fallback LLM |
| Celery | latest | Background tasks (if needed) |
| Redis | {if in docker-compose} | Celery broker |

---

## Frontend Admin (Next.js)

| Tool | Version | Source |
|------|---------|--------|
| Next.js | {from package.json} | package.json |
| React | {from package.json} | package.json |
| TypeScript | {from package.json} | package.json |
| TanStack Query | {from package.json} | package.json |
| Tailwind CSS | {from package.json} | package.json |
| Axios | {from package.json} | package.json |
| shadcn/ui | {version if applicable} | components.json |

---

## Conventions

### Money handling
- Stored as `BIGINT` (cents, e.g. 150000 = 1500.00 VND)
- NEVER use FLOAT or float64 for money
- Display layer divides by 100 with locale formatting

### Timezone
- All timestamps stored as UTC in DB
- Client converts to local timezone for display

### API versioning
- Base path: `/api/v1/`
- Breaking changes → bump to `/api/v2/`

### Error response format
```json
{
  "success": false,
  "error_code": "WALLET_NOT_FOUND",
  "message": "wallet not found"
}
```

### Success response format
```json
{
  "success": true,
  "data": { ... }
}
```
```

---

## BƯỚC 4 — Post-write validation

- [ ] Mọi version number đều đến từ file thực tế, không phải từ memory?
- [ ] Routes table trong architecture.md có đủ tất cả routes trong routes.go không?
- [ ] Migration list có đúng thứ tự và count không?
- [ ] Tech stack table có tool nào đang dùng trong code nhưng không có trong list không?
- [ ] Nếu AI Service chưa có code → ghi rõ `Status: NOT_STARTED` không phải mô tả như đã xong?
- [ ] Data flow diagram có phản ánh đúng flow thực tế trong code (dio_client.dart, auth_provider.dart) không?