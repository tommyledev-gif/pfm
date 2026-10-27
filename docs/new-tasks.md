# PFM — Active Work Backlog

**Cập nhật:** 2026-09-26
**Nguồn:** gộp từ `new-tasks.md` (F-13.1 status report) + `new-tasks2.md` (F-14 spec v1), sau khi audit trực tiếp codebase.

Tài liệu này gồm **2 phần**:

| Phần | Nội dung | Trạng thái |
|---|---|---|
| **I** | F-13.1 Budget Wizard v2 — nợ còn lại | 5/6 mục mở; **I-1 chặn Phần II** |
| **II** | F-14 Ask AI — Analytics, Scenario & Evaluation | Draft v2, blocked bởi Phần I |

> ⚠️ **Đây là tài liệu brief, KHÔNG phải `spec.md` hay `plan.md`.**
> Nó là input cho `/cook-ba`. Xem **§II.23** để biết phần nào đi vào spec, phần nào đi vào plan, phần nào phải bỏ.

---

# PHẦN I — F-13.1 Budget Wizard v2: nợ còn lại

Spec gốc: `specs/ai-budget-wizard-v2/spec.md` + `plan.md` (đã tồn tại).

## I.1 Đã xong — verify được trên code

| Mục | Bằng chứng |
|---|---|
| Tách segment (4 component) | `mobile/src/components/shared/DonutChart.tsx`, `SegmentedBar.tsx`, `mobile/src/features/budgets/components/BudgetProgressBar.tsx`, `mobile/src/features/budget-wizard/components/WizardProgressHeader.tsx` |
| Slider + modal chỉnh | `mobile/src/components/ui/MoneySlider.tsx`, `features/budget-wizard/components/MoneyField.tsx`, `EditAmountModal.tsx` |
| Migration 019 + 020 | `backend/db/migrations/019_categories_system_key.sql`, `020_budget_plans.sql` — mount ở cả 2 compose |
| Engine int64 deterministic | `budgetproposal/compute_test.go:176` fuzz 10.000 case, `:119` determinism ×1.000 |
| Mockup #1 tràn int64 | `common/money.go:41` — `bits.Mul64` / `bits.Div64` |
| Mockup #5 ngưỡng 350k | `common/budget_wizard_v2.go:54` — `BudgetWizardMinViableDisposableXu = 35_000_000` |
| Mockup #6 `effective_from` | có trong `020_budget_plans.sql` |
| US-01, US-02, US-05→US-08 | `system_key` xuyên suốt mig 019 → `categories.sql.go` → `budgetproposal/classify.go` |

## I.2 Còn mở — 5 mục

| # | Mục | US | Bằng chứng còn mở | Chặn F-14? |
|---|---|---|---|---|
| **I-1** | **Cycle window + `AppTimezone`** | US-03 | `backend/db/queries/transactions.sql:217` vẫn `date_trunc('month', NOW())` (UTC, tháng dương lịch). `common.AppTimezone` khai ở `budget_wizard_v2.go:83` nhưng **0 file import**. Không có `SumExpenseByUserCycle`. `cycle_start_day` user chọn được, client tính đ/ngày theo nó, **backend bỏ qua** | 🔴 **CÓ — blocking** |
| **I-2** | **Plan versioning chưa có đường ghi** | US-04 | `budget_plans` chỉ xuất hiện ở đúng 1 file: `020_budget_plans.sql`. Không query nào trong `backend/db/queries/`, không dòng Go nào. `budget_service_bulk.go:38` `BulkReplaceBudgets(ctx, userID, items []dto.BulkBudgetItem)` — không nhận plan, không có `writePlanVersion`. → Chạy wizard xong có budget nhưng **không sinh plan row**; Phase 2 không có gì để đối chiếu | Không |
| **I-3** | **US-09 moment-of-spend** | US-09 | `grep budget_impact` toàn repo = **0 hit**. `mobile/.../TransactionActionCard.tsx:84-93` có bar nhưng vẽ **trước** khi confirm, tính client-side. DoD (`spec.md:462`) yêu cầu `POST /transactions` **trả về** `budget_impact` + `daily_remaining_total`, `remaining_today` làm tròn 1.000đ, render **sau** khi ghi | Không — nhưng F-14 **không được copy pattern client-side này** |
| **I-4** | **Race submit lần đầu** | — | `backend/db/queries/budgets.sql:96-99` `FOR UPDATE` trên `WHERE user_id=$1 AND deleted_at IS NULL` → user chưa có budget nào thì **khoá 0 dòng**, 2 request đồng thời cùng insert | Không — nên fix cùng P1 |
| **I-5** | **Chưa test trên máy thật** | — | Không có emulator trong các session trước | Không |

## I.3 Thứ tự đóng nợ

```
I-1 (US-03)  ← BẮT BUỘC TRƯỚC F-14. Gồm:
   1. CycleWindow(userID, offset) (from, to time.Time)   — helper dùng chung
   2. SumExpenseByUserCycle                              — thay date_trunc('month', NOW())
   3. common.AppTimezone được import thật
   4. Budget list + wizard + (sau này) analytics đều đi qua helper này

I-4          ← fix chung commit với I-1 (cùng đụng budgets.sql)
I-2, I-3     ← độc lập, làm sau
I-5          ← b tự test
```

---

# PHẦN II — F-14: Ask AI — Analytics, Scenario & Evaluation

**Version:** 2 (revised after codebase audit)
**Status:** Blocked — chờ **Phần I mục I-1 (F-13.1 US-03)**
**Depends on:** F-06 Transaction, F-05 Budget, F-12 AI Chat, **F-13.1 US-03**
**Target:** Release 1
**Revised:** 2026-09-26

> 🔴 **Tên "F-14" là tạm, KHÔNG đưa vào SRS.**
> `SRS.md` §6 đã có `Feature-12: AI Chat Assistant` với **US-03 Query Spending via Chat [MVP]** (2 scenario của nó đúng là Q1 + Q4 bên dưới) và **US-04 General Financial Advice [Post-MVP]** (= nhóm E).
> Chỉ nhóm **S (Scenario)** là mới → thêm `US-05` vào Feature-12.
> Chi tiết: **§23.2 mục 2**.

---

## II.0 Changelog v1 → v2

Spec v1 viết từ giả định về codebase, không phải từ code thật. 8 lỗi fact + 6 mục thiếu đã sửa:

| # | v1 sai | v2 |
|---|---|---|
| ① | thêm `categories.is_fixed` (2 mức) | dùng `cut_class` **3 mức**, default từ `ClassForSystemKey` (§9.1) |
| ② | thêm idx `(user_id, occurred_at)` | **đã có** ở migration 016 — bỏ (§9.2) |
| ③ | `chat_messages.chart_payload` | sai bảng — vào `chat_thread_messages.payload`, **0 migration** (§9.3) |
| ④ | "note từ SePay/MacroDroid" | **không tồn tại trong repo** — lý do thật: self-injection + PII (§12.2) |
| ⑤ | "create-TX luôn chạy" | `AIChatRateLimiter` 30/giờ áp cả group `/ai` → phải tách `/ai/consult` (§10.2, §13) |
| ⑥ | `internal/model/ai_intent.go` | wire shape → `internal/dto/`, đổi tên tránh đụng `ChatIntent*` (§10.1) |
| ⑦ | `/analytics/query` viết từ 0 | **`/reports/summary` đã cover Q1/Q2/Q4/Q10** — build trên `ReportService` (§10.3) |
| ⑧ | "Groq cached token không tính TPM" như sự thật | **giả định load-bearing chưa verify** — P0 task đầu tiên (§1.3) |

Bổ sung: §5.1 normalize là build mới (không có gì để "dùng chung"), §11.5 cycle window, §17.2 kế hoạch tách file, §22 dependency với Phần I, §23 mapping sang quy trình cook.

---

## II.1 Mô hình chi phí — 3 tầng

### 1.1 Tầng

| Tầng | Input → Output | LLM? | Token |
|---|---|---|---|
| **T1 · Parse** | text → `AnalyticsIntent` | Có, trừ chip/drill-down/regex full-match | ~180 (nếu §1.3 đúng) |
| **T2 · Execute** | intent → facts | **Không bao giờ** | 0 |
| **T3 · Render** | facts → UI | Không (template) / Có (Evaluate prose) | 0 hoặc ~2.500 |

Không có khái niệm "câu hỏi 0 token" — chỉ có tầng nào tốn.

### 1.2 Vì sao regex-first

> **Justify bằng LATENCY (~50ms vs ~800ms) và DETERMINISM. KHÔNG phải token.**

Parse rẻ hơn Evaluate ~13 lần. Agent không được dùng lý do tiết kiệm token để push regex coverage lên cao — làm vậy sẽ đánh đổi lấy misclassification, tức trả số sai cho user.

### 1.3 ⚠️ Giả định load-bearing — VERIFY TRƯỚC MỌI THỨ

```
GIẢ ĐỊNH: Groq không tính cached token vào TPM.
MODEL:    openai/gpt-oss-120b (ai-service/app/core/config.py:36)
```

Nếu **sai**: parse không phải ~180 token mà ~180 + **toàn bộ system prompt mỗi lần**. Toàn bộ §1, §13 phải tính lại, và kết luận "parse rẻ" sụp.

**P0-A (task đầu tiên của cả feature):** gọi 5 request giống hệt nhau, đọc `response.usage.prompt_tokens_details.cached_tokens` và đối chiếu với counter rate limit thật. Ghi kết quả vào `docs/groq-token-baseline.md`. **Không code gì trước khi có số này.**

---

## II.2 Entry point taxonomy

| Entry point | T1 tốn? | Cơ chế |
|---|---|---|
| **chip** | Không | chip mang sẵn intent hardcode → gọi thẳng `/analytics/*` |
| **drill-down** | Không | clone intent cũ, đổi 1 param → gọi thẳng `/analytics/*` |
| **free-text** | Có (trừ regex full-match) | normalize → regex → miss thì LLM |

Traffic split **chưa đo** — không có con số nào trong spec này. Đo qua `intent_parse_log.method` (§14).

Kể cả free-text 100% thì ngân sách không vỡ (parse rẻ), chỉ latency p50 xấu.

---

## II.3 Catalog câu hỏi

`✅` đủ · `🔧` cần thay đổi · `⚠️` có giới hạn phải cảnh báo · `⏸` hoãn R2

### 3.1 Nhóm Q — Query

| ID | Câu hỏi mẫu | Metric | Chart | TT | Ghi chú |
|---|---|---|---|---|---|
| Q1 | tháng này tiêu bao nhiêu | `sum` expense | number+progress | ✅ | **reuse** `SumReportTotalsByUser` |
| Q2 | tiền đi đâu hết rồi | `breakdown` category | donut | ✅ | **reuse** `SumReportByCategoryForUser` |
| Q3 | 6 tháng qua tiêu thế nào | `sum` group_by month | bar | 🔧 | cần `SumByMonth` mới |
| Q4 | ăn uống tháng này vs tháng trước | `compare` 2 period | bar đôi | ✅ | 2× reports call |
| Q5 | 5 khoản lớn nhất tháng này | `top_n` | table | ✅ | reuse `ListTransactions` sort amount |
| Q6 | chi trên 1tr tuần này | `filter` amount_min | table | ✅ | + amount parser |
| Q7 | tốn bao nhiêu cho Grab | `keyword` | table | **⏸ R2** | xem §3.5 |
| Q8 | ví nào tiêu nhiều nhất | `breakdown` wallet | bar | 🔧 | reports có filter wallet, chưa group by wallet |
| Q9 | còn bao nhiêu ngân sách | `budget_status` | progress | 🔧 | phụ thuộc cycle window (§11.5) |
| Q10 | thu nhập tháng này | `sum` income | number | ✅ | reuse |
| Q11 | trung bình mỗi ngày tiêu bao nhiêu | `avg_daily` | number+line | 🔧 | chia **ngày có data** |
| Q12 | ăn uống 6 tháng qua thế nào | `trend` 1 category | line | 🔧 | idx mới (§9.2) |
| Q13 | hay tiêu vào thứ mấy | `breakdown` dow | heatmap | 🔧 | component mới |
| Q14 | khoản chi lớn nhất tháng này | `max_tx` | card | ✅ | reuse |

### 3.2 Nhóm S — Scenario

| ID | Câu hỏi mẫu | Chart | TT | Cần |
|---|---|---|---|---|
| S1 | cắt cafe 50% thì dư bao nhiêu | scenario_compare | 🔧 | baseline + `cut_class` |
| S2 | muốn mua laptop 25tr | progress+timeline | 🔧 | baseline |
| S3 | để dành 3tr/tháng bao giờ đủ 50tr | line | 🔧 | baseline |
| S4 | muốn tiết kiệm 5tr cắt gì | table gợi ý | 🔧 | **`cut_class` bắt buộc**, cut order phải khớp wizard |

### 3.3 Nhóm E — Evaluate

| ID | Câu hỏi mẫu | Chart | TT |
|---|---|---|---|
| E1 | đánh giá thu chi tháng này | 3-bar + bullets | 🔧 |
| E2 | tháng này so tháng trước | bảng delta | 🔧 |
| E3 | đánh giá thói quen chi tiêu | 3-tier bar (fixed/essential/discretion) | 🔧 |

### 3.4 Nhóm X — KHÔNG support R1

| Câu hỏi | Lý do (đã verify trên code) |
|---|---|
| cuối tháng còn bao nhiêu | run-rate sai vì chi lumpy |
| có khoản nào bất thường | z-score cần ≥12 tháng |
| đang trả subscription nào | `008_transactions.sql` chỉ có `note`, **không có cột merchant** |
| nên đầu tư gì | ngoài phạm vi |
| so với người khác | không có data, không có consent |

→ `Kind: unsupported` + 2 chip thay thế. Không đoán, không trả lời một phần.

### 3.5 Q7 keyword — HOÃN R2 (quyết định)

Lý do chốt hoãn:
- `unaccent()` không `IMMUTABLE` → phải bọc wrapper `IMMUTABLE` giả, tức **nói dối planner**; đổi dictionary phải reindex thủ công
- Không có cột merchant, `note` do user gõ tự do → trả số **thiếu** mà user tưởng đủ
- 20 user, giá trị không bù được rủi ro số sai

Thay bằng: filter category + amount range ở `/analytics/query` (Q5, Q6) — deterministic, không cảnh báo nào cần.

---

## II.4 Ranh giới Query vs Evaluate

| Tín hiệu | Kind |
|---|---|
| "bao nhiêu", "tổng", "liệt kê", "top", "so sánh" | `query` |
| "đánh giá", "nhận xét", "thế nào", "ổn không", "nhiều không" | `evaluate` |
| "nếu", "muốn", "cắt", "giả sử" | `scenario` |
| mơ hồ | `evaluate` nếu còn quota; ngược lại degrade `query` + template prose |

Chốt cứng (đưa vào golden set):
- "tháng này tiêu bao nhiêu" → `query`
- "tháng này tiêu nhiều không" → `evaluate`
- "ăn uống tháng này so tháng trước" → `query` (compare)
- "...so tháng trước có tăng nhiều không" → `evaluate`

---

## II.5 Normalization pipeline

### 5.1 ⚠️ Đây là BUILD MỚI, không phải "dùng chung"

`grep unaccent|normalize|re.compile` trong `ai-service/app` = **0 hit**. Create-TX hiện không có normalize nào.

**Tách 2 task, không gộp:**

| Task | Nội dung | Rủi ro |
|---|---|---|
| **P7-a** | Build `nlu/normalize.py`, dùng **chỉ cho** query path | Thấp — luồng mới |
| **P7-b** (R2) | Retrofit vào create-TX | **Cao** — regress luồng đang chạy ổn. Cần golden set riêng cho create-TX trước |

R1 **không** động vào create-TX.

### 5.2 Pipeline (query path)

```
1. trim + collapse whitespace
2. lowercase
3. unaccent                 "tiêu"→"tieu"  (giữ bản gốc để hiển thị)
4. strip đại từ             t|tui|tôi|tao|mình|em|tớ|mk → ""
5. expand teencode          bn→bao nhiêu, ntn→như thế nào, tiu→tiêu,
                            dc/đc→được, ko/k0/hok→không, j→gì, vs→với
6. normalize amount         50k→50000, 1tr→1000000, 1tr5→1500000,
                            1.5 triệu→1500000, 500 nghìn→500000
7. normalize time alias     bữa h|dạo này|mấy bữa nay → last_30d
                            đầu tháng → this_cycle_1_10
                            từ tết tới giờ → ⏸ R2 (cần lịch âm)
```

**Rule `k`:** ngay sau digit → nghìn (`50k`); còn lại → "không" (`k biết`). Test cả hai.

**Đại từ an toàn strip** — mọi query ngầm định chủ thể là user đang đăng nhập.

---

## II.6 Regex-first — luật cứng

### 6.1 Full-match anchored

```python
m = pattern.fullmatch(normalized)   # fullmatch, KHONG phai search
```

Sau match, **mọi token phải được consume**. Token thừa → bỏ regex, rơi xuống LLM.

Failure mode phải chặn: `"tháng này tiêu bao nhiêu cho ăn uống"` match partial vào pattern tổng → trả tổng toàn bộ. User thấy số hợp lý và tin. Đây đúng là failure mode mà draft-confirmation sinh ra để chặn — không được để nó quay lại ở nhánh read.

### 6.2 Pattern set khởi đầu = RỖNG

Không tự nghĩ pattern. Sau ≥2 tuần `intent_parse_log` thật → viết pattern cho **top-10 câu lặp nhiều nhất**. Đó là P8, xếp **sau** P7.

Spec này không chứa con số coverage nào.

---

## II.7 Multi-turn anaphora — KHÔNG support R1

`"còn tháng trước?"`, `"thế còn ăn uống?"` → không support.

Lý do: regex chết hoàn toàn; phải gửi history → token/request không dự đoán được.

**Thay bằng follow-up chip mang intent đầy đủ:**

```
[ So với tháng trước ]      ← intent hoàn chỉnh, 0 parse
[ Xem chi tiết Ăn uống ]
```

Gõ câu thiếu ngữ cảnh → `unsupported` + gợi ý gõ đủ. R2 xem lại.

---

## II.8 Category resolution

Category do user tự tạo → không whitelist trước được.

### 8.1 R1: LLM chọn từ danh sách thật + confidence

- ≤20 category → gửi hết; >20 → **top-20** theo tần suất 6 tháng (không phải top-10 — user 25 category sẽ bị cắt đuôi)
- Mỗi item `{id, name, type, cut_class}` ≈ 8 token → 20 ≈ 160 token
- LLM trả `category_ids[]` **kèm `confidence` 0-1**

### 8.2 Xử lý theo confidence

| Confidence | Hành vi |
|---|---|
| ≥ 0.8 | dùng thẳng |
| 0.5–0.8 | dùng + banner "Đang tính cho: Ăn ngoài, Cà phê. [Đổi]" |
| < 0.5 | **không đoán** → chip "Ý bạn là hạng mục nào?" + list |

### 8.3 R2

Embedding matching (pgvector). Quá nặng ở scale 20 user.

---

## II.9 Database changes

### 9.1 `categories.cut_class` — thay cho `is_fixed` ①

Codebase **đã có** phân loại 3 mức, engine wizard đã dùng làm cut order:

```
backend/internal/common/budget_wizard_v2.go:88-110
  CategoryClassFixed      = "fixed"       // housing, utilities
  CategoryClassEssential  = "essential"   // food, transport, health, children_education
  CategoryClassDiscretion = "discretion"  // entertainment, shopping, other
```

Thêm `is_fixed` (2 mức) sẽ tạo **nguồn sự thật thứ hai**: wizard cắt theo `CategoryClass`, Scenario cắt theo `is_fixed` → 2 lời khuyên mâu thuẫn trên cùng category. Và gộp `essential` vào discretionary → S4 sẽ gợi ý cắt Sức khoẻ / Di chuyển, đúng thứ cut order của wizard cố tình tránh.

```sql
-- migration 0XX
ALTER TABLE categories
  ADD COLUMN cut_class TEXT NOT NULL DEFAULT 'discretion'
  CHECK (cut_class IN ('fixed','essential','discretion'));

-- backfill tu ClassForSystemKey cho system category
UPDATE categories SET cut_class = ... WHERE system_key IS NOT NULL;
```

- System category: backfill từ `ClassForSystemKey()` (nguồn sự thật vẫn là hàm Go; cột chỉ persist kết quả + cho phép user override)
- User category: default `discretion`, user đổi qua màn Categories
- Wizard engine đọc cột này thay vì gọi `ClassForSystemKey` trực tiếp → **một nguồn sự thật**

### 9.2 Danh sách migration

| # | Thay đổi | Cần? |
|---|---|---|
| 1 | `categories.cut_class` + backfill | ✅ mới |
| 2 | `idx_tx_user_cat_time (user_id, category_id, occurred_at DESC) WHERE deleted_at IS NULL` | ✅ mới — Q12, breakdown |
| 3 | Bảng `intent_parse_log` (§14) | ✅ mới |
| ~~4~~ | ~~`idx (user_id, occurred_at)`~~ | ❌ **đã có** `idx_transactions_user_occurred_at` (mig 016), đề xuất cũ là prefix của nó → thừa, chỉ tốn write amplification |
| ~~5~~ | ~~`chat_messages.chart_payload`~~ | ❌ **sai bảng** — xem 9.3 |
| ~~6~~ | ~~`pg_trgm` / `unaccent` / GIN note~~ | ❌ Q7 hoãn R2 (§3.5) |

**KHÔNG thêm** `transactions.currency`. Currency thuộc Wallet; `transactions.sql:163` đã `JOIN wallets w ... GROUP BY ..., w.currency`. Denormalize = nguồn sự thật thứ hai.

### 9.3 Chart payload — 0 migration ③

`chat_messages` **không bao giờ được client đọc** (comment trong `015_chat_thread_sync.sql`): nó chỉ log raw role/content/intent để build context cho AI Service.

Chỗ render lại history là `chat_thread_messages.payload TEXT` — opaque JSON blob, backend không inspect. Chart đi vào đó:

```json
{
  "kind": "analytics_result",
  "schema_version": 1,
  "tldr": "...",
  "chart": { "type": "donut", "data": [] },
  "actions": []
}
```

Versioning nằm trong blob, không cần cột. Client `ChartRenderer` đọc `schema_version`, unknown `type` → fallback table.

---

## II.10 API contract

### 10.1 `AnalyticsIntent` — layer & naming ⑥

- Đặt ở **`internal/dto/analytics_intent.go`**, không phải `internal/model/` — toàn `json:` tag, là wire shape (CLAUDE.md)
- Tên **`AnalyticsIntent`**, không phải `AIIntent` — tránh đụng `ChatIntentCreateTransaction` / `ChatIntentAmbiguous` (`chat_service.go:124,157`), vốn là khái niệm intent ở tầng khác

```go
package dto

type AnalyticsKind string

const (
    AnalyticsQuery       AnalyticsKind = "query"
    AnalyticsScenario    AnalyticsKind = "scenario"
    AnalyticsEvaluate    AnalyticsKind = "evaluate"
    AnalyticsUnsupported AnalyticsKind = "unsupported"
)

type AnalyticsIntent struct {
    Kind     AnalyticsKind `json:"kind"`
    Currency string        `json:"currency"` // REQUIRED
    TZ       string        `json:"tz"`       // dung common.AppTimezone

    // query
    Metric      string      `json:"metric,omitempty"`   // sum|breakdown|compare|top_n|avg_daily|trend|max_tx|budget_status
    GroupBy     string      `json:"group_by,omitempty"` // category|month|wallet|dow|none
    TxType      string      `json:"tx_type,omitempty"`
    Period      string      `json:"period,omitempty"`   // this_cycle|last_cycle|last_3c|last_6c|last_30d|custom
    From, To    *time.Time  `json:"from,omitempty"`
    CategoryIDs []uuid.UUID `json:"category_ids,omitempty"`
    WalletIDs   []uuid.UUID `json:"wallet_ids,omitempty"`
    AmountMin   *int64      `json:"amount_min,omitempty"` // xu
    AmountMax   *int64      `json:"amount_max,omitempty"`
    Limit       int         `json:"limit,omitempty"`      // default 20, max 100

    // scenario
    ScenarioType string       `json:"scenario_type,omitempty"` // reduce|purchase|savings_plan
    Adjustments  []Adjustment `json:"adjustments,omitempty"`
    TargetAmount *int64       `json:"target_amount,omitempty"`
    TargetMonths *int         `json:"target_months,omitempty"`
    MonthlySave  *int64       `json:"monthly_save,omitempty"`

    // evaluate
    EvalScope string `json:"eval_scope,omitempty"` // cycle|compare|habit

    // meta — backend dien, LLM khong duoc set
    Confidence float64 `json:"-"`
    Method     string  `json:"-"` // chip|drilldown|regex|llm
}
```

Lưu ý `Period` dùng **cycle** chứ không phải `month` — xem §11.5.

### 10.2 Routes & rate limiter ⑤

**Vấn đề đã tồn tại:**

```
backend/cmd/server/routes.go:132
  ai := v1.Group("/ai", middleware.JWTAuth(...), middleware.AIChatRateLimiter(logger))
backend/internal/middleware/rate_limit.go:35
  AIChatRateLimiter — 30 msg/gio/user, ap cho CA group
```

Nếu đặt free-text query ở `POST /ai/chat` thì query ăn chung quota 30/giờ với create-TX → **user hỏi 30 câu phân tích xong là không ghi được giao dịch nữa**. Đúng cái §13 muốn chặn, nhưng §13 chỉ chặn ở tầng Groq token, không chạm limiter Fiber này.

**Chốt: tách group.**

| Endpoint | LLM | Limiter |
|---|---|---|
| `POST /ai/chat` | T1 create-TX | `AIChatRateLimiter` 30/giờ — **không đổi** |
| `POST /ai/consult` | T1 parse | `AIConsultRateLimiter` 20/giờ — **mới** |
| `POST /analytics/query` | không | chỉ JWT |
| `POST /analytics/scenario` | không | chỉ JWT |
| `POST /analytics/evaluate` | T3 prose | user quota §13.1 |

### 10.3 Quan hệ với `/reports/summary` ⑦

`routes.go:115` `GET /reports/summary` đã có: window tuỳ ý, filter wallet/category/type, group theo currency. Backed bởi `SumReportTotalsByUser` + `SumReportByCategoryForUser`. Nó **đã trả lời Q1, Q2, Q4, Q10** và gần đủ Q8.

**Chốt: `AnalyticsService` build TRÊN `ReportService`, không thay thế.**

```
AnalyticsService
  Q1,Q2,Q4,Q10       -> ReportService.Summary()         [khong viet SQL moi]
  Q5,Q6,Q14          -> TransactionService.List()       [khong viet SQL moi]
  Q9                 -> BudgetService.computeStatus()   [khong viet SQL moi]
  Q3,Q8,Q11,Q12,Q13  -> query moi trong analytics.sql
```

Lý do: 2 engine aggregate song song = 1 bug số liệu sửa 1 chỗ, chỗ kia vẫn sai. `insights.tsx` và `features/reports/` giữ nguyên, không migrate.

Query mới đặt ở `backend/db/queries/analytics.sql`, **không** nhét vào `reports.sql`.

### 10.4 Response chung

```json
{
  "schema_version": 1,
  "currency": "VND",
  "tldr": "...",
  "tldr_source": "template",
  "chart": { "type": "donut", "data": [] },
  "actions": [],
  "warnings": ["coverage_partial"],
  "meta": { "tx_count": 47, "method": "chip", "cached": false, "cycle_start": "2026-09-05" }
}
```

Amount là **string** (int64 xu → string). Client parse Decimal, không dùng JS number.

### 10.5 Error codes

| Code | HTTP | Khi nào |
|---|---|---|
| `INVALID_INPUT` | 400 | intent không khớp schema |
| `CATEGORY_ACCESS_DENIED` | 403 | ID từ LLM không thuộc user — **không silent filter** |
| `INSUFFICIENT_HISTORY` | 422 | <3 chu kỳ data cho scenario/habit |
| `QUOTA_EXCEEDED` | 429 | hết lượt evaluate — kèm `reset_at` |
| `AI_SERVICE_UNAVAILABLE` | 502 | Groq chết — client vẫn render chart |

---

## II.11 Analytics engine

### 11.1 Luật SQL chung

```sql
FROM transactions t
JOIN wallets w ON w.id = t.wallet_id
WHERE t.user_id = $1
  AND t.deleted_at IS NULL
  AND w.currency = $2
  AND t.occurred_at >= $3 AND t.occurred_at < $4
GROUP BY ..., w.currency
```

Thời gian: luôn `AT TIME ZONE` với `common.AppTimezone` (§11.5).

### 11.2 Baseline engine — 3 tier

```
window           = 6 chu ky gan nhat (toi thieu 3)
outlier_cutoff   = p95 amount cua chinh user trong window
expense_median   = median(tong chi tung chu ky, da loai outlier)
income_median    = median(tong thu tung chu ky)
surplus_median   = income_median - expense_median

fixed        = tong category co cut_class='fixed'
essential    = tong category co cut_class='essential'
discretion   = tong category co cut_class='discretion'
```

**MEDIAN không phải MEAN.** Một chu kỳ thưởng Tết phá mean.

**`discretionary != expense - fixed`** — đó là lỗi ① của v1. `essential` là tầng riêng, không được gộp.

### 11.3 Scenario — cut order phải khớp wizard

```
S1 reduce:
  cut_class='fixed'      -> saving=0, warning "fixed_category_ignored"
  cut_class='essential'  -> cho cat nhung TOI DA 15%, warning "essential_limited"
  cut_class='discretion' -> cho cat toi 100%
  new_cat  = baseline_cat * (1-pct)  // clamp >= 0
  surplus' = surplus_median + saving

S2 purchase:
  surplus' <= 0 -> feasible=false, KHONG tra months
  months = ceil(target / surplus')
  co target_months -> goi y cat theo THU TU cua classify.go:66:
    discretion truoc, essential sau (max 15%), fixed khong bao gio

S3 savings_plan:
  months   = ceil(target / monthly_save)
  feasible = monthly_save <= surplus_median
```

**Cấm:** lãi kép, lạm phát, lợi suất. Sang đó là tư vấn tài chính.

### 11.4 Coverage signal — quan trọng hơn cả Evaluate

```go
type Coverage struct {
    DaysWithTx   int
    DaysInCycle  int
    BalanceDrift int64  // |wallet.balance - (initial + tong SignedEffect)|
    Level        string // ok|partial|poor
}
```

- `DaysWithTx/DaysInCycle < 0.6` → `partial`
- `BalanceDrift > 10% expense_median` → `partial`
- cả hai → `poor`

`partial`/`poor` → **banner prefix** trước mọi Evaluate:

```
Co 14/30 ngay khong ghi giao dich nao.
So du vi lech 2.4tr so voi lich su.
Danh gia co the chua phan anh du.
```

> Không có cái này, app khen user "tiết kiệm 53%, rất tốt" trong khi họ tiêu tiền mặt không ghi và thực tế đang âm. Đó là nói dối một cách lịch sự.

`DaysInCycle` là mẫu số — **sai cycle window thì Coverage sai từ gốc**. Xem §11.5.

### 11.5 ⚠️ Cycle window — dependency cứng với Phần I mục I-1

**Hiện trạng:** xem bảng I.2 — `date_trunc('month', NOW())`, `AppTimezone` mồ côi, `cycle_start_day` backend bỏ qua, `007_budgets.sql:5` `CHECK (period IN ('monthly'))`.

**Hệ quả nếu build F-14 trên nền này:**

- Q9 `budget_status` trả số **khác màn Budget**
- E1/E2 so sánh "chu kỳ" theo tháng dương lịch, lệch với ngân sách của user
- Coverage `DaysInCycle` sai mẫu số → banner đo sai → mất luôn thứ được gọi là "quan trọng hơn cả Evaluate"
- Tx lúc 00:30 ngày 1 (GMT+7) rơi sai chu kỳ

**Chốt: F-14 BLOCKED cho tới khi I-1 xong.**

Mọi `Period` trong `AnalyticsIntent` (`this_cycle`, `last_cycle`, `last_6c`) resolve qua `CycleWindow` helper. **Không** có `this_month` trong vocabulary.

Nếu user chưa set `cycle_start_day` → default 1, tức trùng tháng dương lịch, nhưng vẫn đi qua helper (không hardcode `date_trunc`).

---

## II.12 Evaluate

### 12.1 `EvaluationFacts`

LLM **chỉ** thấy struct này.

```go
type EvaluationFacts struct {
    Currency             string
    Cycle, PrevCycle     string   // "2026-09-05..2026-10-04"
    Income, IncomePrev   int64
    Expense, ExpensePrev int64
    Net, NetPrev         int64
    SavingsRate, SavingsRatePrev *float64  // nil khi income=0
    ExpenseMedian6C      int64
    Fixed, Essential, Discretion int64     // 3 tier
    TopCategories        []CategoryFact    // <=5, {name, amount, pct, delta_pct}
    BudgetExceeded       []string
    BiggestTx            *TxFact           // CHI {amount, category_name}
    CyclesOfData         int
    OutliersExcluded     int
    Coverage             Coverage
}
```

**Hard cap 2.000 token:**

```go
if estimateTokens(facts) > 2000 {
    facts.TopCategories = facts.TopCategories[:3]
    facts.BiggestTx = nil
}
```

### 12.2 ④ KHÔNG gửi `note` — lý do thật

> v1 ghi "note từ SePay webhook / MacroDroid SMS = third-party content". **Sai.** `grep sepay|macrodroid|webhook|sms` toàn repo = **0 hit**. Không có integration nào. `note` hiện đến từ: user gõ trong chat, hoặc LLM extract từ chính câu user gõ.

**Lý do thật để không gửi `note`:**

1. **Self-injection** — user gõ note chứa chỉ thị, LLM đọc lại ở lượt sau. Tác hại giới hạn (tự hại mình) nhưng vẫn làm prose sai.
2. **PII rò vào prose** — note chứa tên người, ngữ cảnh riêng. Prose sinh ra rồi lưu vào `chat_thread_messages`, đọc lại được mãi.
3. **Token** — note tự do, không bound được, phá hard cap 2K.

Threat model SDS §7.3 ghi **đúng 3 lý do này**, không ghi SePay. Nếu ngày mai thêm SePay/SMS thật → lúc đó mới là lúc third-party injection xuất hiện, và phải review lại. Ghi mối đe doạ không tồn tại sẽ che mất thời điểm nó xuất hiện thật.

### 12.3 Prompt rules

- `temperature=0`, `max_tokens=300`
- Chỉ dùng số có trong facts
- Giọng **mô tả**: "Ăn uống chiếm 38%" ✔ / "Bạn tiêu hoang" ✘
- Blocklist output: "nên đầu tư", "nên mua", "lãi suất", "cổ phiếu", "vàng", "crypto"
- `CyclesOfData < 3` → cấm từ "thói quen", "xu hướng"

### 12.4 ProseValidator

```go
func ValidateProse(prose string, facts EvaluationFacts) error
// Trich moi so trong prose, doi chieu facts.
// So khong nam trong facts -> REJECT, fallback template.
```

Bắt hallucination **trước khi ra màn hình**.

---

## II.13 Quota & degradation

### 13.1 Ba tầng quota (khác nhau, đừng nhầm)

| Tầng | Cơ chế | Ngưỡng | Chặn gì |
|---|---|---|---|
| **Fiber limiter** | `AIChatRateLimiter` / `AIConsultRateLimiter` | 30/giờ · 20/giờ | request count, **per-user** |
| **Groq org bucket** | in-memory (single instance, chưa cần store chung; khi cần thì dùng Valkey, không dùng Redis) | 80% limit | token, **per-org** |
| **Evaluate quota** | counter, reset 00:00 GMT+7 | 15/ngày | prose call, per-user |

Bucket riêng cho create-TX: **reserved 15% TPM, consult không mượn được.**

Cache: key `(user_id, intent_hash, data_version)`, `data_version = max(updated_at)` của tx user đó.

### 13.2 Degradation ladder

```
1. Cache hit                  -> 0 token
2. chip / drill-down          -> SQL thuan, 0 token
3. free-text + regex hit      -> SQL thuan, 0 token, ~50ms
4. free-text + LLM parse      -> ~180 token (neu 1.3 dung)
5. Evaluate, con quota        -> +2.500 token
6. Evaluate, het quota user   -> chart + TLDR TEMPLATE + banner "het luot hom nay"
7. Org bucket can             -> nhu (6)
8. Groq 429/down              -> nhu (6); doc retry-after, KHONG retry
9. Create TX                  -> group /ai rieng, limiter rieng, bucket rieng
```

Bước 6-8: feature **không chết**, chỉ mất văn xuôi. Số và chart vẫn hiện vì đến từ SQL.

### 13.3 Retry

| Lỗi | Hành vi |
|---|---|
| 429 | **Không retry**, xuống ladder |
| 5xx | retry 1 lần, backoff 2s |
| timeout 8s | không retry |

### 13.4 UX

Không hiển thị "đợi 45s" — rate limit Groq là per-org, user B sẽ thấy lỗi do user A gây ra.

```
[ Thang nay tieu bao nhieu ]
[ Tien di dau het roi ]
[ Danh gia chu ky nay ]   - ton 1 luot

Con 12/15 luot phan tich hom nay
```

---

## II.14 `intent_parse_log`

```sql
CREATE TABLE intent_parse_log (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id),
  raw_text        TEXT,
  normalized_text TEXT NOT NULL,
  parsed_intent   JSONB NOT NULL,
  method          TEXT NOT NULL,
  confidence      REAL,
  latency_ms      INT,
  token_in        INT,
  token_out       INT,
  cached_tokens   INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Privacy → SDS §7.3

| Rule | Giá trị |
|---|---|
| `raw_text` retention | **30 ngày**, cron `SET raw_text = NULL` |
| `normalized_text` retention | 12 tháng (đã unaccent + strip đại từ) |
| Ai đọc | owner qua DB trực tiếp; **không endpoint nào expose** |
| Không log | vào stdout/file |

Bảng này là **cách duy nhất** biết regex nên viết gì, chip gánh bao nhiêu %, và `cached_tokens` có thật không.

---

## II.15 Golden set — P0, ≥100 câu

`ai-service/tests/golden/analytics_intents.jsonl`

| Nhóm | Số | Ví dụ |
|---|---|---|
| Có dấu chuẩn | 30 | "tháng này tiêu bao nhiêu" |
| Không dấu | 25 | "thang nay tieu bao nhieu cho an uong" |
| Teencode | 20 | "thang nay tiu bn" |
| Sai chính tả | 10 | "tháng nay tieu bao nhiu" |
| Thời gian mơ hồ | 10 | "bữa h", "dạo này" |
| Ranh giới Q/E | 10 | "tiêu nhiều không" vs "tiêu bao nhiêu" |
| Unsupported | 10 | "nên đầu tư gì" |

**Assert `AnalyticsIntent` JSON, KHÔNG assert prose.**

Metric: precision/recall per kind, tỉ lệ rơi xuống LLM, latency p50/p95.

---

## II.16 Chart contract

```json
{ "schema_version": 1, "type": "donut", "currency": "VND", "data": [] }
```

| type | Component | TT |
|---|---|---|
| `donut` | `DonutChart.tsx` + `DonutLegendRow.tsx` | có |
| `bar` | `SegmentedBar.tsx` | có |
| `progress` | `SnapshotProgressRow.tsx` / `BudgetProgressBar.tsx` | có |
| `table` | `TransactionRow.tsx` | có |
| `number` | inline | có |
| `line` | **mới** | Q11, Q12, S3 |
| `heatmap` | **mới** | Q13 |
| `scenario_compare` | **mới** (2× SegmentedBar) | S1 |
| `tier_bar` | **mới** (3 tier fixed/essential/discretion) | E3 |

`ChartRenderer.tsx`: switch theo `type`, **unknown → fallback `table`**. Không bao giờ render markup do LLM sinh.

> Lưu ý: `BudgetProgressBar.tsx` hiện nằm trong `features/budgets/` — dùng ở ai-chat là cross-feature import. Cân nhắc move lên `components/shared/` khi làm P3.

---

## II.17 Mobile changes

### 17.1 Component

| Component | Mới/Sửa |
|---|---|
| `ChartRenderer.tsx` | mới |
| `LineChart.tsx` | mới |
| `HeatmapRow.tsx` | mới |
| `ScenarioCompare.tsx` | mới |
| `TierBar.tsx` | mới |
| `SuggestionChips.tsx` | mới |
| `QuotaIndicator.tsx` | mới |
| `CoverageBanner.tsx` | mới |
| `ai-chat.tsx` | sửa — xem 17.2 |
| `categories.tsx` | sửa — picker `cut_class` 3 giá trị |

### 17.2 ⚠️ Ràng buộc 300 dòng — kế hoạch tách bắt buộc

Hiện trạng: `mobile/app/(app)/ai-chat.tsx` **310 dòng** (đã vượt), `backend/internal/service/chat_service.go` **339 dòng** (đã vi phạm).

Thêm render chart + drill-down chắc chắn vượt xa. **Tách trước khi thêm:**

```
mobile/src/features/ai-chat/
  ai-chat.tsx                  ~120  chi layout + wiring
  hooks/useChatThread.ts       ~100  state, pagination
  hooks/useAnalytics.ts        ~80   call /analytics/*, drill-down
  components/MessageList.tsx   ~90
  components/ChartRenderer.tsx ~80
  components/ChipsBar.tsx      ~60

backend/internal/service/
  chat_service.go        -> tach create-TX flow ra chat_service_create.go
  analytics_service.go   ~200  query routing
  analytics_baseline.go  ~150  median/outlier/tier
  analytics_scenario.go  ~180  S1-S4
  analytics_evaluate.go  ~150  facts + prose + validator
```

Tách `chat_service.go` là **task riêng, làm trước P3**, không gộp vào commit feature.

---

## II.18 Phases

| P | Nội dung | Deps | Ước |
|---|---|---|---|
| **P0-A** | **Verify §1.3** — `cached_tokens` có thật không. Ghi `docs/groq-token-baseline.md` | — | 0.5d |
| **P0-B** | Tách org Groq dev/prod · audit retry · golden set ≥100 câu · migration `intent_parse_log` | — | 1d |
| **P0-C** | ⚠️ **Đóng nợ Phần I mục I-1**: `CycleWindow` helper + `SumExpenseByUserCycle` + dùng `AppTimezone` | — | **blocking** |
| **P1** | Migration `cut_class` + backfill + idx cat_time · wizard engine đọc cột thay vì hàm · picker ở `categories.tsx` · fix I-4 | P0-C | 1d |
| **P1.5** | **Refactor tách file** `chat_service.go` + `ai-chat.tsx` (§17.2) | — | 0.5d |
| **P2** | `AnalyticsService` build trên `ReportService` + `analytics.sql` cho Q3/Q8/Q11/Q12 + `POST /analytics/query` | P1 | 1.5d |
| **P3** | `ChartRenderer` + LineChart + chips (Q1–Q6, Q8–Q14) — **dùng được, 0 LLM** | P2, P1.5 | 2d |
| **P4** | `AIConsultRateLimiter` + org bucket + cache + evaluate quota + ladder | — | 1d |
| **P5** | Baseline 3-tier + `POST /analytics/scenario` (S1→S4), cut order khớp `classify.go:66` | P1, P2 | 2d |
| **P6** | `EvaluationFacts` + Coverage + prose + `ProseValidator` + `tier_bar` | P4, P5 | 1.5d |
| **P7-a** | `nlu/normalize.py` (query path only) + LLM parse + `POST /ai/consult` | P2, P5 | 1.5d |
| **P8** | Regex patterns viết từ `intent_parse_log` thật (sau ≥2 tuần) | P7-a | 0.5d |
| **R2** | Q7 keyword · anaphora · embedding category · retrofit normalize vào create-TX | — | — |

**P0-A chặn tất cả.** **P0-C chặn P1 trở đi.**

---

## II.19 Test cases bắt buộc

### Analytics

| Case | Kỳ vọng |
|---|---|
| Ví VND + USD | chỉ currency chỉ định |
| tx 00:30 ngày 1 GMT+7, `cycle_start_day=1` | thuộc chu kỳ mới |
| `cycle_start_day=5`, tx ngày 3 | thuộc chu kỳ **trước** |
| Q9 vs màn Budget | **số phải khớp tuyệt đối** |
| kỳ trước = 0 | "không có dữ liệu kỳ trước", không chia 0 |
| category_id user khác từ LLM | **403**, không silent filter |
| avg_daily 26/30 ngày có tx | chia 26 |
| Q1 qua AnalyticsService vs `/reports/summary` | **số phải khớp tuyệt đối** |

### Scenario

| Case | Kỳ vọng |
|---|---|
| <3 chu kỳ | 422 `INSUFFICIENT_HISTORY` |
| 1 chu kỳ thưởng 50tr | median không đổi, outlier vào warnings |
| cắt `cut_class='fixed'` | saving=0 + warning |
| cắt `cut_class='essential'` 50% | clamp 15% + warning |
| cut order S4 | khớp `classify.go:66` |
| surplus âm | `feasible:false`, không trả months |
| 2 adjustment cùng category | 422 duplicate |

### Quota

| Case | Kỳ vọng |
|---|---|
| Hỏi 20 câu consult liên tiếp | **`/ai/chat` create-TX vẫn nhận request** |
| Evaluate hết quota | chart + template prose, không 429 trắng |
| 3 user hỏi đồng thời | user 3 xuống ladder, không thấy lỗi |
| 2 câu giống hệt cách 30s | gọi Groq **1 lần** |
| Tạo tx mới rồi hỏi lại | cache miss, số cập nhật |
| Groq timeout | ≤8s, không retry |

### Parse

| Case | Kỳ vọng |
|---|---|
| "tháng này tiêu bao nhiêu cho ăn uống" | **KHÔNG** match pattern tổng → LLM |
| "50k" vs "k biết" | parser phân biệt đúng |
| 40 category | facts truncate ≤2K token |
| prose chứa số lạ | ProseValidator reject → template |
| create-TX sau khi ship P7-a | **không regress** (golden set create-TX chạy lại) |

---

## II.20 Docs update

| File | Nội dung |
|---|---|
| `SRS.md` | ⚠️ **Đừng thêm "Feature-14".** SRS §6 đã có `Feature-12: AI Chat Assistant` với **US-03 Query Spending via Chat [MVP]** và **US-04 General Financial Advice [Post-MVP]** — đúng nhóm Q và nhóm E của tài liệu này. Chỉ cần thêm **US-05 (Scenario)** vào Feature-12. Xem §23.2 |
| `SDS.md` §5 | 3 endpoint analytics + `/ai/consult`; ghi rõ AnalyticsService **build trên** ReportService |
| `SDS.md` §6 | API spec + traceability |
| `SDS.md` §7.3 | Threat model: (a) LLM chỉ thấy facts — lý do **self-injection + PII + token bound**, KHÔNG phải third-party; (b) `intent_parse_log` PII retention 30d |
| `SDS.md` §9 | Trade-off: intent DSL vs NL→SQL; regex justify bằng latency không phải token; `cut_class` 3 tier vs `is_fixed` 2 tier |
| `specs/ai-budget-wizard-v2/spec.md` | đánh dấu US-03 là **blocking dependency của F-14** |
| `docs/features.md` | stale (2026-09-13): dòng 40/64 còn ghi F-13.1 "SPEC_ONLY, not in specs/" trong khi `specs/ai-budget-wizard-v2/` đã tồn tại; và mô tả `docs/new-tasks.md` là "1585 lines" — file này giờ khác hẳn |
| `CURRENT_STATE.md` | **stale 2026-08-19** — chạy `/cook-state` trước khi chạy `/cook-ba` |
| `tech_stacks.md` | quota 3 tầng, Groq baseline từ P0-A |

---

## II.21 Rủi ro còn lại

1. **§1.3 chưa verify.** Nếu cached token vẫn tính TPM, toàn bộ mô hình chi phí sai. P0-A không được bỏ.
2. **`cut_class` phải là nguồn sự thật duy nhất.** Wizard engine phải đổi sang đọc cột, không gọi `ClassForSystemKey` trực tiếp nữa. Nếu quên → quay lại đúng vấn đề ① đang sửa.
3. **Coverage signal quan trọng hơn Evaluate.** Và mẫu số của nó là `DaysInCycle` — sai cycle window thì sai từ gốc. Đó là lý do P0-C blocking.
4. **`15 evaluate/ngày` và `20 consult/giờ` là số bịa.** Chỉnh sau 2 tuần log thật.
5. **Traffic split chưa đo.** Không vỡ ngân sách nhưng ảnh hưởng latency p50.
6. **Invite-only che giấu concurrency.** 20 user thì 8K TPM sống. 500 user thì free tier chết. Bucket logic P4 là thứ cho phép đổi tier mà không sửa feature.
7. **P1.5 refactor có rủi ro regress** luồng chat đang chạy ổn. Làm commit riêng, test riêng, không gộp.

---

## II.22 Quan hệ với Phần I

| Mục Phần I | Ảnh hưởng F-14 |
|---|---|
| **I-1 cycle window + AppTimezone** | 🔴 **BLOCKING** — §11.5 |
| I-4 race `FOR UPDATE` | không blocking, fix cùng P1 |
| I-2 plan versioning | không blocking |
| I-3 US-09 moment-of-spend | không blocking; F-14 **không** được copy pattern client-side của `TransactionActionCard.tsx:84-93` |
| I-5 test máy thật | — |

---

## II.23 Mapping sang quy trình `/cook-*`

Tài liệu này là **brief**, không phải artifact của quy trình. Phân bổ nội dung:

### 23.1 Phần nào đi đâu

| Nội dung ở đây | Đi vào | Ghi chú |
|---|---|---|
| §3 catalog Q/S/E/X, §4 ranh giới, §8.2 confidence UX, §13.4 UX quota, §11.4 coverage banner | **`spec.md`** | phải viết lại: tiếng Anh, không tên bảng/endpoint/struct, mỗi US có DoD + Gherkin scenario |
| §5–§6 normalize/regex, §9 migration, §10 API+DTO, §11 công thức, §12 facts/prompt, §16–§17 component & tách file | **`plan.md`** | đúng tầng, nhưng phải đổi sang format 7 mục của `plan.md` skill |
| §19 test cases | **`test_cases.md`** | phải đổi sang format `TC-{FEATURE}-{NN}` + Priority |
| §18 phases, §21 rủi ro, §1.3 P0-A | **giữ ở đây** | không thuộc artifact nào |
| Phần I | **giữ ở đây** | đã có `specs/ai-budget-wizard-v2/` riêng |

### 23.2 Việc phải làm TRƯỚC khi chạy `/cook-ba`

| # | Việc | Vì sao |
|---|---|---|
| 1 | `/cook-state` | `CURRENT_STATE.md` đang ở 2026-08-19, không biết F-13/F-13.1/audit-log. Cả `/cook-ba` và `/cook-plan` Step 1 đều đọc nó làm "project memory" |
| 2 | **Bỏ tên "F-14"** — đây là **Feature-12 US-03 + US-04** | `SRS.md` §6 đã có `Feature-12: AI Chat Assistant` / **US-03 Query Spending via Chat [MVP]** (2 scenario của nó chính là Q1 và Q4) và **US-04 General Financial Advice [Post-MVP]** (= nhóm E). `specs/ai-chat-assistant/spec.md:154` còn ghi thẳng: *"US-02, US-03, US-04 — not specced here; each needs its own BA pass."* Đặt tên mới "F-14" sẽ tạo feature trùng. Chỉ nhóm **S (Scenario) là thật sự mới** → thêm `US-05: Scenario / What-if` vào Feature-12 §6 |
| 3 | `/renew-features` | `docs/features.md` (2026-09-13) còn ghi F-13.1 là SPEC_ONLY và mô tả sai file này |
| 4 | Chốt feature-slug | `/cook-ba` sinh **1 `spec.md`/feature-slug**. Đề xuất tách 3, theo đúng phase: `ai-chat-query-spending` (US-03, ship được không cần LLM), `ai-chat-scenario` (US-05), `ai-chat-evaluate` (US-04) |
| 5 | Quyết định về `/ba-checklist` §4 | Phần "Final Checklist" của `/ba-checklist` là **boilerplate của project khác** (Jira `bee-NNN`, roles `ADMIN\|HR\|FA\|PM\|DM`, "Business Unit") — không áp được cho PFM. Nói rõ bỏ qua §4, hoặc sửa file |
| 6 | Sửa `.claude/skills/agents/qc.md` | File còn **nguyên Flutter**: `Layer: ... \| flutter` (dòng 20), section "Flutter Test Conventions" (dòng 51), `flutter_secure_storage` (dòng 56), `Stack: Flutter (Riverpod, go_router, drift, dio)` (dòng 82). Mobile đã là React Native từ 2026-08-16 → `/cook-qc` sẽ sinh test case cho stack không tồn tại |
| 7 | Sửa 2 dòng "mobile scaffold" | `cook-plan.md:15` và `cook-implementation.md:16` đều ghi *"as of 2026-08-16 `mobile/` has only a project scaffold, no feature yet exists to use as reference"* — **mâu thuẫn trực tiếp** với chính `plan.md`/`dev.md` skill ("reached full feature parity"). Agent đọc Step 2 sẽ bỏ qua bước đọc reference implementation của mobile |
| 8 | GitNexus | Mọi `cook-*.md` đều `@`-import skill gitnexus và Step 2 bảo *"Use gitnexus to..."*, CLAUDE.md bắt buộc `impact()` trước mỗi lần sửa symbol. Repo **không có `.gitnexus/`** và session hiện tại không có MCP tool. Hoặc dựng index, hoặc chấp nhận agent đọc file trực tiếp và **nói rõ là đã không chạy impact analysis** |
