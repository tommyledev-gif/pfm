# PFM — Tech Stacks

_Last updated: 2026-09-13_
_Updated by: /renew-docs_

> Every version below was read out of an actual config file this run (`backend/go.mod`, `mobile/package.json`, `frontend/package.json`, `ai-service/requirements.txt`, `docker-compose.yml`, `mobile/app.json`, `mobile/eas.json`). Nothing here is from memory.

---

## Mobile — React Native / Expo

> Migrated from Flutter on 2026-08-16. Any Flutter/Dart/Riverpod reference elsewhere in the repo is stale.

| Tool | Version | Source |
|------|---------|--------|
| Expo SDK | `^54.0.36` | `mobile/package.json` |
| React Native | `0.81.5` | `mobile/package.json` |
| React | `19.1.0` | `mobile/package.json` |
| React DOM | `19.1.0` | `mobile/package.json` |
| TypeScript | `~5.9.2` | `mobile/package.json` (dev) |
| expo-router | `~6.0.24` | `mobile/package.json` |
| @tanstack/react-query | `^5.101.4` | `mobile/package.json` |
| zustand | `^5.0.15` | `mobile/package.json` |
| axios | `^1.19.0` | `mobile/package.json` |
| expo-secure-store | `~15.0.8` | `mobile/package.json` |
| @react-native-async-storage/async-storage | `2.2.0` | `mobile/package.json` |
| react-native-svg | `15.12.1` | `mobile/package.json` |
| react-native-calendars | `^1.1314.0` | `mobile/package.json` |
| react-native-safe-area-context | `~5.6.0` | `mobile/package.json` |
| react-native-screens | `~4.16.0` | `mobile/package.json` |
| react-native-web | `^0.21.2` | `mobile/package.json` |
| expo-blur | `~15.0.8` | `mobile/package.json` |
| expo-constants | `~18.0.13` | `mobile/package.json` |
| expo-linking | `~8.0.12` | `mobile/package.json` |
| expo-splash-screen | `~31.0.13` | `mobile/package.json` |
| expo-status-bar | `~3.0.9` | `mobile/package.json` |
| expo-image-picker | `~17.0.11` | `mobile/package.json` |
| expo-document-picker | `~14.0.8` | `mobile/package.json` |
| expo-file-system | `~19.0.24` | `mobile/package.json` |
| expo-sharing | `~14.0.8` | `mobile/package.json` |
| eslint / eslint-config-expo | `^9.0.0` / `~10.0.0` | `mobile/package.json` (dev) |

**Expo config plugins** (`mobile/app.json`): `expo-router`, `expo-secure-store`, `expo-image-picker`, `expo-splash-screen`.
`expo-status-bar` is deliberately **not** listed — on SDK 54 its plugin resolution breaks Node type-stripping (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`).

**Not installed** (relevant to planned work): `expo-notifications`, `expo-device`, `expo-localization`, any chart library, any keyboard-avoidance library (a custom `useKeyboardHeight()` hook is used instead, because `KeyboardAvoidingView`'s Android `height` behavior fails to restore layout — facebook/react-native#22884).

### SDK pinning

SDK 54 is **pinned on purpose**, not lagging by accident. The tester's installed Expo Go reported client `54.0.8` / "supported SDK 54"; SDK 56 and 57 were both confirmed unavailable on the app stores. `npx expo install expo@latest` type-checking cleanly proves nothing about whether Expo Go can run it. See `mobile/AGENTS.md` before any bump.

### Build

| Tool | Config | Notes |
|------|--------|-------|
| EAS Build | `mobile/eas.json` (`cli.version >= 12.0.0`, `appVersionSource: local`) | `preview` → internal `.apk`; `production` → autoIncrement. **No store submission.** |
| EAS project | `extra.eas.projectId` in `mobile/app.json` | Also the `projectId` an Expo push token would need |
| Android package | `com.example.pfm` | `mobile/app.json` |
| Local build | `npx expo run:android` | Unlimited, Windows-native; needs Android Studio + SDK + **JDK 17** (RN 0.81). `eas build --local` is **not supported on Windows**. |

---

## Backend — Go

| Tool | Version | Source |
|------|---------|--------|
| Go | `1.23.0` | `backend/go.mod` |
| gofiber/fiber/v2 | `v2.52.5` | `backend/go.mod` |
| jackc/pgx/v5 | `v5.6.0` | `backend/go.mod` |
| golang-jwt/jwt/v5 | `v5.2.1` | `backend/go.mod` |
| go-playground/validator/v10 | `v10.22.0` | `backend/go.mod` |
| google/uuid | `v1.6.0` | `backend/go.mod` |
| go.uber.org/zap | `v1.27.0` | `backend/go.mod` |
| golang.org/x/crypto | `v0.36.0` | `backend/go.mod` — bcrypt |
| minio/minio-go/v7 | `v7.0.90` | `backend/go.mod` — S3 client for Cloudflare R2 |
| xuri/excelize/v2 | `v2.9.0` *(indirect)* | `backend/go.mod` — transaction export |
| sqlc | CLI, not a module dep | `backend/sqlc.yaml` |

**sqlc config** (`backend/sqlc.yaml`): engine `postgresql`, queries `db/queries`, schema `db/migrations`, out `internal/repository/sqlc`, `sql_package: pgx/v5`, `emit_json_tags`, `emit_interface`, `emit_pointers_for_null_types`.

> ⚠️ The locally-installed `sqlc` CLI regenerates **every** file differently from what is committed, so a re-gen produces an unreviewable diff. New queries are currently hand-written to match the existing generated style. Pin the CLI version, or take one deliberate full-regen commit.

**Not used:** GORM (explicitly rejected), viper, testify — tests use the stdlib plus hand-written fakes.

---

## Database

| Tool | Version | Notes |
|------|---------|-------|
| PostgreSQL | `16-alpine` | `docker-compose.yml`, both dev and prod |
| uuid-ossp | — | `uuid_generate_v4()` for all PKs |
| pgvector | **not enabled** | No RAG/vector work exists |

Migrations are plain numbered `.sql`, compiled into the backend image and applied by `cmd/migrate` (a `schema_migrations` ledger, one transaction per file, a Postgres advisory lock so two runs never race). It runs on every deploy before `up -d`, in CI on an empty database, and as the dev compose's `migrate` service. Nothing is mounted into `docker-entrypoint-initdb.d`.

Postgres 16 matters for one planned change: `CREATE UNIQUE INDEX … NULLS NOT DISTINCT` (PG 15+) is what makes a single unified notification dedup index possible.

---

## AI Service — Python

| Tool | Version | Source |
|------|---------|--------|
| FastAPI | `0.141.1` | `ai-service/requirements.txt` |
| Uvicorn | `0.52.3` | `ai-service/requirements.txt` |
| Pydantic | `2.13.4` | `ai-service/requirements.txt` |
| pydantic-settings | `2.15.0` | `ai-service/requirements.txt` |
| groq | `1.6.0` | `ai-service/requirements.txt` — **primary** |
| anthropic | `0.122.0` | `ai-service/requirements.txt` — fallback |
| httpx | `0.28.1` | `ai-service/requirements.txt` |

**Model:** `openai/gpt-oss-120b` on Groq's free tier. **Not used:** Celery, Redis, any DB driver — the AI Service holds no database connection.

**Structured output is tool/function calling, not prose-described JSON schemas.** `extract_service.py` records why: gpt-oss-20b silently mishandles nested `$ref` schemas under a forced `tool_choice`. Schemas must stay flat.

---

## Web Frontend — Next.js

| Tool | Version | Source |
|------|---------|--------|
| Next.js | `^15.0.2` | `frontend/package.json` |
| React / React DOM | `^19.0.0` | `frontend/package.json` |
| TypeScript | `^5.6.3` | `frontend/package.json` (dev) |
| @tanstack/react-query | `^5.59.0` | `frontend/package.json` |
| zustand | `^5.0.0` | `frontend/package.json` |
| axios | `^1.7.7` | `frontend/package.json` |
| tailwindcss | `^3.4.14` | `frontend/package.json` (dev) |
| @radix-ui/react-{dialog,label,select,slot} | `^1.1.2` / `^2.1.0` / `^2.1.2` / `^1.1.0` | `frontend/package.json` |
| lucide-react | `^0.454.0` | `frontend/package.json` |
| class-variance-authority / clsx / tailwind-merge | `^0.7.0` / `^2.1.1` / `^2.5.4` | `frontend/package.json` — shadcn-style primitives, hand-copied |
| tailwindcss-animate | `^1.0.7` | `frontend/package.json` |
| eslint-config-next | `^15.0.2` | `frontend/package.json` (dev) |

---

## Infrastructure

| Tool | Version / Config | Purpose |
|------|------------------|---------|
| Docker Compose | no `version:` key (Compose v2 spec) | `docker-compose.yml` (dev, builds locally) · `backend/docker-compose.yml` (prod, pulls images) |
| Network | `pfm_network`, bridge | Dev |
| Volumes | `pfm_pgdata` (dev) · `pfm_postgres_data` (prod) | Postgres data |
| Cloudflare R2 | S3 API via `minio-go` | Uploaded category/wallet/budget icons |
| SMTP | configurable; blank host → log-only sender | Invite/activation email |
| GitHub Actions | `ci-pr`, `backend-test`, `deploy-backend`, `deploy-ai-service`, `add-ssh-key` | CI + VPS deploy on push to `develop` |
| VPS | `api.example.com` | Backend on port 80; Postgres bound to `127.0.0.1`; per-service memory limits |

**Nginx:** not present in either compose file — the backend is published directly.

### Environment variables (`.env.example`, values masked)

`POSTGRES_{USER,PASSWORD,DB,PORT}` · `BACKEND_PORT` · `WEB_FRONTEND_PORT` · `JWT_SECRET` · `CORS_ALLOWED_ORIGINS` · `SMTP_{HOST,PORT,USERNAME,PASSWORD,FROM_EMAIL}` · `APP_BASE_URL` · `AI_SERVICE_URL` (defaults to `http://ai-service:8000`) · `R2_{ACCOUNT_ID,ACCESS_KEY_ID,SECRET_ACCESS_KEY,BUCKET,PUBLIC_BASE_URL}` · `GROQ_API_KEY` · `ANTHROPIC_API_KEY` · `SEED_ADMIN_{EMAIL,PASSWORD,NAME}` (dev and prod) · prod-only: `DOCKER_REGISTRY_USER`, `PFM_*_IMAGE_TAG`, `MEM_LIMIT_*`

**Graceful degradation is deliberate:** blank `R2_ACCOUNT_ID` → `503 ICON_UPLOAD_UNAVAILABLE`; AI Service down → `502 AI_SERVICE_UNAVAILABLE`; blank `SMTP_HOST` → log-only email sender. None of these fail startup.

---

## Conventions

### Money
- Stored as `BIGINT` in **xu (cents)** — `150000` = `1.500,00 ₫`.
- **Never** `float`/`float64`, at any layer. (`budgetproposal` currently violates this — tracked as TD-01.)
- Display divides by 100: `mobile/src/lib/currency.ts`, `common.FormatCents` on the backend.

### Timestamps
- Stored `TIMESTAMPTZ`, written in **UTC**.
- The transaction column is `occurred_at` — there is no `transaction_date` anywhere.
- Period boundaries are currently computed in UTC (`date_trunc('month', NOW())`, `time.UTC`), which is a known gap for Vietnamese users, not an intended design.

### IDs & deletion
- UUID v4 (`uuid_generate_v4()`).
- Soft delete via `deleted_at TIMESTAMPTZ NULL` — financial records are never hard-deleted.

### User isolation
- Every query carries `AND user_id = $n`. IDs returned by the AI Service are re-validated server-side before any use.

### API
- Base path `/api/v1`; breaking changes would bump to `/api/v2`.
- Cursor-based pagination — never offset.
- Money in API payloads is integer **xu**.

Error:
```json
{ "success": false, "error_code": "WALLET_NOT_FOUND", "message": "wallet not found" }
```
Success:
```json
{ "success": true, "data": { } }
```
Routing-level failures (404/405 raised by Fiber itself) keep their real status and error code — they are not collapsed into `500 INTERNAL_ERROR`.

### Code
- File over **300 lines** → split. (Four files currently violate this — see [docs/features.md](features.md) TD-10.)
- Go: wrap errors with context — `fmt.Errorf("service.Create: %w", err)`.
- TypeScript: `const` by default, never `any`.
- SQL lives in `.sql` files for sqlc — no raw query strings in Go.
- Handlers never import repositories; they go through services. Shape/type validation in the handler, business rules in the service.
- Mobile: server state lives in TanStack Query only — never copied into `useState` or Zustand.
- UI copy is **Vietnamese** throughout (sweep still in progress — see [docs/features.md](features.md) §4).
