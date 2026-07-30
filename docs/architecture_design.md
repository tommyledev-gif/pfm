# PFM – Architecture Design

> Last updated: 2026-07-30  
> Methodology: C4 Model + 4+1 Views  
> Principles: API-first, Domain-pure, Secure-by-default, Fail-safe, Idempotent finance ops

---

## 1. System Context (C4 Level 1)

```
┌─────────────────────────────────────────────┐
│                  PFM System                 │
│                                             │
│  ┌──────────┐   ┌────────────┐   ┌───────┐ │
│  │  Flutter │   │ Go Backend │   │Python │ │
│  │   App    │──▶│    API     │──▶│  AI   │ │
│  └──────────┘   └─────┬──────┘   └───────┘ │
│                        │                    │
│                  ┌─────▼──────┐             │
│                  │ PostgreSQL │             │
│                  └────────────┘             │
└─────────────────────────────────────────────┘

External actors:
- End User (via Flutter mobile app)
- Email delivery (SMTP / mock for MVP)

External systems: None in MVP
```

**Primary actor:** Individual user managing personal finances  
**No external banking integrations** in MVP — all data is manually entered

---

## 2. Logical View (4+1 — Functional Areas)

The system is decomposed into these functional modules, each mapping to an SRS Feature:

| Module | Feature | MVP |
|--------|---------|-----|
| User Management | F-01 | ✔ (invite flow) |
| System Security | F-02 | ✔ (JWT auth) |
| Wallet Management | F-03 | ✔ |
| Category Management | F-04 | ✔ |
| Budget Management | F-05 | ✔ |
| Transaction Management | F-06 | ✔ |
| Financial Reporting | F-07 | ✔ (summary only) |
| Notification Handling | F-10 | ✔ |
| Financial Goal | F-08 | Release 1 |
| Investment Portfolio | F-09 | Release 2 |
| Data Overview Dashboard | F-11 | Release 1 |

---

## 3. Development View (4+1 — Code Structure)

### 3.1 System Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Flutter App                        │
│  Riverpod Providers → Retrofit Client → dio          │
│  go_router → Pages → Widgets                         │
│  drift (offline cache) ↔ flutter_secure_storage      │
└──────────────────┬───────────────────────────────────┘
                   │ HTTPS REST /api/v1
┌──────────────────▼───────────────────────────────────┐
│                  Go Backend (Fiber)                  │
│                                                      │
│  Handler (oapi-codegen generated + manual impl)      │
│       │                                              │
│  Middleware: Auth JWT │ Rate Limit │ Validator        │
│       │                                              │
│  Service (business logic, owns transactions)         │
│       │                                              │
│  Repository (sqlc generated, wraps pgx)              │
│       │                                              │
│  PostgreSQL 16                                        │
└──────────────────┬───────────────────────────────────┘
                   │ HTTP REST (internal Docker network)
┌──────────────────▼───────────────────────────────────┐
│              Python AI Service (FastAPI)             │
│                                                      │
│  /categorize  → Groq LLM → category label            │
│  /chat        → Groq LLM + user context → response   │
│  /insights    → anomaly detection logic              │
│                                                      │
│  BackgroundTasks for async inference                 │
│  pgvector (shared Postgres) for RAG when needed      │
└──────────────────────────────────────────────────────┘
```

### 3.2 Go Backend Layer Convention

```
backend/
└── internal/
    ├── handler/       # HTTP request/response; no business logic
    ├── service/       # Business rules, orchestration, owns DB transactions
    ├── repository/    # Data access only; sqlc-generated + thin wrappers
    ├── model/         # Domain structs (pure, no framework deps)
    ├── dto/           # API request/response shapes (separate from domain)
    ├── middleware/    # JWT auth, rate limit, logging
    └── common/        # Error codes, constants, shared utils
```

**Rule:** Service layer calls Repository — never the reverse. Handler calls Service — never Repository directly.

### 3.3 AI Service Structure

```
ai-service/
└── app/
    ├── routers/       # FastAPI route handlers
    ├── services/      # LLM orchestration, prompt building
    ├── schemas/       # Pydantic request/response models
    └── core/          # Config, Groq client singleton, logging
```

---

## 4. Data Design

### 4.1 Core Schema (MVP)

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";  -- enabled now, used later

-- Users
CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email             TEXT NOT NULL UNIQUE,
    full_name         TEXT,
    password_hash     TEXT,                          -- NULL until activated
    status            TEXT NOT NULL DEFAULT 'pending', -- pending|active|disabled
    role              TEXT NOT NULL DEFAULT 'member',  -- member|admin
    invited_by        UUID REFERENCES users(id),
    invite_token      TEXT UNIQUE,                   -- crypto/rand 32-byte hex
    invite_expires_at TIMESTAMPTZ,
    activated_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ                    -- soft delete
);

-- Wallets
CREATE TABLE wallets (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id),
    name         TEXT NOT NULL,
    type         TEXT NOT NULL,                      -- cash|bank|ewallet
    balance      BIGINT NOT NULL DEFAULT 0,          -- integer cents
    currency     TEXT NOT NULL DEFAULT 'VND',
    is_default   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

-- Categories
CREATE TABLE categories (
    id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id   UUID REFERENCES users(id),             -- NULL = system default
    name      TEXT NOT NULL,
    icon      TEXT,
    type      TEXT NOT NULL,                         -- income|expense|both
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Budgets
CREATE TABLE budgets (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID NOT NULL REFERENCES users(id),
    category_id  UUID NOT NULL REFERENCES categories(id),
    amount_limit BIGINT NOT NULL,                    -- integer cents
    period       TEXT NOT NULL,                      -- monthly|weekly
    start_date   DATE NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

-- Transactions
CREATE TABLE transactions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(id),
    wallet_id   UUID NOT NULL REFERENCES wallets(id),
    category_id UUID NOT NULL REFERENCES categories(id),
    amount      BIGINT NOT NULL CHECK (amount > 0),  -- integer cents
    type        TEXT NOT NULL,                       -- income|expense
    note        TEXT,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

-- Notifications
CREATE TABLE notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id),
    type       TEXT NOT NULL,                        -- budget_exceeded|goal_reached|...
    title      TEXT NOT NULL,
    body       TEXT,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.2 Critical Data Rules

| Rule | Detail |
|------|--------|
| Money type | `BIGINT` integer cents — never `FLOAT` or `DOUBLE PRECISION` |
| Wallet balance | Updated atomically in same DB transaction as the transaction insert |
| Soft delete | `deleted_at` on all financial records — no hard deletes |
| Timezone | All timestamps stored in UTC (`TIMESTAMPTZ`); client converts to local |
| User isolation | Every query MUST include `user_id = $currentUser` — never leak cross-user data |
| Invite token | `crypto/rand` 32 bytes → hex encoded — not UUID, not sequential |

### 4.3 Indexes

```sql
CREATE INDEX idx_users_email           ON users(email);
CREATE INDEX idx_users_invite_token    ON users(invite_token) WHERE invite_token IS NOT NULL;
CREATE INDEX idx_wallets_user_id       ON wallets(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_user_id  ON transactions(user_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_wallet   ON transactions(wallet_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_budgets_user_cat      ON budgets(user_id, category_id) WHERE deleted_at IS NULL;
```

---

## 5. Process View (4+1 — Runtime Flows)

### 5.1 Request Lifecycle (Go Backend)

```
HTTP Request
    │
    ▼
Rate Limit Middleware  ←── 429 if exceeded
    │
    ▼
JWT Auth Middleware    ←── 401 if invalid/expired
    │
    ▼
Handler               ←── 400 if request shape invalid
    │  (oapi-codegen generated)
    ▼
Validator             ←── 422 if business validation fails
    │  (go-playground/validator)
    ▼
Service               ←── 403/404 for ownership/not-found
    │  (business rules + DB transaction)
    ▼
Repository (sqlc)     ←── DB error → 500
    │
    ▼
PostgreSQL
    │
    ▼
Response (JSON)
```

### 5.2 Transaction Create Flow (Critical Path)

```
POST /transactions
    │
    ├── Validate input (amount > 0, type in [income|expense], category exists)
    ├── BEGIN DB TRANSACTION
    │     ├── Insert transaction row
    │     ├── UPDATE wallets SET balance = balance ± amount WHERE id = $walletId
    │     │   (check: expense must not make balance < 0)
    │     └── Trigger budget check (async notification if limit exceeded)
    └── COMMIT → return 201
```

### 5.3 Invite → Activate Flow

```
Admin: POST /admin/users/invite  →  creates user (status=pending), sends email with token
                                         │
                                    Email Link → Flutter deep link → ActivatePage
                                         │
User: POST /auth/activate (token + password)
    ├── Lookup token, verify not expired (72h window)
    ├── bcrypt hash password (cost=12)
    ├── UPDATE user: status=active, clear invite_token, set activated_at
    └── Return JWT pair → User is logged in
```

---

## 6. Physical View (4+1 — Deployment)

### MVP (Local / Self-hosted)

```
docker-compose.yml
├── postgres:16-alpine       port 5432 (internal only)
├── backend (Go binary)      port 8080
├── ai-service (Python)      port 8000 (internal only from backend)
└── (redis)                  added when Celery is needed
```

All services on a private Docker bridge network.  
Only `backend:8080` is exposed externally (behind reverse proxy in production).

### Production Path (post-MVP)

| Component | Target |
|-----------|--------|
| Backend | Single VPS → scale vertically first |
| Postgres | Managed instance (e.g. Supabase, Railway, or VPS with backup) |
| AI Service | Same VPS or separate small instance |
| CI/CD | GitHub Actions → build APK/IPA → upload to test distribution |

---

## 7. Key Scenarios (Scenario View — +1)

| Scenario ID | Feature | User Story | MVP |
|-------------|---------|------------|-----|
| S-USR-01 | User Management | Invite a User | ✔ |
| S-USR-02 | User Management | Activate Account | ✔ |
| S-USR-03 | User Management | List Users | ✔ |
| S-SEC-01 | System Security | Login | ✔ |
| S-SEC-02 | System Security | Logout / Token Refresh | ✔ |
| S-WAL-01 | Wallet Management | Create a Wallet | ✔ |
| S-CAT-01 | Category Management | Create a Category | ✔ |
| S-BUD-01 | Budget Management | Create a Budget | ✔ |
| S-TRX-01 | Transaction Management | Create a Transaction | ✔ |
| S-RPT-01 | Financial Reporting | View Summary Report | ✔ |

---

## 8. Architecture Principles

| Principle | Implementation |
|-----------|---------------|
| **API-first** | `openapi.yaml` is written before any code; generates both Go server and Dart client |
| **Domain-pure** | Service layer has zero HTTP/framework imports; only domain types |
| **Secure by default** | Auth middleware applied globally; per-resource ownership enforced in service |
| **Data consistency first** | Wallet balance update and transaction insert always in same DB transaction |
| **Idempotent finance ops** | Clients send idempotency key on transaction creation |
| **Fail-safe** | On any error, DB transaction rolls back — no partial state |
| **Observability-ready** | Structured JSON logs (Zap) with trace_id on every request from day 1 |
| **No float money** | `BIGINT` cents enforced at DB schema level and service layer |