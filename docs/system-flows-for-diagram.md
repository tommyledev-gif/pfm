# PFM — Mô tả toàn bộ hệ thống & luồng (input để vẽ sơ đồ)

> **Hướng dẫn cho AI vẽ sơ đồ:** Tài liệu này mô tả hệ thống PFM (app quản lý chi tiêu cá nhân) theo kiểu top-down.
> Mỗi flow là một chuỗi bước tuần tự dạng `Bên gửi → Bên nhận: hành động {payload}`, phù hợp để vẽ **sequence diagram**.
> Mục 1–3 dùng để vẽ **deployment/network diagram** và **component diagram**. Mục 11 dùng để vẽ **ER diagram**.
> Các ký hiệu:
> - `[TX BEGIN]` / `[TX COMMIT]` = ranh giới một DB transaction Postgres.
> - `⚠️` = bug / điểm yếu đã xác nhận trong code (nên tô đỏ trên sơ đồ).
> - `(suy luận)` = suy ra từ cấu hình trong repo, chưa xác minh trên dashboard thật.
> - Tiền tệ: mọi số tiền trong API/DB là **integer xu (cents)**, 1 VND = 100 xu.

---

## 0. Danh sách participant (dùng làm lifeline)

| ID | Thành phần | Công nghệ | Chạy ở đâu |
|---|---|---|---|
| `User` | Người dùng cuối | — | — |
| `Admin` | Người dùng role admin | — | — |
| `MobileUI` | Màn hình/component React Native | Expo SDK 54, Expo Router | Điện thoại (APK build qua EAS) |
| `SessionStore` | Zustand store giữ JWT | zustand | RAM trên điện thoại |
| `SecureStore` | Kho token mã hoá | expo-secure-store | Keychain/Keystore điện thoại |
| `ChatStore` | Zustand store thread chat, persist | zustand + AsyncStorage key `pfm_chat_thread` | Điện thoại |
| `PlanStore` | Kế hoạch ngân sách đã lưu | zustand + AsyncStorage key `pfm_budget_plan` | Điện thoại |
| `QueryCache` | Cache server-state | TanStack Query (RAM) | Điện thoại |
| `Axios` | HTTP client + interceptor refresh | axios, timeout 15s | Điện thoại |
| `ImageCache` | Cache ảnh | expo-image `memory-disk` | Điện thoại |
| `CF` | Cloudflare edge (DNS proxied, TLS) | Cloudflare | Edge |
| `Backend` | Go API | Go 1.23, Fiber v2, pgx/v5, sqlc | VPS, container `pfm-backend-container`, host port 80 → 8080 |
| `Handler` / `Service` / `Repo` | 3 lớp trong Backend | handler → service → repository(sqlc) | trong Backend |
| `Scheduler` | Goroutine chạy nền trong Backend | time.Ticker | trong process Backend |
| `DB` | PostgreSQL 16 | postgres:16-alpine | VPS, container `pfm-postgres-container`, chỉ bind 127.0.0.1:5432 |
| `AISvc` | Python AI service | FastAPI, uvicorn, Pydantic v2 | VPS, container `pfm-ai-service-container`, :8000, **không public port** |
| `Groq` | LLM chính | Groq API, model `openai/gpt-oss-120b` | Internet |
| `Anthropic` | LLM dự phòng | `claude-3-5-haiku-20241022` | Internet ⚠️ chưa cấu hình key |
| `R2` | Object storage icon | Cloudflare R2 (S3 API qua minio-go) | Cloudflare |
| `jsDelivr` | CDN ảnh emoji OpenMoji | cdn.jsdelivr.net | Internet |
| `SMTP` | Gửi email mời | Gmail SMTP 587 | Internet |
| `GitHub` | Repo + GitHub Actions | CI/CD | GitHub |
| `DockerHub` | Registry image | Docker Hub | Internet |

---

## 1. Hạ tầng & mạng (deployment diagram)

### 1.1 Topology production

```
[Điện thoại: APK Expo]
   │  HTTPS  https://api.example.com/api/v1   (EXPO_PUBLIC_API_BASE_URL, inline lúc build EAS)
   ▼
[Cloudflare Edge]  DNS record proxied (đám mây cam) → TLS terminate tại edge
   │  HTTP thuần :80   ⚠️ không mã hoá CF→origin (suy luận: SSL mode "Flexible", vì origin không có gì nghe :443)
   ▼
[VPS Ubuntu]  UFW: 22/tcp mở mọi nơi; 80,443 chỉ cho dải IP Cloudflare
   │           ⚠️ Docker publish port tự chèn iptables, BỎ QUA UFW → port 80 có thể truy cập trực tiếp từ internet
   └─ Docker network mặc định của compose (backend/docker-compose.yml)
        ├─ pfm-backend-container   0.0.0.0:80 → 8080   (image ${DOCKERHUB_USER}/pfm-backend:<sha>)
        │     ├─► pfm-postgres:5432          (DATABASE_URL, sslmode=disable, nội bộ)
        │     ├─► http://ai-service:8000     (AI_SERVICE_URL, không auth, nội bộ)
        │     ├─► R2 S3 API https://<account>.r2.cloudflarestorage.com  (upload icon)
        │     └─► smtp.gmail.com:587         (email mời)
        ├─ pfm-postgres-container  127.0.0.1:5432 → 5432, volume pfm_postgres_data  ⚠️ không có backup
        └─ pfm-ai-service-container (không port ra host)
              ├─► api.groq.com (HTTPS)
              └─► api.anthropic.com (HTTPS, dự phòng)

[Điện thoại] ──HTTPS──► R2 public URL (R2_PUBLIC_BASE_URL, dạng pub-xxx.r2.dev hoặc custom domain) : tải icon user upload
[Điện thoại] ──HTTPS──► cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@17.0.0/color/72x72/<HEX>.png : emoji icon
```

- Giới hạn RAM container (mặc định compose): postgres 512M, backend 512M, ai-service 192M. VPS có swap 2GB, `vm.swappiness=10`, Docker DNS 8.8.8.8 / 1.1.1.1.
- Healthcheck: backend `wget http://127.0.0.1:8080/api/v1/health` mỗi 10s; ai-service `wget :8000/health`; postgres `pg_isready`.
- `restart: unless-stopped` cho cả 3.
- Frontend Next.js (`frontend/`) **không được deploy** (không có workflow). Vì vậy Backend tự phục vụ trang HTML `GET /activate` để người được mời kích hoạt tài khoản.
- Local dev: `docker-compose.yml` ở root chạy postgres + backend (host 8090) + ai-service + web (8082). Mobile chạy `npx expo start` (Metro), không container.

### 1.2 Cloudflare & các lớp cache (quan trọng để vẽ "cache layers")

Hệ thống **không có cache server-side chuyên dụng** (không Redis, không CDN rule riêng). Các lớp "cache" thực tế:

| # | Lớp | Nội dung cache | Cơ chế / TTL | Ghi chú |
|---|---|---|---|---|
| C1 | **Cloudflare edge – API** | Response JSON `/api/v1/*` | **Không cache**. Backend không set `Cache-Control`/`ETag` ở bất kỳ đâu; Cloudflare mặc định không cache JSON/dynamic (chỉ cache theo phần mở rộng file tĩnh) | CF chỉ làm reverse proxy + TLS + chống DDoS cơ bản (suy luận: không có Page Rule/Cache Rule nào trong repo) |
| C2 | **Cloudflare edge – `/activate`** | Trang HTML kích hoạt | Không cache (HTML không cache mặc định) | Trang tĩnh inline JS |
| C3 | **R2 public URL** | Ảnh icon user upload | Nếu dùng `r2.dev`: Cloudflare giới hạn tốc độ, không khuyến nghị cho production, cache không kiểm soát được. Nếu dùng custom domain: đi qua CF cache theo mặc định cho ảnh. ⚠️ Upload **không set `Cache-Control`** trên object | Object key có UUID → URL bất biến, có thể cache vĩnh viễn nếu cấu hình |
| C4 | **jsDelivr CDN** | PNG emoji OpenMoji 72x72 | CDN công cộng, version pin `@17.0.0` | |
| C5 | **expo-image memory-disk** (điện thoại) | Icon R2 + emoji | Cache RAM + đĩa. `usePrefetchRecordIcons` prefetch toàn bộ icon của categories + wallets một lần mỗi phiên, lúc vào `(app)` | Fallback: iconUrl → emoji glyph → chữ cái đầu |
| C6 | **TanStack Query** (điện thoại, RAM) | Mọi server state | `staleTime` mặc định 30s, `retry: 3`; wallets/categories/budgets/report-summary dùng 5 phút. Mutation invalidate key liên quan. ⚠️ `queryClient.clear()` chạy mỗi lần `setTokens` → **mỗi lần refresh token (~12 phút) xoá sạch cache** | Không polling (`refetchInterval` không dùng ở đâu) |
| C7 | **AsyncStorage** (điện thoại) | Thread chat (`pfm_chat_thread`), kế hoạch ngân sách (`pfm_budget_plan`) | Persist vĩnh viễn đến khi logout/xoá | Thread chat còn được sao lưu lên server (bảng `chat_thread_messages`) |
| C8 | **SecureStore** (điện thoại) | access token, refresh token, email, issued_at | Mã hoá bởi OS | |
| C9 | **RAM Backend** | Bộ đếm rate limit (Fiber limiter), token budget consult 4000 token/phút toàn cục | Mất khi restart container; không chia sẻ nếu scale nhiều instance | |
| C10 | **Groq prompt cache** | Prefix prompt giống nhau | Phía Groq tự động; ai-service chỉ **đo** `cached_tokens` cho consult, không chủ động tối ưu | |

---

## 2. CI/CD — luồng deploy (sequence)

### F-CI-1 Deploy backend (push `develop` có thay đổi `backend/**`)

1. `Dev → GitHub: git push develop`
2. `GitHub Actions → job test (backend-test.yml): go vet ./... ; go test ./...` (unit test với fake repo, **không có Postgres thật**)
3. `job build-and-push → DockerHub: build ./backend (multi-stage golang:1.23-alpine → alpine:3.20), push tag :latest và :<git sha>`
   - image chứa 3 binary: `server`, `migrate` (migrations embed bằng go:embed), `seed`
4. `job build-and-push: Trivy scan HIGH/CRITICAL` (exit-code 0 → **chỉ báo, không chặn**)
5. `job deploy → VPS (SCP): copy backend/deploy.sh, backend/docker-compose.yml, backend/db/migrations → $VPS_APP_DIR`
6. `job deploy → VPS (SSH, appleboy/ssh-action):`
   1. `docker login` bằng DOCKERHUB_TOKEN
   2. Ghi secret `VPS_ENV_PROD` → file `.env.prod` ⚠️ secret nằm trong nháy kép của script → ký tự `$`/backtick bị shell diễn giải
   3. Đọc `.last_good_tag` (PREV_TAG)
   4. Chạy `deploy.sh` với `PFM_BACKEND_IMAGE_TAG=<sha>`:
      1. Kiểm tra `.env.prod` có đủ POSTGRES_USER/PASSWORD/DB, JWT_SECRET, CORS_ALLOWED_ORIGINS, APP_BASE_URL
      2. `docker compose pull` lần lượt pfm-postgres, pfm-backend, ai-service (retry 3 lần, tránh race containerd)
      3. `docker compose up -d --remove-orphans` → container mới start
      4. `docker compose run --rm --entrypoint ./migrate pfm-backend` → áp migration còn thiếu, ghi ledger `schema_migrations` ⚠️ chạy **sau** khi code mới đã start
      5. `docker compose run --rm --entrypoint ./seed pfm-backend` → tạo admin đầu tiên nếu có SEED_ADMIN_* (idempotent, nhưng ghi đè hash mật khẩu admin nếu biến vẫn còn)
      6. `docker image prune -f`
   5. Health check: `docker exec pfm-backend-container wget /api/v1/health`, tối đa 20 lần × 10s
   6. OK → ghi `<sha>` vào `.last_good_tag`, xong
   7. Fail → rollback: chạy lại deploy.sh với PREV_TAG, health check 10 lần; job vẫn báo đỏ. ⚠️ Rollback không lùi migration

### F-CI-2 Deploy ai-service (thay đổi `ai-service/**`)
Giống F-CI-1 nhưng: không có bước test, image `python:3.12-slim` + uvicorn, backend giữ tag trong `.last_good_tag`, ai-service dùng tag `<sha>`. Không rollback.
⚠️ Hai workflow có concurrency group khác nhau nhưng cùng chạy `deploy.sh` trên cùng một compose → có thể chạy chồng nhau. `cancel-in-progress: true` có thể huỷ giữa chừng một lần deploy đang chạy.

### F-CI-3 PR check (`ci-pr.yml`)
PR vào develop → paths-filter → nếu `backend/**`: go vet/test; nếu `frontend/**`: lint + typecheck. Mobile và ai-service không có CI.

### F-CI-4 Setup VPS một lần
`vps-bootstrap.sh` (cài Docker, swap, sysctl, DNS, thêm user vào group docker) → `setup-ufw.sh` (SSH mở, 80/443 chỉ IP Cloudflare, default deny incoming).

---

## 3. Kiến trúc bên trong Backend (component diagram)

### 3.1 Khởi động `cmd/server/main.go`
1. `newLogger()` (zap Production nếu `APP_ENV=production`)
2. `config.Load()` đọc env: PORT(8080), DATABASE_URL*, JWT_SECRET*, CORS_ALLOWED_ORIGINS, SMTP_*, APP_BASE_URL, AI_SERVICE_URL (mặc định `http://ai-service:8000`), R2_*
3. `pgxpool.New` → `sqlc.New(pool)`
4. Tạo repository: Wallet/Category/Budget/Transaction nhận `(queries, pool)` để tự `BeginTx`; các repo khác chỉ nhận `queries`
5. Tạo client ngoài: `TokenService(JWT_SECRET)`, `EmailSender` (SMTP hoặc LogEmailSender nếu không có SMTP_HOST), `IconUploader` (R2 hoặc Unconfigured → 503), `HTTPAIServiceClient`, `HTTPAIBudgetClient`, `HTTPAIConsultClient`, `ConsultTokenBudget(4000 token/1 phút)`
6. Tạo service (dependency):
   - `AuthService(userRepo, revokedRepo, tokenService)`
   - `UserService(userRepo, emailSender)`
   - `WalletService(walletRepo)`, `CategoryService(categoryRepo)`
   - `CycleResolver(budgetPlanRepo)` (dùng chung, tính "kỳ" theo Asia/Ho_Chi_Minh)
   - `BudgetService(budgetRepo, cycleResolver)`
   - `TransactionService(transactionRepo, walletRepo, categoryRepo)`
   - `AuditLogService`, `TransactionExportService`, `TransactionImportService(transactionService, …, tokenService)`
   - `ReportService(reportRepo, walletRepo, categoryRepo, cycleResolver)`
   - `NotificationService(notificationRepo, budgetRepo, cycleResolver)`
   - `ChatService(chatRepo, walletRepo, categoryRepo, aiServiceClient)`, `ChatThreadService(chatThreadRepo)`
   - `BudgetWizardService(budgetRepo, categoryRepo, walletRepo, aiBudgetClient)`
   - `AnalyticsService(reportRepo, analyticsRepo, walletRepo, categoryRepo, budgetService, cycleResolver)`
   - `ConsultService(analyticsService, analyticsRepo, walletRepo, categoryRepo, aiConsultClient, consultTokens, intentLogRepo, cycleResolver)`
   - `IntentLogRetention(intentLogRepo)`
7. `fiber.New` với ErrorHandler tuỳ chỉnh → middleware global duy nhất: **CORS**. ⚠️ Không có recover (panic = sập process), không có access log, không request-id
8. `registerRoutes` (xem 3.2)
9. `go app.Listen(:8080)`
10. `go runNotificationScheduler` (mỗi 5 phút, lần đầu sau 5 phút) + `go runIntentLogRetention` (ngay lúc start rồi mỗi 24h)
11. `waitForShutdown`: SIGINT/SIGTERM → dừng scheduler → `ShutdownWithTimeout(10s)` → đóng pool

### 3.2 Bảng route & chuỗi middleware

| Nhóm | Route | Middleware chain |
|---|---|---|
| Public | `GET /activate` (HTML), `GET /api/v1/health` | — |
| Auth | `POST /auth/activate`, `POST /auth/logout`, `POST /auth/refresh` | — (⚠️ refresh không có rate limit) |
| Auth | `POST /auth/login` | LoginRateLimiter 10 req/15 phút/IP ⚠️ `c.IP()` sau Cloudflare = IP của Cloudflare → mọi user có thể dùng chung một bộ đếm |
| Admin | `POST /admin/users/invite`, `GET /admin/users` | JWTAuth → RequireRole(admin) → (invite) InviteRateLimiter 20/giờ |
| CRUD | `/wallets`, `/categories`, `/budgets` (+ `/budgets/bulk`, `/*/icon`), `/transactions` (+ audit-logs, export, import/preview, import/commit), `/reports/summary`, `/notifications` | JWTAuth |
| AI | `/ai/chat`, `/ai/chat/thread`, `/ai/chat/thread/sync`, `/ai/budget-wizard/prefill`, `/ai/budget-proposals`, `/ai/suggest-category-name` | JWTAuth → AIChatRateLimiter **30 req/giờ/user dùng chung cho cả nhóm** ⚠️ |
| Analytics | `POST /analytics/query` | JWTAuth |
| Analytics | `POST /analytics/consult` | JWTAuth → AIConsultRateLimiter 20/giờ/user (không đếm request lỗi) |

`JWTAuth`: đọc `Authorization: Bearer`, verify HS256 + exp, bắt buộc claim `user_id` và `role`, set `c.Locals(userID, role)`. Không tra DB, không check revoke.

Response envelope: `{success, message, data?, error_code?, details?}`.

### 3.3 Kiến trúc AI service (`ai-service/app`)
- `main.py`: FastAPI, 3 router + `GET /health` (chỉ trả `{"status":"ok"}`, không kiểm tra Groq)
- `routers/extract_router.py` → `services/extract_service.py` + `services/prompt_builder.py`
- `routers/budget_router.py` → `services/category_suggestion_service.py`
- `routers/consult_router.py` → `services/consult_service.py` + `services/consult_prompt.py` + `nlu/normalize.py`
- `core/config.py` (pydantic-settings), `core/groq_client.py` (client Groq/Anthropic), `core/logging.py` (JSON stdout, không log nội dung prompt)
- Không auth, không rate limit riêng; chỉ dựa vào việc nằm trong mạng Docker nội bộ.
- ⚠️ `/extract` và `/suggest-category-name` gọi SDK **đồng bộ** bên trong `async def` → block event loop uvicorn duy nhất. `/consult` dùng `run_in_threadpool`.

---

## 4. Flow xác thực

### F-AUTH-1 Khởi động app (cold start)
1. `MobileUI(app/_layout.tsx) → installGlobalErrorLogger()`
2. `MobileUI`: render providers SafeAreaProvider → ThemeProvider → QueryClientProvider; chưa hydrate thì hiện splash
3. `MobileUI → SessionStore.hydrate()`
4. `SessionStore → SecureStore: getItem × 4 song song (pfm_access_token, pfm_refresh_token, pfm_user_email, pfm_tokens_issued_at)`
5. `SessionStore`: set state, `role = decode JWT payload (không verify)`, `isHydrated = true`
6. Nếu có token: `SessionStore → RefreshScheduler.schedule(delay = issuedAt + 12 phút − now)` (access TTL 15 phút − lead 3 phút)
7. `MobileUI (Stack.Protected)`: `accessToken != null` → vào nhóm `(app)`, ngược lại vào `(auth)/login`
8. Vào `(app)`: `usePrefetchRecordIcons` → `QueryCache: GET /categories/, GET /wallets/` → `ImageCache.prefetch(icon_url + openmoji url, memory-disk)`
9. Home mount → ~6 query song song (wallets, categories, budgets, 3 × report-summary)

### F-AUTH-2 Đăng nhập
1. `User → MobileUI(LoginForm): nhập email, password`
2. `MobileUI → Axios: POST /auth/login {email, password}`
3. `Axios → CF → Backend: HTTPS → HTTP:80`
4. `Backend: LoginRateLimiter (IP)` → `AuthHandler.Login` → `AuthService.Login`
5. `AuthService → Repo → DB: GetUserByEmail` (⚠️ so sánh email phân biệt hoa thường)
   - không có user → bcrypt so sánh giả (cân bằng thời gian) → 401 INVALID_CREDENTIALS
   - status pending → 401 ACCOUNT_NOT_ACTIVATED; disabled → 401 ACCOUNT_DISABLED
6. `AuthService: bcrypt.Compare(hash, password)`
7. `AuthService → TokenService.GenerateTokenPair`: access HS256 `{user_id, role, sub, iat, exp+15m}`, refresh `{jti uuid, sub, exp+7d}`
8. `Backend → MobileUI: 200 {access_token, refresh_token}`
9. `MobileUI → SessionStore.setTokens(access, refresh, email)` → `SecureStore: ghi 4 key (issued_at = now)` → `QueryCache.clear()` → `RefreshScheduler.schedule(12 phút)`
10. `MobileUI`: guard đổi → chuyển sang `(app)`

### F-AUTH-3 Refresh token (2 đường kích hoạt)
**Đường A – chủ động:** `RefreshScheduler` hết giờ (12 phút) → `SessionStore.refreshSession()`
**Đường B – bị động:** mọi request trả 401 (trừ /auth/login, /auth/activate) và chưa `_retried` → `Axios interceptor → SessionStore.refreshSession()`

1. `SessionStore`: nếu đã có `refreshPromise` đang chạy → trả luôn promise đó (nhiều 401 cùng lúc chỉ tạo 1 lần refresh)
2. `SessionStore → refreshClient (axios riêng, không interceptor): POST /auth/refresh {refresh_token}`
3. `Backend: AuthHandler.Refresh → AuthService.Refresh`
4. `AuthService → TokenService.ParseRefreshTokenUnverified(token)` → lấy jti, sub, exp
   ⚠️ **KHÔNG verify chữ ký** → ai biết UUID của user có thể tự tạo token giả và lấy token thật (lỗ hổng nghiêm trọng)
5. `AuthService`: exp đã qua → 401
6. `AuthService → DB: IsTokenRevoked(jti)` → đã revoke thì 401
7. `AuthService → DB: GetUserByID(sub)` → phải active
8. `AuthService → TokenService.GenerateTokenPair(user)`
9. `AuthService → DB: RevokeToken(jti cũ, userID, exp)` (ON CONFLICT DO NOTHING; lỗi chỉ ghi log)
10. `Backend → Mobile: 200 {access_token, refresh_token}`
11. `SessionStore.setTokens(...)` → SecureStore → ⚠️ `QueryCache.clear()` → lên lịch refresh mới
12. Đường B: `Axios`: gắn token mới, đặt `_retried=true`, gửi lại request gốc
13. Refresh thất bại → `SessionStore.clear()` (xoá SecureStore, clear cache) → toast "Phiên đăng nhập đã hết hạn" → guard đá về login

### F-AUTH-4 Đăng xuất
1. `User → Settings: bấm Đăng xuất`
2. `MobileUI → ChatStore.flushSync()` (tối đa 4s) → `POST /ai/chat/thread/sync {toàn bộ thread}`
3. `MobileUI → ChatStore.clear()` → `SessionStore.clear()` (xoá token, cache)
   (Backend có `POST /auth/logout {refresh_token}` → `RevokeToken(jti)`; access token vẫn dùng được đến khi hết 15 phút)

### F-AUTH-5 Mời & kích hoạt user (invite-only)
1. `Admin → Mobile(users screen) → Backend: POST /admin/users/invite {email, full_name, role}`
2. `Backend: JWTAuth → RequireRole(admin) → InviteRateLimiter → UserHandler.InviteUser → UserService.InviteUser`
3. `UserService → DB: CountUserByEmailAnyStatus` → đã tồn tại ở bất kỳ trạng thái nào → 409 ⚠️ invite hết hạn không gửi lại được (không có resend/delete)
4. `UserService`: token = 32 byte crypto/rand dạng hex
5. `UserService → DB: CreateInvitedUser (status=pending, invite_token, invite_expires_at = now+72h)`
6. `UserService → goroutine → EmailSender → SMTP: gửi mail có link {APP_BASE_URL}/activate?token=...` (timeout 10s, không chặn response)
7. `Backend → Admin: 201`
8. `User → Email → mở link → CF → Backend: GET /activate?token=...` → trả HTML tĩnh + inline JS
9. `User → form: nhập họ tên, mật khẩu, xác nhận` → `JS → Backend: POST /api/v1/auth/activate {token, full_name, password, password_confirm}`
10. `AuthService.Activate`: độ dài mật khẩu ≥ 8 (WEAK_PASSWORD), password == confirm
11. `→ DB: GetUserByInviteToken` (pending) → không có: 404; hết hạn: 410 TOKEN_EXPIRED
12. `→ bcrypt hash (cost 12) → DB: ActivateUser` (UPDATE nguyên tử: status=active, xoá token, `WHERE invite_expires_at > NOW()`)
13. `→ GenerateTokenPair → 200 {user, access_token, refresh_token}` (trang web không lưu token; user tự đăng nhập bằng app)

**Bootstrap admin đầu tiên:** `deploy.sh → ./seed` đọc SEED_ADMIN_EMAIL/PASSWORD → upsert admin.

---

## 5. Flow AI ①: Ghi giao dịch bằng chat (chế độ "transaction")

### F-AI-1 Gửi tin nhắn → nhận đề xuất
1. `User → MobileUI(ai-chat tab, mode=transaction): gõ "sáng cafe 30k, trưa 2 trà đá 5k"`
2. `MobileUI → useChatActions.send(text)`
3. `→ ChatStore.addMessage({id: "msg_<ts>_<n>", role: user, text})` → persist AsyncStorage → **đặt lịch sync debounce 3s** (F-AI-4)
4. `MobileUI`: hiện typing indicator (tối thiểu 1300ms)
5. `Axios → CF → Backend: POST /api/v1/ai/chat {message}` ⚠️ mobile **không gửi `conversation_id`** → mỗi tin nhắn là một hội thoại mới trên server (history luôn rỗng)
6. `Backend: JWTAuth → AIChatRateLimiter(30/h) → ChatHandler.Chat` (BodyParser, validate: message 1–1000 ký tự)
7. `ChatHandler → ChatService.Chat(userID, req)` (không có DB transaction trong flow này)
8. `ChatService`: `conversationID = req.conversation_id ?? uuid.New()`
9. `ChatService.buildHistory → ChatRepo → DB: ListRecentChatMessagesByConversation(convID, limit 10)` → đảo lại theo thứ tự cũ → mới
   ⚠️ query không lọc `user_id` (client có thể gửi conversation_id của người khác)
10. `ChatService → DB: CreateChatMessage {user_id, conversation_id, role=user, content}`
11. `ChatService → DB: ListWalletsByUser` → nếu 0 ví: lưu tin assistant "Bạn cần tạo một ví trước…" → trả `intent=ambiguous` (không gọi AI)
12. `ChatService → DB: ListCategoriesForUser` (danh mục hệ thống + của user, bỏ loại transfer)
13. `ChatService → HTTPAIServiceClient.Extract → AISvc: POST http://ai-service:8000/extract` (timeout 15s)
    payload: `{message, history[{role, content}], wallets[{id, name, is_default, currency}], categories[{id, name, type}], now: RFC3339 UTC}`
14. **Bên trong AISvc (`extract_service.py`):**
    1. `prompt_builder.build_system_prompt(wallets, categories, now)` → system prompt tiếng Việt: giờ hiện tại, danh sách ví (id/name/default/currency), danh mục chia nhóm CHI TIÊU / THU NHẬP, 14 quy tắc:
       - Quy tắc 0: yêu cầu lập ngân sách → `intent=budget_wizard`
       - Quy tắc 2: k/nghìn/ngàn = ×1.000; m/tr/triệu = ×1.000.000; 1.5tr = 1.500.000
       - Quy tắc 3: hôm nay/hôm qua tính theo `now` ⚠️ `now` là UTC → 0h–7h giờ VN "hôm nay" bị hiểu thành hôm qua
       - Quy tắc 4: nhân số lượng (2 trà đá 5k = 10.000); Quy tắc 5: tách nhiều giao dịch
       - Quy tắc 6–7: chọn tx_type trước, rồi chọn danh mục đúng loại; Quy tắc 8: wallet id hoặc null
       - Quy tắc 9: chỉ trả `ambiguous` khi không có số tiền hoặc không phải giao dịch; Quy tắc 10: confidence < 0.6 khi không chắc
       - Quy tắc 12–14: từ khoá thu/chi, gợi ý danh mục, note phải cụ thể
    2. Tool schema = `ExtractResponse.model_json_schema()` đã inline `$ref` (`_dereference_schema`), tool name `extract_transactions`
    3. `_history_messages`: bỏ các lượt đầu không phải user (Anthropic yêu cầu xen kẽ)
    4. `AISvc → Groq: chat.completions (model gpt-oss-120b, temperature 0, max_tokens 1024, tool_choice bắt buộc extract_transactions)`, messages = `[system, …history, user]`. SDK tự retry 2 lần.
    5. Parse `tool_calls[0].arguments` → `json.loads` → `ExtractResponse.model_validate` (Pydantic, extra=forbid)
    6. **Bất kỳ lỗi nào** (mạng, 429, không có tool call, JSON/validation sai) → `AISvc → Anthropic: messages.create (tool_choice tool)` → validate `tool_use.input`
    7. Anthropic cũng lỗi → `ExtractionUnavailableError` → HTTP 503
    8. Thành công → `200 {intent: create_transaction|ambiguous|budget_wizard, transactions[{amount_vnd, tx_type, category_id, wallet_id?, note?, occurred_at YYYY-MM-DD, confidence}]}`
15. `ChatService`: AI lỗi/non-200 → log Warn → trả `502 AI_SERVICE_UNAVAILABLE` ⚠️ tin user đã lưu nhưng không có tin assistant
16. `intent == budget_wizard` → `respondBudgetWizard`: lưu tin assistant "Mình có thể giúp bạn lên kế hoạch ngân sách!…" → trả `{intent: budget_wizard, action_type: budget_wizard, actions: []}` → sang F-AI-8
17. `ChatService.resolveActions` (thuần RAM, kiểm tra lại đầu ra AI vì **ID từ LLM không tin được**), với từng đề xuất:
    - bỏ nếu tx_type không phải income/expense (chat không tạo chuyển khoản)
    - bỏ nếu category_id không phải UUID / không thuộc user / sai loại
    - bỏ nếu amount_vnd ≤ 0
    - ví: wallet_id AI chọn (phải thuộc user) → nếu không có thì ví mặc định → không có thì bỏ (lý do "no wallet")
    - occurred_at parse lỗi → now
    - `amount = amount_vnd × 100` (xu) ⚠️ nhân 100 bất kể ví USD
    - tạo `idempotency_key = uuid.New()` cho mỗi action
18. Không còn action nào → lưu tin ambiguous ("Vui lòng cho biết bạn muốn dùng ví nào." hoặc "Mình chưa hiểu giao dịch này…")
19. `renderConfirmMessage`: có action confidence < 0.6 → "Mình đoán N giao dịch như bên dưới — bạn xem lại giúp mình nhé." ngược lại "Đã đề xuất N giao dịch, vui lòng xác nhận."
20. `ChatService → DB: CreateChatMessage {role=assistant, content, intent=create_transaction}`
21. `Backend → Mobile: 200 {message, intent, actions[{type: create_transaction, payload{wallet_id, category_id, amount, type, note, occurred_at}, idempotency_key, confidence}], conversation_id}`
22. `MobileUI`: tạo tin assistant `{text, action: actions[0], actionType, editHistory: [{source: created}]}` ⚠️ chỉ lấy **action đầu tiên** → `ChatStore.addMessage` → sync debounce
23. Lỗi `RATE_LIMITED` / `AI_SERVICE_UNAVAILABLE` → tin assistant "bận" + nút "Nhập thủ công" (`offerManualEntry`) → mở TransactionFormModal
24. `MobileUI(ChatMessageRow)` hiển thị:
    - `TransactionActionCard` (kèm tác động ngân sách lấy từ `useBudgetsQuery`)
    - hoặc `BudgetWizardCard` nếu `actionType=budget_wizard`
    - hoặc `TransactionTombstoneCard` nếu đã bỏ/xoá

**Nhấn mạnh khi demo:** AI **không bao giờ tự ghi giao dịch**; user phải xác nhận từng thẻ.

### F-AI-2 Xác nhận đề xuất → tạo giao dịch
1. `User → TransactionActionCard: bấm Xác nhận` (hoặc màn Pending: "Duyệt" / "Duyệt tất cả" = tuần tự từng cái)
2. `MobileUI → useConfirmProposal.confirm → useCreateTransactionMutation`
3. `Axios → Backend: POST /transactions/ {wallet_id, category_id, amount, type, note, occurred_at, idempotency_key}`
4. → Flow F-TX-1 (tạo giao dịch). Trùng idempotency_key → trả 200 bản ghi cũ (bấm 2 lần không tạo 2 giao dịch)
5. `onSuccess → QueryCache.invalidate(["transactions"], ["wallets"], ["report-summary"])`
6. `→ checkBudgetLimit` (chỉ khoản chi): lấy currency ví từ cache → `fetchQuery(["budgets"]) GET /budgets/` → đã dùng ≥80% hoặc ≥100% → toast cảnh báo
7. `ChatStore.updateMessage(id, {confirmed: true, transactionId})` → sync debounce
8. Lỗi `INSUFFICIENT_BALANCE` → toast lỗi

### F-AI-3 Sửa / bỏ đề xuất
- **Sửa tin nhắn của user:** `editUserMessage` → cập nhật text → đánh dấu tin assistant kế tiếp (nếu chưa xác nhận) là `superseded` → gửi lại `POST /ai/chat {message}` → thêm tin trả lời mới `edited: true`
- **Sửa thẻ đề xuất:**
  - chưa xác nhận → chỉ sửa local, tạo `idempotency_key` mới, thêm entry `editHistory: edited`
  - đã xác nhận → `PATCH /transactions/{id} {amount, category_id, occurred_at, note}` → F-TX-2 → invalidate cache + checkBudgetLimit
- **Bỏ / xoá:** ConfirmDialog →
  - chưa lưu → `removalState = discarded` (không gọi HTTP)
  - đã lưu → `DELETE /transactions/{id}` → F-TX-3 → invalidate transactions, wallets, budgets, report-summary, audit-logs → `removalState = deleted`
  - tin nhắn không bao giờ bị xoá khỏi thread; hiện thẻ tombstone
- **Xem lịch sử:** tombstone "deleted" → `GET /transactions/audit-logs?transaction_id=` (infinite, cursor); "discarded" → hiện `editHistory` local

### F-AI-4 Đồng bộ thread chat với server (backup đa thiết bị)
1. `ChatStore.addMessage / updateMessage` → `scheduleSync` (debounce 3s, timer module-level) ⚠️ `removeMessage` không lên lịch sync
2. Hết 3s → `Axios → Backend: POST /ai/chat/thread/sync {messages: [{client_message_id: m.id, payload: m (toàn bộ JSON tin nhắn)}]}` — **luôn gửi toàn bộ thread**
3. `Backend: JWTAuth → AIChatRateLimiter` ⚠️ **mỗi lần sync tốn 1 lượt trong 30 lượt/giờ của chat**
4. `ChatHandler.SyncThread` (validate min 1 message) → `ChatThreadService.Sync` → lặp tuần tự từng tin → `DB: UpsertChatThreadMessage` (`ON CONFLICT (user_id, client_message_id) DO UPDATE payload`); không có transaction, lỗi giữa chừng thì phần trước vẫn được lưu; không xoá bao giờ
5. `Mobile`: lỗi bị bỏ qua; nếu cache `["chat-thread"]` tồn tại thì `setQueryData`
6. **Khôi phục:** khi mở tab chat mà thread local rỗng → `GET /ai/chat/thread` → `DB: ListChatThreadMessagesByUser (ORDER BY created_at)` → `ChatStore.hydrateThread` (chỉ áp nếu local vẫn rỗng; **local luôn thắng, không merge**)
- Lưu ý: có **2 bảng chat khác nhau**: `chat_messages` (log text để làm history cho AI, client không đọc) và `chat_thread_messages` (bản sao JSON thread của client).

---

## 6. Flow AI ②: Hỏi đáp chi tiêu (chế độ "consult")

### F-AI-5 Hỏi bằng câu tự do
1. `User → ChatModePicker: chọn "consult"` → `MobileUI` render `ConsultPane` (dùng chung ChatStore, lọc `consultQuestion`)
2. `User: gõ "tháng này t tiêu bn"` (hoặc bấm 1 trong 4 starter chip → đi thẳng F-AI-6)
3. `useConsultActions.exchange → ChatStore.addMessage({role: user, consultQuestion: true})`
4. `Axios → Backend: POST /analytics/consult {message}` (1–300 ký tự)
5. `Backend: JWTAuth → AIConsultRateLimiter(20/h, không tính request lỗi) → AnalyticsHandler.Consult → ConsultService.Consult`
6. `ConsultService → DB: ListWalletsByUser` → xác định currency (ví mặc định → ví đầu → mặc định)
7. `ConsultService → ConsultTokenBudget.Allow()` — cửa sổ trượt 1 phút, **toàn cục mọi user**, < 4000 token? Không → trả `degraded` (không gọi AI)
8. `ConsultService.buildContext`:
   - `DB: ListCategoriesForUser`, `DB: ListWalletsByUser`
   - nếu > 20 danh mục: `CycleResolver.Window(-5)` (6 kỳ gần nhất; `DB: GetActiveCycleStartDay`) → `DB: ListTopCategoriesRecent(since, 20)` → lấy 20 danh mục dùng nhiều nhất, thiếu thì bù theo alphabet
9. `ConsultService → HTTPAIConsultClient.Parse → AISvc: POST /consult` (timeout 8s, không retry)
   payload: `{message, categories (≤20), wallets, today: YYYY-MM-DD giờ VN, timezone: "Asia/Ho_Chi_Minh"}`
10. **Bên trong AISvc (`consult_service.py`):**
    1. `nlu.normalize(message)` (quy tắc cố định, không dùng LLM):
       - gộp khoảng trắng, lowercase
       - bỏ đại từ (tôi/tui/tao/mình/tớ/em, sau khi bỏ dấu: toi/minh/mk/t)
       - bỏ dấu tiếng Việt (đ → d)
       - quy đổi tiền: `1tr5` → 1500000, `1.5 triệu`, `2 củ` → triệu, `50k`/`500 nghìn` → nghìn
       - teencode: bn → "bao nhieu", ko/k/kh/hok → "khong", dc, j, vs…
       - thời gian: "bua h / dao nay / gan day" → "30 ngay qua"
       → ví dụ ra `"thang nay tieu bao nhieu"`
    2. `build_consult_prompt`: liệt kê danh mục chi/thu + ví kèm ID, today, timezone; định nghĩa kind/metric/period; **cấm tính toán hay đưa ra con số**; không biểu diễn được điều kiện nào → `coverage = partial`
    3. User message gửi đi = `"Câu gốc: <raw>\nDạng chuẩn hoá: <normalized>"`
    4. `AISvc → Groq` (qua `run_in_threadpool`; max_retries 0, timeout 7s, max_tokens 400, temperature 0, tool bắt buộc `classify_spending_question`). **Không có dự phòng Anthropic.**
    5. Tool output phẳng `ConsultToolOutput`:
       - `kind` ∈ query | evaluate | scenario | unsupported | needs_context | transaction_like
       - `coverage` ∈ full | partial
       - `metric` ∈ sum | breakdown | compare | series | top_n | max_tx | avg_daily | budget_status
       - `period` ∈ this_cycle | last_cycle | last_3_cycles | last_6_cycles | last_30_days | this_week | custom
       - `group_by`, `tx_type`, `from_date`, `to_date`, `category_ids`, `wallet_id`, `amount_min_vnd`, `limit ≤ 10`, `category_confidence`
    6. `to_response` (chặn ID bịa): category_id/wallet_id không có trong danh sách đã gửi, hoặc thiếu metric/period → `coverage = partial`, bỏ query
    7. Trả `{kind, coverage, query?, category_confidence, normalized_text, usage{prompt_tokens, completion_tokens, cached_tokens}}`; lỗi → 503
11. `ConsultService`: AI lỗi → `degraded` (200, kèm chip gợi ý)
12. `ConsultService → ConsultTokenBudget.Record(prompt + completion)`
13. `ConsultService.route` (`consult_routing.go`):
    - `evaluate` / `scenario` → `kind: coming_later` ("Đánh giá và thử kịch bản sẽ có trong bản sau") + chip
    - `needs_context` → hỏi lại câu đầy đủ + starter chips (consult không gửi history nên câu kiểu "còn tháng trước?" rơi vào đây)
    - `transaction_like` → `kind: switch_mode, switch_to_recording: true`
    - kind khác → `unsupported`
    - `query` + `coverage ≠ full` → `unsupported` "Mình chưa hiểu hết câu hỏi nên không muốn đoán số…"
    - `query` + có category_ids + `confidence < 0.5` → `kind: clarify_category`, `category_choices` = mọi danh mục cùng loại, `pending_query` = query đã bỏ category_ids
    - còn lại → `AnalyticsService.Answer(query)` (F-AI-7) → `kind: answer`, chips = follow_ups; `confidence < 0.8` → kèm `banner_categories`
14. `ConsultService → DB: InsertIntentParseLog {user_id, raw_text, normalized_text, parsed_intent JSON, method: llm, kind, outcome, confidence, latency_ms, token_in/out/cached}` (best-effort, lỗi không làm hỏng response)
15. `Backend → Mobile: 200 ConsultResponse {kind, message, answer?, banner_categories?, category_choices?, pending_query?, chips, switch_to_recording?}`
16. `MobileUI`: `fromConsult` → `ChatStore.addMessage(reply)` → `ConsultReplyCard`:
    - có `banner_categories` → `CategoryBanner` (nút "Đổi" → tạo local tin `clarify_category`, không gọi HTTP)
    - có answer → dòng kỳ (from–to, partial, tx_count) → `ChartRenderer` → notices
    - `clarify_category` → `CategoryChoiceList` → chọn → F-AI-6 với `pending_query + category_ids: [id]`
    - `switch_to_recording` → nút "Chuyển sang Ghi giao dịch" → `setMode(transaction)`
    - `SuggestionChips` → bấm → F-AI-6

**Nhấn mạnh khi demo:** LLM **chỉ phân loại câu hỏi**; **mọi con số đều do SQL tính**; không có chữ nào do LLM viết đến tay user (summary lấy từ template cố định).

### F-AI-6 Chip / câu hỏi có cấu trúc (không dùng LLM)
1. `User → chip` → `useConsultActions.askQuery(query, label)` → `ChatStore.addMessage(user label)`
2. `Axios → Backend: POST /analytics/query {metric, group_by?, tx_type?, period, from?, to?, category_ids?, wallet_id?, amount_min?, limit?, currency?}`
3. `Backend: JWTAuth` (không rate limit) → `AnalyticsHandler.Query` (validate enum) → `AnalyticsService.Answer` (F-AI-7) → 200
4. `Mobile: fromAnswer → {kind: answer, answer, chips: answer.follow_ups}`; lỗi → chip "Thử lại"

### F-AI-7 `AnalyticsService.Answer` (engine tính số, chỉ đọc)
1. `toAnalyticsQuery` validate chéo:
   - tx_type mặc định expense
   - custom cần from ≤ to, khoảng < 366 ngày
   - breakdown cần group_by; series cần last_3/6_cycles; compare cần this_cycle/last_cycle/this_week/last_30_days; budget_status cần this_cycle và không có wallet
   - amount_min/limit chỉ dùng cho top_n
   - vi phạm → 400 INVALID_INPUT `[{field, rule}]`
2. `DB: GetWalletByID` (kiểm tra quyền sở hữu), `DB: GetCategoryByID` từng danh mục (404/403)
3. `resolveCurrency`
4. `resolveWindows` (theo giờ Asia/Ho_Chi_Minh; `DB: GetActiveCycleStartDay`, luôn = 1 vì chưa có code nào ghi `budget_plans`):
   - `this_cycle` / `last_cycle`: `[ngày bắt đầu kỳ 00:00 giờ VN, ngày đó tháng sau)` đổi sang UTC; kèm kỳ trước để so sánh
   - `last_3/6_cycles`: n kỳ nối nhau
   - `last_30_days`: `[0h ngày mai − 30 ngày, 0h ngày mai)`
   - `this_week`: từ 0h thứ Hai, dài 7 ngày
   - `custom`: `[from, to + 1 ngày)`
5. `compute` theo metric (loại trừ transfer và bản ghi đã xoá mềm):

| metric | SQL | chart.type |
|---|---|---|
| sum | `SumReportTotalsByUser` hoặc `SumReportByCategoryForUser` + `CountTransactionsInWindow` | number |
| compare | sum(kỳ này) + sum(kỳ trước) → change_pct | compare |
| series | sum từng kỳ (1 query/kỳ), bỏ các kỳ 0 ở đầu | bar (line nếu lọc danh mục) |
| breakdown/category | `SumReportByCategoryForUser` → top 6 + "khác" | donut |
| breakdown/wallet | `SumExpenseByWalletForUser` | bar |
| breakdown/weekday | `SumExpenseByLocalDay` (tz VN), gom theo thứ bắt đầu từ thứ Hai | weekday |
| top_n / max_tx | `ListExpensesByAmount` (limit 5 / 1) | table (không trả note) |
| avg_daily | tổng / số ngày có chi | number + items theo ngày |
| budget_status | `BudgetService.ListBudgets` + `SumExpenseByUserCycle` | progress |

6. Thêm notice (loại tiền khác, không có kỳ trước, ít kỳ hơn yêu cầu, khoảng thời gian ngắn)
7. `followUpsFor` → tối đa 3 chip gợi ý tiếp theo
8. Trả `{schema_version: 1, query, period{key, label, from, to, from_date, to_date, partial}, currency, summary (template), chart{...}, notices, follow_ups, tx_count}`

Bảng ánh xạ ở mobile (`ChartRenderer`):

| chart.type | Component |
|---|---|
| number | NumberStat (kèm LineChart nếu ≥3 điểm) |
| donut | DonutAnswer |
| bar, weekday | ColumnBars |
| line | LineChart |
| compare | CompareBars |
| table | RankedList |
| progress | BudgetStatusList |

---

## 7. Flow AI ③: Wizard lập ngân sách

### F-AI-8 Mở wizard
Ba điểm vào: chọn mode "budget", bấm `BudgetWizardCard` (sau khi `/ai/chat` trả `budget_wizard`), hoặc nút trên ChatInputBar → `BudgetWizardModal` (overlay toàn màn hình, 3 bước + màn thành công).
1. `MobileUI → Axios: GET /ai/budget-wizard/prefill` (tốn 1 lượt của `/ai` rate limit)
2. `Backend: BudgetWizardService.Prefill` (không gọi AI, không ghi DB):
   - `DB: ListWalletsByUser` → currency
   - `DB: ListCategoriesForUser`
   - `DB: ListBudgetsByUser + ListBudgetLimitsByBudgetIDs` → existing_budgets
   - trả `{currency, cycle_start_day: 1 (hằng số), default_savings_pct: 10 (hằng số), presets[{key, shares[{system_key, percent}]}], categories, existing_budgets}`
3. `PlanStore` (AsyncStorage) đã có kế hoạch lưu → khôi phục; không thì dùng prefill

### F-AI-9 Bước 1 – Thu nhập (tính local)
- Nhập income, tiết kiệm (% hoặc số tiền), ngày bắt đầu kỳ, chi phí cố định (`FixedCostsModal`, gợi ý tĩnh)
- `disposable = income − fixed − savings`
- Điều kiện qua bước: income > 0, disposable > 0 và disposable ≥ 350.000đ

### F-AI-10 Bước 2 – Chọn hồ sơ → gọi đề xuất
1. `User: chọn preset` (rented_eating_out | with_family | own_family | student | couple_no_kids | retired)
2. `MobileUI: resolvePresetIntents` → ánh xạ `system_key` của preset sang category_id (lỗi: `server_outdated`, `categories_unmigrated`)
3. `Axios → Backend: POST /ai/budget-proposals {income, fixed_total, savings_target, currency, period: monthly, cycle_start_day, profile_preset, intents[{category_id, category_name, system_key, source, amount_min, amount_max, locked}]}`
4. `Backend: BudgetWizardService.Proposals`: với mỗi intent → `DB: GetCategoryByID` (sai chủ → 403); lấy SystemKey/Name từ DB, không tin request
5. `budgetproposal.Compute` (**toán thuần int64 trong Go, KHÔNG dùng AI**):
   1. `disposable = income − fixed − savings` (≤ 0 → lỗi)
   2. `ResolveIntents`: gộp trùng danh mục theo ưu tiên stated > manual > history > preset
   3. `floor` = 50.000đ/danh mục; `cap` = 88% disposable (giữ 12% đệm); cap < floor × n → lỗi "quá ít tiền"
   4. Số trung tâm của mỗi danh mục = amount_max nếu có, không thì `disposable × percent của preset`
   5. Scale-to-fit: tổng locked > cap → `over_committed` + `shortfall`; tổng > cap → co tỉ lệ phần không khoá → `scaled_down`
   6. `reconcile`: trần mỗi mục = 50% disposable; nâng mục dưới sàn lên sàn, lấy bù từ các mục khác; lặp đến khi ổn định
   7. `quantize`: làm tròn bước (<100k → 5k; <1tr → 10k; <10tr → 50k; còn lại 100k), phân phối phần dư lớn nhất
   8. `amount_min` = dải thấp (preset 85%, history 92%; locked/stated/manual thì = max)
   9. `unallocated = disposable − Σ max`
6. `Backend → Mobile: {disposable, proposals[{category_id, category_name, system_key, amount_min, amount_max, source, locked, confidence, evidence}], unallocated_amount, over_committed, shortfall, scaled_down}`

### F-AI-11 Bước 3 – Chỉnh sửa (local)
- Sửa số tiền, thêm dòng (`AddBudgetRowModal` + `findSimilarCategories` so khớp trên máy; tên mới → id tạm `new:<ts>`), xoá dòng → tính lại unallocated
- "Lưu kế hoạch" → `PlanStore` (chỉ AsyncStorage)
- `POST /ai/suggest-category-name {description}` có ở backend (→ AISvc → Groq/Anthropic, tool `suggest_category`, trả `{suggested_name ≤30 ký tự, type, icon emoji}`) nhưng ⚠️ **mobile hiện không gọi**

### F-AI-12 Chốt ngân sách (thay thế toàn bộ)
1. `User: bấm Áp dụng` → nếu đã có ngân sách → dialog xác nhận ghi đè
2. Với mỗi danh mục tạm: `Axios → Backend: POST /categories/ {name, type: expense}` → invalidate `["categories"]`
3. `Axios → Backend: POST /budgets/bulk {budgets: [{category_id, period: monthly, limits: [{currency, amount_limit: amount_max}]}]}`
4. `BudgetHandler.BulkCreateBudgets`: tối đa 20 mục (422 TOO_MANY_BUDGETS), không trùng danh mục (422)
5. `BudgetService.BulkReplaceBudgets`:
   - `[TX BEGIN]`
   - `DB: SELECT users FOR UPDATE` (khoá theo user)
   - `DB: SELECT budgets FOR UPDATE` (các ngân sách đang có)
   - mỗi mục: `DB: LockCategoryByID FOR UPDATE` → kiểm tra tồn tại, chủ sở hữu, loại expense
   - `DB: DeleteBudgetLimitsByBudgetIDs` (ngân sách cũ)
   - `DB: SoftDeleteBudgetsByUser` (xoá mềm **tất cả** ngân sách cũ)
   - mỗi mục: `DB: CreateBudget` + `InsertBudgetLimit` (start_date = now)
   - `[TX COMMIT]`
6. `Backend → Mobile: 201 {created_count}` → invalidate `["budgets"]`, `["report-summary"]`
7. `MobileUI`: màn thành công "mỗi ngày tiêu được X" → `ChatStore.updateMessage(originId, {budgetWizardSubmitted, budgetWizardCreatedCount})` → thẻ chat chuyển sang "Đã lập N ngân sách"
- ⚠️ Ngân sách mới có ID mới → thông báo vượt ngân sách có thể phát lại. `cycle_start_day` người dùng chọn **không được lưu** (không có code ghi `budget_plans`).

---

## 8. Flow giao dịch (lõi tài chính)

### F-TX-1 Tạo giao dịch (thu / chi / chuyển khoản)
Nguồn gọi: form thủ công (`TransactionFormModal` từ Home, tab Giao dịch, chat), xác nhận đề xuất AI, import.
1. `Mobile → Backend: POST /transactions/ {wallet_id, category_id | to_wallet_id, amount (xu), type, occurred_at, note, idempotency_key?}`
2. `TransactionHandler.CreateTransaction → TransactionService.CreateTransaction`
3. Có idempotency_key → `DB: GetTransactionByIdempotencyKey` (theo user) → có rồi → trả 200 bản cũ (replay)
4. `DB: GetWalletByID` → 404 / 403 nếu không phải ví của mình
5. **Nếu là transfer:** to_wallet_id bắt buộc và khác ví nguồn → `DB: GetWalletByID(dest)` → phải cùng loại tiền → `DB: GetSystemCategoryByKey('transfer')` (danh mục "Chuyển khoản")
   **Nếu thu/chi:** `DB: GetCategoryByID` → loại danh mục phải khớp (422 CATEGORY_TYPE_MISMATCH)
6. `[TX BEGIN]`
   - chi / transfer: `DB: DecrementWalletBalanceIfSufficient` (`UPDATE wallets SET balance = balance − $2 WHERE … AND balance >= $2`) → không có dòng nào → 422 INSUFFICIENT_BALANCE (UPDATE có điều kiện chính là khoá chống race)
   - thu: `DB: AdjustWalletBalance(+amount)`
   - transfer: `DB: AdjustWalletBalance(dest, +amount)`
   - `DB: CreateTransaction`
   - `DB: InsertAuditLog {action: create, before: NULL, after: snapshot}`
   - `[TX COMMIT]`
7. Race do trùng idempotency_key (unique violation) → tra lại → trả replay
8. `→ 201 {transaction, wallet_balance mới}`
9. `Mobile: invalidate transactions, wallets, report-summary → checkBudgetLimit → toast 80% / 100%`

### F-TX-2 Sửa giao dịch
`PATCH /transactions/:id {amount?, category_id?, occurred_at?, note?}` (không đổi được type/ví; field lạ bị từ chối)
1. `DB: GetTransactionByID` (quyền sở hữu)
2. transfer không đổi được category
3. `[TX BEGIN]`
   - `delta = số tiền có dấu mới − cũ` → `AdjustWalletBalance(source, delta)` (⚠️ **không chặn số dư âm**) + đảo dấu cho ví đích nếu là transfer
   - `UpdateTransaction` (COALESCE)
   - `InsertAuditLog(update, diff)`
   - `[TX COMMIT]`
4. ⚠️ Bản ghi cũ được đọc ngoài transaction, không khoá → 2 lần sửa đồng thời có thể làm lệch số dư

### F-TX-3 Xoá giao dịch (xoá mềm)
`DELETE /transactions/:id` → `[TX BEGIN]` hoàn tiền ví nguồn (và ví đích nếu transfer) → `SoftDeleteTransaction (deleted_at)` → `InsertAuditLog(delete, before: snapshot)` → `[TX COMMIT]` → trả ví nguồn

### F-TX-4 Danh sách / báo cáo
- `GET /transactions/?wallet_id&category_id(s)&type&from&to&q&limit&cursor` → keyset cursor `(occurred_at, created_at, id)` DESC, base64 JSON, limit mặc định 20 / tối đa 100, `total` chỉ có ở trang đầu → Mobile `useInfiniteQuery`
- `GET /reports/summary` → tổng thu/chi/net theo loại tiền + theo danh mục, bỏ transfer, mặc định từ đầu kỳ đến hiện tại
- ⚠️ `to=YYYY-MM-DD` hiểu là 0h UTC → mất cả ngày cuối, và dùng mốc ngày UTC chứ không phải giờ VN (export thì kéo đến 23:59:59 UTC)

### F-TX-5 Import Excel
1. `Mobile: DocumentPicker → kiểm tra .xlsx, ≤ 5MB`
2. `→ Backend: POST /transactions/import/preview` (multipart field `file`) ⚠️ giới hạn body mặc định của Fiber là 4MB → file 4–5MB bị từ chối
3. `TransactionImportService.PreviewImport`:
   - excelize mở sheet đầu tiên, header bắt buộc `Date, Type, Amount, Category, Wallet`
   - `DB: ListWalletsByUser + ListCategoriesForUser` → tra theo tên
   - mỗi dòng: resolve → `idempotency_key = UUIDv5(sha256(user|wallet|category|amount|type|occurredAt|note))` → `DB: GetTransactionByIdempotencyKey` → phân loại duplicates / valid / errors
   - `TokenService.IssueImportToken`: JWT HS256 purpose `transaction_import`, TTL 5 phút, **chứa toàn bộ dòng hợp lệ**
   - trả `{valid[], duplicates[], errors[], import_token}` (chưa ghi gì)
4. `Mobile: ImportPreviewModal → User bấm xác nhận → POST /transactions/import/commit {import_token}`
5. `CommitImport`: verify token (chữ ký, hạn, purpose; sai → 401; khác user → 403) → **mỗi dòng gọi F-TX-1 riêng** (mỗi dòng một transaction; có thể thành công một phần) → `{imported, skipped, failed, failures[]}`
6. `Mobile: invalidate transactions, wallets, report-summary, budgets, audit-logs`

### F-TX-6 Export Excel
`Mobile → GET /transactions/export?from&to` (responseType arraybuffer; ⚠️ mobile không bao giờ gửi wallet_id) → `DB: ListTransactionsByUser (limit 100k)` → excelize tạo sheet "Transactions" → `Content-Disposition: attachment` → Mobile ghi vào cache của expo-file-system → `Sharing.shareAsync`

---

## 9. Flow nền & phụ trợ

### F-BG-1 Thông báo vượt ngân sách (Scheduler, mỗi 5 phút)
1. `Scheduler (ticker 5m) → NotificationService.EvaluateBudgets`
2. `→ DB: ListDistinctUserIDsWithActiveBudgets`
3. Với mỗi user (lỗi thì log rồi chạy tiếp):
   - `DB: ListBudgetsByUser + ListBudgetLimitsByBudgetIDs`
   - `CycleResolver.Current` (`DB: GetActiveCycleStartDay`) → cửa sổ kỳ hiện tại theo giờ VN
   - `DB: SumExpenseByUserCycle` (chi theo danh mục + loại tiền, mọi ví, bỏ transfer)
   - mỗi limit có `spent > amount_limit` → `DB: CreateBudgetExceededNotification` (`ON CONFLICT (related_budget_id, currency, period_start) DO NOTHING` → mỗi kỳ báo một lần)
4. Chỉ có mức 100%, không có 80% ở server; ⚠️ nội dung tiếng Anh ("Budget exceeded: …"); không có push notification
5. Mobile: `TopBar → GET /notifications/?is_read=false` (chấm đỏ); màn Thông báo → bấm → `POST /notifications/{id}/read` → chuyển sang Insights. **Không polling**, chỉ tải lại khi mount / hết stale / kéo để làm mới.

### F-BG-2 Dọn log câu hỏi AI (lúc start + mỗi 24h)
`IntentLogRetention.Purge → DB: ClearExpiredIntentLogRawText (> 30 ngày → raw_text = NULL) → DeleteExpiredIntentLogs (> 365 ngày)`

### F-MISC-1 Upload icon (category / wallet / budget)
1. `Mobile → Backend: POST /{categories|wallets|budgets}/icon` (multipart `file`)
2. `Handler`: ≤ 2 MiB, content-type khai báo ∈ {png, jpeg, svg+xml} (⚠️ không kiểm tra byte thật; SVG có thể chứa script)
3. `R2IconUploader → R2 (S3 PutObject)`: key `{prefix}-icons/{uuid}-{tên file đã làm sạch}`, chỉ set ContentType (⚠️ không set Cache-Control)
4. `→ 200 {icon_url: R2_PUBLIC_BASE_URL/key}` (chưa ghi DB; client gửi `icon_url` trong lệnh create/PATCH sau đó)
5. R2 chưa cấu hình → 503 ICON_UPLOAD_UNAVAILABLE; lỗi upload → 502
6. `Mobile → R2 public URL`: tải ảnh qua `expo-image` (memory-disk cache)

### F-MISC-2 Ví & danh mục (CRUD)
- Ví: ví đầu tiên tự thành mặc định; đổi mặc định = một transaction (bỏ cũ, đặt mới, partial unique index); đã có giao dịch thì không đổi được loại tiền (409 CURRENCY_LOCKED); **không có xoá ví**
- Danh mục: hệ thống (`user_id` NULL, chỉ đọc, có `system_key`) + của user; tên unique theo (owner, lower(name), type); xoá mềm trong transaction có `SELECT FOR UPDATE`; đang có ngân sách dùng → 409 CATEGORY_IN_USE

---

## 10. Tổng hợp giao tiếp giữa các service (cho component/interaction diagram)

| Từ | Đến | Giao thức | Endpoint / thao tác | Auth | Timeout / Retry |
|---|---|---|---|---|---|
| Mobile | Backend (qua CF) | HTTPS REST JSON | `/api/v1/*` | Bearer JWT HS256 | 15s; TanStack retry 3; một lần refresh-retry khi 401 |
| Browser (email link) | Backend | HTTPS | `GET /activate`, `POST /api/v1/auth/activate` | invite token | — |
| Backend | Postgres | pgx pool TCP | sqlc queries | user/pass, sslmode=disable | — |
| Backend | AISvc | HTTP nội bộ Docker | `POST /extract` | **không có** | 15s, không retry |
| Backend | AISvc | HTTP | `POST /suggest-category-name` | không | 15s |
| Backend | AISvc | HTTP | `POST /consult` | không | 8s |
| AISvc | Groq | HTTPS SDK | chat.completions + tool calling | GROQ_API_KEY | extract: SDK retry 2 lần, timeout mặc định; consult: 0 retry, 7s |
| AISvc | Anthropic | HTTPS SDK | messages + tool_use | ANTHROPIC_API_KEY ⚠️ để trống | mặc định SDK |
| Backend | R2 | HTTPS S3 API | PutObject | access key / secret | — |
| Backend | SMTP | SMTP STARTTLS 587 | gửi mail mời | Gmail app password | 10s, goroutine |
| Mobile | R2 public / jsDelivr | HTTPS GET | ảnh | public | expo-image cache |
| GitHub Actions | DockerHub | HTTPS | push image | DOCKERHUB_TOKEN | — |
| GitHub Actions | VPS | SCP + SSH :22 | deploy.sh | VPS_SSH_KEY | health check 20 × 10s |

**Dữ liệu gửi sang LLM bên thứ ba** (vẽ ranh giới privacy): text user gõ, tối đa 10 lượt chat trước (extract), tên ví, tên danh mục (kể cả tên user tự đặt), UUID nội bộ, ngày hiện tại. **Không gửi** số dư, lịch sử giao dịch, số tiền trong DB. Backend lưu raw câu hỏi consult trong `intent_parse_log` 30 ngày.

---

## 11. Mô hình dữ liệu (ER diagram)

- `users` (id, email, full_name, password_hash, status pending|active|disabled, role admin|member, invited_by → users, invite_token, invite_expires_at, activated_at, created_at, updated_at, deleted_at)
- `revoked_tokens` (jti PK, user_id → users, expires_at) — không bao giờ được dọn
- `wallets` (id, user_id → users, name, type cash|bank|e_wallet|other, balance BIGINT xu, currency VND|USD, is_default [partial unique 1/user], icon, icon_url, timestamps, deleted_at)
- `categories` (id, user_id NULL = hệ thống → users, name, icon, icon_url, type income|expense|transfer, system_key, created_at, deleted_at) — unique (owner, lower(name), type)
- `budgets` (id, user_id, category_id → categories, period monthly, start_date, icon, icon_url, timestamps, deleted_at) — partial unique 1 active/category
- `budget_limits` (budget_id → budgets, currency, amount_limit BIGINT > 0)
- `budget_plans`, `budget_plan_items` (cycle_start_day…) — chỉ được backfill bởi migration 020, code không ghi
- `transactions` (id, user_id, wallet_id → wallets, to_wallet_id → wallets NULL, category_id → categories, amount BIGINT > 0, type income|expense|transfer, note, occurred_at, idempotency_key [unique theo user], timestamps, deleted_at) — CHECK: transfer ⇔ có to_wallet_id
- `transaction_audit_logs` (id, transaction_id, user_id, action create|update|delete, before JSONB, after JSONB, created_at) — chỉ thêm, không sửa
- `notifications` (id, user_id, type budget_exceeded, title, body, is_read, related_budget_id, currency, period_start, created_at) — unique dedupe (related_budget_id, currency, period_start)
- `chat_messages` (id, user_id, conversation_id, role user|assistant, content, intent, transaction_ids NULL, created_at) — history cho AI
- `chat_thread_messages` (id, user_id, client_message_id [unique theo user], payload TEXT JSON, created_at, updated_at) — bản sao thread của mobile
- `intent_parse_log` (id, user_id, raw_text, normalized_text, parsed_intent JSONB, method, kind, outcome, confidence, latency_ms, token_in/out/cached, created_at)
- `schema_migrations` (ledger của cmd/migrate, có checksum)

Quan hệ chính: users 1–n wallets / categories / budgets / transactions / notifications / chat_*; budgets n–1 categories; budgets 1–n budget_limits; transactions n–1 wallets (nguồn) và n–1 wallets (đích, nếu transfer); transactions n–1 categories; transactions 1–n audit_logs.

---

## 12. Danh sách ⚠️ để tô đỏ trên sơ đồ (theo mức độ)

1. 🔴 `/auth/refresh` không verify chữ ký refresh token → giả mạo phiên của bất kỳ user nào
2. 🔴 Không có backup Postgres
3. 🔴 Docker bỏ qua UFW → port 80 có thể lộ trực tiếp, không chỉ qua Cloudflare
4. 🔴 Cloudflare → origin đi HTTP thuần (suy luận Flexible SSL)
5. 🔴 `add-ssh-key.yml` nhúng input thẳng vào script → chèn lệnh
6. 🟠 Rate limit `/ai` 30/giờ dùng chung cho chat + sync thread + wizard
7. 🟠 Login rate limit theo IP của Cloudflare (thiếu ProxyHeader `CF-Connecting-IP`)
8. 🟠 Không có recover middleware; không có access log; không giới hạn dung lượng log Docker
9. 🟠 Migrate chạy sau `up -d`; rollback không lùi migration; hai workflow deploy có thể chạy chồng nhau
10. 🟠 `now` gửi cho AI là UTC → sai ngày trong khoảng 0h–7h giờ VN
11. 🟠 Chỉ có một nhà cung cấp LLM (Anthropic chưa cấu hình, model dự phòng đã cũ); `/extract` block event loop
12. 🟡 History chat không lọc `user_id`; mobile không gửi conversation_id (AI không thấy lịch sử); chỉ lấy action đầu tiên
13. 🟡 Mỗi lần refresh token xoá sạch cache TanStack Query
14. 🟡 Bộ lọc `to` mất ngày cuối; mốc ngày theo UTC
15. 🟡 `/budgets/bulk` thay thế toàn bộ; `cycle_start_day` không được lưu
16. 🟡 Thông báo tiếng Anh, không có mức 80%, không push, không polling
17. 🟡 Container chạy root; Trivy không chặn deploy; không có staging; ai-service/mobile không có CI
18. 🟡 Không set Cache-Control cho icon R2; có thể đang dùng `r2.dev` (bị giới hạn tốc độ)
