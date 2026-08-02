# /cook-state — Tạo/cập nhật CURRENT_STATE.md

Mục tiêu: tạo ra "project memory" file — snapshot nhanh về state hiện tại của project
để AI session mới load vào là hiểu ngay, không cần explore lại từ đầu.

Gọi command này:
- Sau mỗi feature implement xong
- Trước khi bắt đầu /cook-ba cho feature mới
- Khi cảm thấy AI đang "không nhớ" context project

---

## BƯỚC 1 — Thu thập (gitnexus, đọc nhanh)

```
@.claude/skills/gitnexus/gitnexus-exploring/SKILL.md
```

Đọc những file này theo thứ tự, DỪNG ngay khi đủ info:

1. `docs/features.md` (nếu tồn tại) — current feature status
2. `specs/` directory listing — features đã có spec
3. `backend/db/migrations/` — list file names only (không cần đọc content)
4. `backend/internal/handler/` — list file names only  
5. `mobile/lib/features/` — list thư mục con
6. `backend/cmd/server/routes.go` — route list
7. Nếu có `CURRENT_STATE.md` cũ → đọc để compare, không xóa mà update

---

## BƯỚC 2 — Ghi CURRENT_STATE.md ở root project

```markdown
# PFM — Current Project State

_Last updated: {datetime}_
_Command: /cook-state_

> ⚡ Load file này đầu tiên khi bắt đầu session mới.
> Không edit manual — chạy /cook-state để refresh.

---

## TL;DR — Project Health

- **Phase:** {MVP / Release 1 / Release 2}
- **Overall completion:** {X}% của MVP scope
- **Last feature shipped:** {feature name}
- **Currently in progress:** {feature name hoặc "nothing"}
- **Next up:** {feature name từ features.md}
- **Blockers:** {none / mô tả ngắn}

---

## What's Actually Working (Code + DB + UI)

> Chỉ list những gì có đủ: migration + handler + mobile page.

- ✅ **User Management** — register, invite flow (admin only)
- ✅ **Auth** — login, logout, activate, JWT + refresh token, force-logout on 401
- ✅ **Wallet Management** — CRUD, set default (backend + mobile)
- ✅ **Category Management** — CRUD, system categories seeded
- ✅ **Budget Management** — CRUD, per-wallet budgets
- ✅ **Transaction Management** — create/read with balance update (atomic)
- {thêm/bớt theo thực tế}

---

## Partial / In Progress

> Có code một phần — backend done nhưng mobile chưa, hoặc ngược lại.

- 🔶 **Transaction list filters** — backend supports query params, mobile UI chưa có filter UI
- 🔶 **{feature}** — {mô tả thiếu cái gì}

---

## Specced, Not Yet Coded

> Có spec.md trong specs/, chưa có code thực tế.

- 📋 **{feature}** — `specs/{feature}/spec.md`

---

## Key Technical Decisions (không được thay đổi)

> Đây là decisions đã confirm — AI không được "cải thiện" những thứ này mà không hỏi.

| Decision | Value | Reason |
|----------|-------|--------|
| Money storage | BIGINT cents (÷100 at display) | Float precision |
| JWT strategy | access (short) + refresh (long) + revoked_tokens table | Security |
| No silent refresh | 401 → force re-login | No /auth/refresh endpoint yet |
| DB access | sqlc only, no ORM | Type safety |
| Error format | `{success, error_code, message}` | Consistent with all handlers |
| Mobile state | Riverpod code-gen, keepAlive for auth/api | Pattern established |
| Cursor pagination | cursor-based (not offset) | Scale-ready |

---

## Established Patterns (follow these)

### Backend
- Handler chỉ parse + validate + call service → return response
- Service owns business logic + calls repository
- Repository: sqlc-generated queries only
- Error: `common/errors.go` constants → `ApiException` on mobile
- Response: always via `response/response.go` helpers

### Mobile  
- Feature structure: `data/` → `domain/` → `presentation/{pages,providers,widgets}/`
- Provider: Riverpod `@riverpod` annotation + code-gen (`.g.dart`)
- API call: `dio` client from `dioClientProvider`, interceptor adds Bearer token
- Errors: `ApiException.fromDioException()` → show in SnackBar

### SQL
- All money columns: `BIGINT NOT NULL DEFAULT 0`
- All timestamps: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Soft delete: `deleted_at TIMESTAMPTZ` (nếu cần)
- All IDs: `UUID DEFAULT gen_random_uuid()`

---

## Current Schema (migrations applied)

| # | Migration | Key Changes |
|---|-----------|-------------|
| 001 | init | users table, uuid-ossp extension |
| 002 | seed_admin | admin user seeded |
| 003 | revoked_tokens | token revocation table |
| 004 | wallets | wallets table |
| 005 | categories | categories table |
| 006 | seed_categories | default system categories |
| 007 | budgets | budgets table |
| 008 | transactions | transactions table + wallet balance update trigger |
| {next} | {name} | {description} |

---

## API Surface (routes registered)

| Method | Path | Auth | Role | Handler |
|--------|------|------|------|---------|
| POST | /api/v1/auth/login | No | - | AuthHandler.Login |
| POST | /api/v1/auth/logout | Yes | - | AuthHandler.Logout |
| POST | /api/v1/auth/activate | No | - | AuthHandler.Activate |
| POST | /api/v1/admin/users/invite | Yes | admin | UserHandler.Invite |
| GET | /api/v1/admin/users | Yes | admin | UserHandler.List |
| {thêm từ routes.go} | | | | |

---

## Active TODOs / Known Issues

> Items cần xử lý nhưng chưa thành sprint chính thức.

- [ ] Token refresh flow chưa implement (hiện tại 401 = force re-login)
- [ ] {item khác}

---

## Environment / Infra Notes

- Local dev: Docker Compose (`docker-compose.yml`)
- DB: PostgreSQL {version} trên port {port}
- Backend: Go Fiber trên port {port}
- Mobile: Flutter build local, connect tới backend qua env var `API_BASE_URL`
- AI Service: {chưa setup / đang build / done}

---

## Files to Read First for Each Task

| Task | Files to read |
|------|--------------|
| Add new backend feature | `routes.go`, `interfaces.go`, closest existing handler + service + repository |
| Add new mobile feature | Closest existing feature's `provider` + `page` + `repository_impl` |
| Fix a bug | Relevant `_test.go` files + implementation |
| Update DB schema | Latest migration file + `sqlc.yaml` + relevant `queries/*.sql` |
| BA/spec new feature | `SRS.md` section + `docs/features.md` + closest existing `spec.md` |
```

---

## BƯỚC 3 — Validation

- [ ] TL;DR section có đủ 5 fields không?
- [ ] "What's Actually Working" có CHÍNH XÁC không? (Cross-check: migration tồn tại + handler tồn tại + mobile feature folder tồn tại)
- [ ] "Key Technical Decisions" table có reflect đúng code thực tế không?
- [ ] API Surface table có đủ routes không? (Đọc routes.go nếu chưa đọc)
- [ ] Schema table count khớp với số file migration không?
- [ ] Có TODO nào trong code (search `// TODO:`) mà chưa capture vào "Active TODOs" không?