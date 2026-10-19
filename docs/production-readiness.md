# PFM — Những gì còn thiếu để production-ready

> Tổng hợp ngày 2026-10-05, đối chiếu **SRS.md, SDS.md, toàn bộ `docs/`, 24 thư mục `specs/`** với code thực tế
> (`backend/`, `ai-service/`, `mobile/`, workflows, compose). Client chính là `mobile/`; `frontend/` (web) đã đóng băng
> nên không tính là việc cần làm.
>
> **Ưu tiên:** P0 = chặn production / rủi ro mất dữ liệu–bảo mật · P1 = cần trước khi mở cho người dùng thật ·
> P2 = feature theo roadmap / nâng chất lượng.
> **Công sức:** S ≤ nửa ngày · M 1–3 ngày · L > 3 ngày.

---

## 1. Tóm tắt

- **Feature MVP gần như đủ.** F-01→F-07, F-10, F-13 (wizard v2), F-14 (offline), chuyển tài khoản / đăng xuất mọi
  thiết bị đều đã chạy trên mobile + backend.
- **Feature còn thiếu hẳn:** F-08 Mục tiêu tài chính (Release 1), F-09 Đầu tư (Release 2), sửa giao dịch qua chat
  `sửa@` (F-12 US-02, ghi [MVP]), ghi giao dịch từ ảnh/OCR (F-12 US-05 — mới có spec + plan, **chưa có code** dù
  commit `7cac897` ghi "OCR"), quên mật khẩu, khoá/vô hiệu hoá user. (Sửa hồ sơ đã có; đổi mật khẩu, danh sách thiết bị
  đang đăng nhập và khóa ứng dụng thêm ngày 2026-10-19.)
- **Production-readiness là điểm yếu chính:** không crash reporting, không metrics/alert, không timeout HTTP phía
  server, health check không chạm DB, mobile không có test, ai-service test không chạy trong CI, fallback AI thực tế
  không hoạt động, origin mặc định mở HTTP công khai, debug bubble bật sẵn trong mọi bản build.

---

## 2. Feature theo SRS chưa có hoặc làm dở

| # | Feature / US | Trạng thái | Còn thiếu | Ưu tiên | Công sức |
|---|---|---|---|---|---|
| F-01 US-01 | Đăng ký | Thay bằng invite-only (đúng CLAUDE.md) | Chốt lại SRS: bỏ self-register hoặc ghi rõ là invite | P2 (docs) | S |
| F-01 US-02 | Cập nhật hồ sơ | **Xong.** Hồ sơ: `PATCH /users/me` + màn sửa hồ sơ. Đổi mật khẩu (2026-10-19): `PUT /users/me/password` + màn "Đổi mật khẩu", thu hồi mọi session (`specs/mobile-account-switch` US-11) | Chạy checklist trên máy | — | — |
| F-01 (spec OQ3) | Vô hiệu hoá user | **Thiếu** | `POST /admin/users/:id/disable` (+ revoke-all session sẵn có), UI admin | P1 | S–M |
| F-02 | Quên / đặt lại mật khẩu | **Thiếu** (vẫn thiếu 2026-10-19; mất máy thì có: đăng xuất từng thiết bị, đăng xuất mọi thiết bị, đổi mật khẩu) | Token reset (crypto/rand, hết hạn), email qua SMTP sẵn có, màn mobile | **P0** | M |
| F-03 | Xoá / lưu trữ ví | **Thiếu** (spec OQ6) | Soft-delete/archive ví, chặn khi còn số dư hoặc giao dịch | P2 | M |
| F-06 | Giao dịch định kỳ | **Thiếu** (SDS §11) | Bảng recurring + job sinh giao dịch | P2 | L |
| F-06 | Nhập Excel trên mobile | Backend xong, **nút bị comment** | Bật lại pill tại `TransactionsHeader.tsx:203-209`, test trên máy | P1 | S |
| F-07 US-02 | Báo cáo thu nhập | Dở | Breakdown thu nhập theo danh mục (SpendingTab chỉ có chi) | P2 | S–M |
| F-07 US-05 | Lọc báo cáo theo ví | Dở | Backend có `wallet_id`; mobile chưa có bộ lọc ví | P2 | S |
| **F-08** | **Mục tiêu tài chính** (US-01→05) | **Thiếu hẳn** | Spec → migration `goals` → CRUD → góp tiền/tiến độ → màn mobile. Có thể tái dùng logic `consult_scenario.go` | P1 (Release 1) | L |
| **F-09** | **Danh mục đầu tư** (US-01→05) | **Thiếu hẳn** | Spec + toàn bộ stack | P2 (Release 2) | L |
| F-10 | Thông báo | Chỉ in-app, chỉ `budget_exceeded` | Push (expo-notifications + bảng push token), cảnh báo theo %, mark-all-read, **tiêu đề còn tiếng Anh** (`notification_service.go:123`) | P1 | M–L |
| F-11 | Dashboard | Có Home, chưa có spec | Widget tiến độ mục tiêu (phụ thuộc F-08) | P2 | S |
| F-12 US-02 | Sửa giao dịch qua chat `sửa@` | **Thiếu** | Intent `edit_transaction`, tìm giao dịch khớp, chọn 1 trong N, "Không tìm thấy…" | P1 (ghi MVP) | L |
| F-12 US-04 | Tư vấn / đánh giá | Dở | Đã có: kịch bản mục tiêu tiết kiệm. Còn thiếu: `evaluate` (EvaluationFacts + ProseValidator), kịch bản cắt giảm S1/S4 (cần `categories.cut_class`) — `docs/new-tasks.md` P5/P6 | P2 | L |
| F-12 US-05 | Ghi giao dịch từ ảnh | **Chưa code** (spec + plan có) | Vision call ở ai-service, upload ảnh, nút đính kèm trong chat, giới hạn 10 ảnh/giờ, 20 dòng | P1 (Release 1) | L |
| F-13.1 US-04 | Version kế hoạch ngân sách | **Thiếu** | Không có chỗ nào ghi `budget_plans` → `cycle_start_day` luôn = 1 | P2 | M |
| F-13.1 US-09 | `budget_impact` khi tạo giao dịch | **Thiếu** | Trả mức ảnh hưởng ngân sách ngay lúc chi | P2 | M |
| F-05 | `budgets.start_date` | Ghi nhưng không dùng | Hoặc dùng để giới hạn kỳ, hoặc bỏ cột | P2 | S |
| F-05 | Chu kỳ weekly/quarterly | Bulk DTO vẫn chấp nhận | Siết `dto/budget_bulk_request.go:21` về `monthly` | P1 | S |

---

## 3. Production readiness theo từng mảng

### 3.1 Bảo mật

| Việc | Hiện trạng | Ưu tiên | Công sức |
|---|---|---|---|
| Origin chỉ nhận traffic qua Cloudflare Tunnel | `BACKEND_BIND_ADDRESS` mặc định `0.0.0.0`, HTTP cổng 80 công khai; Docker vượt UFW. Bật tunnel + bind `127.0.0.1` + xoá DNS A record (runbook §3) | **P0** | S |
| Lỗ command injection trong `add-ssh-key.yml:31-32` | `${{ github.event.inputs.public_key }}` chèn thẳng vào shell → chuyển qua `env:` | **P0** | S |
| Debug bubble bật mặc định | `ui-prefs-store.ts:38` `debugBubbleVisible: true` → tắt ở bản release (theo `__DEV__` hoặc build flag) | **P0** | S |
| JWT secret không kiểm tra độ dài | `config.go` chỉ check có/không → bắt buộc ≥ 32 byte | P1 | S |
| Upload icon tin `Content-Type`, cho phép SVG | `common/constants.go:95-102` → sniff magic bytes, bỏ SVG | P1 | S |
| `/auth/refresh` không rate limit | Thêm limiter. Từ 2026-10-19 chuyển tài khoản trên mobile cũng đi qua `/auth/refresh` (giới hạn của `/auth/switch` chỉ còn cho bản app cũ) | P1 | S |
| `revoked_tokens` không bao giờ dọn | Job purge token đã hết hạn | P2 | S |
| Container chạy root | Thêm `USER` non-root trong 2 Dockerfile | P2 | S |
| Trivy không chặn deploy | `exit-code: "0"` → `1` cho CRITICAL | P2 | S |
| Dữ liệu offline không mã hoá | Cache + outbox nằm trong AsyncStorage dạng thô (spec chấp nhận) | P2 | M |
| Đồng ý gửi dữ liệu cho LLM bên thứ ba | Chưa có màn đồng ý / chính sách quyền riêng tư | P1 | S |

### 3.2 Backend runtime

| Việc | Hiện trạng | Ưu tiên | Công sức |
|---|---|---|---|
| Timeout HTTP phía server | `fiber.New` (`main.go:112`) không set Read/Write/IdleTimeout | **P0** | S |
| Health check chạm DB | `/health` (`routes.go:27`) không ping DB → thêm `/health/ready` có `pool.Ping` | **P0** | S |
| Ping DB khi khởi động + cấu hình pool | `pgxpool.New` mặc định, lỗi DB chỉ lộ khi có request | P1 | S |
| `BodyLimit` | Mặc định 4 MB, mobile cho import 5 MB → đồng bộ hai bên | P1 | S |
| Rate limiter in-memory | Reset khi restart, chỉ đúng với 1 instance — chấp nhận được hiện tại, ghi lại giới hạn | P2 | — |
| `/ai` limiter dùng chung | Thread sync + wizard prefill ăn quota tạo giao dịch (30/h) → tách bucket | P1 | S |
| "Hôm nay" của AI tính theo UTC | `chat_service.go:86`, `prompt_builder.py:32` → 0h–7h giờ VN bị hiểu là hôm qua | **P0** (sai dữ liệu) | S |
| `PATCH /transactions` không lock, không check số dư âm | Theo `system-flows-for-diagram.md:545` — **cần kiểm tra lại** | P1 | S–M |
| Filter `to=` mất ngày cuối | Theo `system-flows-for-diagram.md:557` — **cần kiểm tra lại** | P1 | S |
| Email invite gửi lỗi không retry | Chỉ log; thêm retry đơn giản hoặc nút gửi lại (đã có resend) | P2 | S |

### 3.3 AI service

| Việc | Hiện trạng | Ưu tiên | Công sức |
|---|---|---|---|
| Fallback Anthropic thực tế không hoạt động | Prod không có `ANTHROPIC_API_KEY`; model `claude-3-5-haiku-20241022` đã cũ → cấp key, đổi sang `claude-haiku-4-5` | **P0** | S |
| Timeout Groq/Anthropic client chính | SDK mặc định ~60 s + 2 retry, backend đã bỏ sau 15 s → set timeout ≈ 12 s, `max_retries=0/1` | P1 | S |
| Gọi SDK đồng bộ trong `async def` | `/extract`, `/suggest-category-name` chặn event loop → dùng async client hoặc `def` thường | P1 | S |
| Dung lượng Groq free tier | Giới hạn 8k TPM dùng chung cả org (≈4 câu consult/phút) → quyết định: org riêng / trả phí / chấp nhận | P1 (quyết định) | — |
| Không có trần chi phí ngày/tháng | Chỉ có token budget theo phút cho consult | P2 | M |
| Mobile không gửi `conversation_id` | AI không thấy lịch sử chat (`ai-chat/types.ts:7`) | P2 | S |

### 3.4 Hạ tầng, deploy, dữ liệu

| Việc | Hiện trạng | Ưu tiên | Công sức |
|---|---|---|---|
| Backup DB thực sự chạy + thử restore | Script có (`ops/backup-postgres.sh`), chỉ cài khi set `BACKUP_R2_BUCKET`; **chưa từng test restore** | **P0** | S |
| Log archive phụ thuộc biến backup | `deploy.sh:141-145`: thiếu bucket → log archive cũng không được cài | P1 | S |
| Không có staging | Push `develop` = deploy prod | P1 | M |
| Hai workflow deploy có thể chạy chồng | Cùng `deploy.sh`, khác concurrency group → dùng chung group | P1 | S |
| ai-service không rollback khi health fail | Backend có `.last_good_tag`, ai-service thì không | P1 | S |
| Rollback không lùi migration | Viết quy ước migration chỉ thêm (expand/contract) | P2 | S |
| Dev compose thiếu migration 022–026 | Volume dev mới bị sai schema → chạy `cmd/migrate` thay vì mount initdb | P1 | S |
| `.env.example` lệch thực tế | Thiếu `R2_*`, `AI_SERVICE_URL`, `BACKUP_*`, tunnel | P2 | S |
| Rác trong repo | 13 file `__pycache__/*.pyc` đang được track; `mobile/pfm/` thừa (51 file) | P2 | S |

### 3.5 Mobile release

| Việc | Hiện trạng | Ưu tiên | Công sức |
|---|---|---|---|
| Crash reporting | Không có Sentry/Crashlytics | **P0** | S–M |
| React ErrorBoundary | Không có ở đâu trong `app/` hay `src/` | **P0** | S |
| OTA update | Chưa có `expo-updates` / `runtimeVersion` | P1 | S–M |
| Push notification | Chưa có `expo-notifications` (gắn với F-10) | P1 | M |
| Version / build number | `app.json` 1.0.0, không có `versionCode`/`buildNumber`; thiếu `ios.bundleIdentifier` | P1 | S |
| Signing bản release local | `android/app/build.gradle` ký bằng `debug.keystore` (bản EAS thì ổn) | P1 | S |
| `userInterfaceStyle: "dark"` cứng | Trong khi đã có light theme | P2 | S |
| `EXPO_PUBLIC_API_BASE_URL` rỗng ở release | `lib/config.ts` fallback chuỗi rỗng không báo lỗi → fail sớm | P1 | S |
| `FALLBACK_CURRENCY` lặp ở 11 file | Gom về `lib/constants.ts` | P2 | S |
| File > 300 dòng (vi phạm rule) | `use-budget-wizard-state.ts` 399, `FixedCostsModal.tsx` 375, `DonutChart.tsx` 316, `HomeSnapshotCard.tsx` 301 | P2 | M |
| Checklist test trên máy thật | UX batch 2026-10, wizard v2 I-5 vẫn chờ | P1 | S |

### 3.6 Observability

| Việc | Hiện trạng | Ưu tiên | Công sức |
|---|---|---|---|
| Uptime monitor + alert | Không có → UptimeRobot/Better Stack trỏ vào `/health/ready` | **P0** | S |
| Access log + request ID | Không có middleware nào ngoài Recover + CORS | P1 | S |
| Alert khi backup lỗi | Hiện chỉ ghi syslog `pfm-backup` | P1 | S |
| Metrics (Prometheus/OTel) | Không có | P2 | M |
| Product metrics (SDS §10) | Không có | P2 | M |

### 3.7 Test & CI

| Việc | Hiện trạng | Ưu tiên | Công sức |
|---|---|---|---|
| ai-service test trong CI | 20 pytest không chạy ở đâu cả | **P0** | S |
| Mobile: lint + `tsc` trong CI | Không có CI cho mobile | P1 | S |
| Test repository với Postgres thật | ~260 test backend đều dùng fake; không bắt được lệch schema | P1 | M |
| Test handler | Không có | P2 | M |
| Unit test mobile (jest) cho logic thuần | 0 test (budget-math, outbox, redact, currency…) | P2 | M |
| E2E (Maestro) cho luồng chính | Không có | P2 | L |
| `test_cases.md` | Chỉ `security/`, `user-management/` có | P2 | M |

---

## 4. Tài liệu lệch với code

Tài liệu không chặn production nhưng đang **sai** — agent và người đọc sau sẽ bị dẫn lạc:

- **`CLAUDE.md`** vẫn gọi `api-spec/openapi.yaml` là source of truth (dòng 33-34, 142) — thư mục này không tồn tại.
- **`docs/open-ai.md`** là bản nháp OpenAPI cũ, sai nhiều chỗ (`ewallet`, 402 thay vì 422, thiếu ~20 route) → xoá
  hoặc sinh lại.
- **`docs/features.md`, `architecture.md`, `tech_stacks.md`** dừng ở 2026-09-13 (migration tới 018, chưa có
  analytics, account-switch, offline, location) → chạy `/renew-features`, `/renew-docs`.
- **`SDS.md`** §4.3.1 tech stack là của đồ án cũ (Flet/PyQt6, DRF/SQLite); §4.1 ghi "không có hệ thống ngoài";
  icon ví/ngân sách ghi "planned"; dùng `PUT` thay vì `PATCH`.
- **`SRS.md`** FR-01/FR-04 ghi icon "chưa làm" (đã làm); F-01 US-01 mô tả self-register trái với invite-only.
- **`CURRENT_STATE.md`** thiếu migration 025–026 và các route switch/revoke-all.
- **Plan trong `specs/`** còn ghi "Not started" cho việc đã ship (security, user-management).
- **Skill nội bộ:** `.claude/skills/agents/qc.md` còn mô tả Flutter; `cook-plan.md`, `cook-implementation.md` còn
  ghi mobile "chỉ có scaffold".
- **`README.md`** chưa có phần giới thiệu dự án / cách chạy.

---

## 5. Lộ trình đề xuất

**Đợt 1 — Chặn production, rẻ (≈ 2–3 ngày).** Toàn bộ mục **P0** công sức S:
bind origin qua tunnel · sửa `add-ssh-key.yml` · tắt debug bubble ở release · server timeouts · `/health/ready` ·
"hôm nay" theo giờ VN trong prompt AI · cấp key + đổi model fallback Anthropic · bật backup + **test restore** ·
uptime monitor · pytest ai-service vào CI · ErrorBoundary + Sentry.

**Đợt 2 — Trước khi mời người dùng thật (≈ 1–2 tuần).**
Quên mật khẩu · vô hiệu hoá user · màn đồng ý dữ liệu AI · siết weekly/quarterly · bật lại nhập Excel ·
tách bucket rate limit `/ai` · timeout client AI · access log + request ID · staging · version/build number ·
OTA update · Việt hoá tiêu đề thông báo · test repo với Postgres thật · kiểm tra lại 2 lỗi PATCH / filter `to=`.

**Đợt 3 — Feature Release 1 (vài tuần).**
F-08 Mục tiêu tài chính (+ widget Dashboard) · F-12 US-05 ghi giao dịch từ ảnh · F-12 US-02 sửa qua chat ·
push notification + cảnh báo ngân sách theo % · cập nhật toàn bộ docs (mục 4).

**Đợt 4 — Release 2 / nâng cao.**
F-09 Đầu tư · giao dịch định kỳ · evaluate + kịch bản cắt giảm (`cut_class`) · version kế hoạch ngân sách +
`budget_impact` · xoá/lưu trữ ví · metrics · E2E · mã hoá dữ liệu offline.

---

## 6. Quyết định cần chủ dự án chốt

1. **Groq capacity:** org riêng cho prod, lên gói trả phí, hay chấp nhận ~4 câu consult/phút toàn hệ thống?
2. **Self-register:** giữ invite-only vĩnh viễn (sửa SRS) hay mở đăng ký?
3. **Phạm vi F-08:** mục tiêu có gắn với ví thật (trích tiền) hay chỉ theo dõi tiến độ?
4. **Push:** Firebase một project hay tách dev/prod (features.md OQ-14/15), có giới hạn số push/ngày không?
5. **Phân phối app:** vẫn chỉ APK/IPA nội bộ, hay chuẩn bị lên store (ảnh hưởng signing, privacy policy, submit
   config)?
6. **Múi giờ:** cố định `Asia/Ho_Chi_Minh` hay theo từng user (FEAT-TZ)?
