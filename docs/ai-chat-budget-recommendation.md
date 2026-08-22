# Feature-13: AI Budget Setup Wizard — Spec

_Feature code: F-13_  
_Depends on: F-04 (Category Management), F-05 (Budget Management), F-12 (AI Chat Assistant)_  
_Clients: `mobile/` (React Native) — primary; `frontend/` (Next.js) — follow-up_  
_Status: Draft — 2026-08-22_

---

## 1. Context

User muốn thiết lập hoặc điều chỉnh budget của mình thông qua AI Chat mà không cần điền thủ công từng budget. AI hỏi thu nhập, để user chọn danh mục và mức độ chi tiêu mong muốn, rồi tự tính ra số tiền budget hợp lý và đề xuất để user confirm trước khi lưu.

Actor: User đã đăng nhập (member hoặc admin).

---

## 2. Preconditions

- User đã đăng nhập, có JWT hợp lệ.
- User có ít nhất 1 Wallet (dùng để lấy default currency).
- AI Service đang running, reachable từ backend tại `http://ai-service:8000`.
- System categories đã được seed (migration `006_seed_categories`).

---

## 3. Trigger — Hai cách mở Wizard

### Trigger A — Quick-action button (UI-initiated)

Client gọi `GET /api/v1/ai/budget-wizard/prefill`:
- Backend trả về: danh sách system + user categories, existing budgets của user (pre-selection), default wallet currency.
- Không gọi LLM, không lưu `chat_messages`.
- Client mở `BudgetWizardModal` trực tiếp từ màn hình AI Chat (quick-action chip phía trên input box).

### Trigger B — Natural language (AI-initiated)

User chat tự nhiên: "giúp tôi set budget", "tôi muốn lập kế hoạch chi tiêu", "phân bổ ngân sách dùm tôi"…

Backend `POST /ai/chat` → AI Service nhận diện `intent: "budget_wizard"` → trả về response với `action_type: "budget_wizard"`.

Backend:
1. Lưu `chat_messages` như bình thường (user message + AI reply text).
2. Response JSON trả về client có thêm field `action_type: "budget_wizard"`.

Client render `BudgetWizardCard` (tappable) thay vì plain chat bubble. User tap → mở `BudgetWizardModal`. Prefill data được lazy-load từ `GET /api/v1/ai/budget-wizard/prefill` khi modal mở.

---

## 4. BudgetWizardCard — Special Chat Message

```
┌─────────────────────────────────────────────┐
│  🎯  Thiết lập Budget                        │
│  AI sẽ giúp bạn phân bổ ngân sách           │
│  theo thu nhập và ưu tiên của bạn.           │
│                                              │
│           [ Bắt đầu ngay → ]                │
└─────────────────────────────────────────────┘
```

- Render như 1 chat bubble nhưng có border/background phân biệt (không phải plain text).
- Tap bất kỳ đâu trên card → mở `BudgetWizardModal` (full-screen).
- Nếu user đã submit wizard từ card này rồi → card hiển thị "✅ Đã thiết lập [N] budgets" (readonly, không tap được nữa).

---

## 5. Wizard Steps (BudgetWizardModal)

Modal full-screen, có progress bar ở top. Back button đóng/quay lại step trước. Dismiss (X) huỷ toàn bộ wizard (không lưu gì).

---

### Step 1 — Chu kỳ & Thu nhập

**UI:**
- "Bạn muốn quản lý budget theo chu kỳ nào?"
  → Chip group: `[Hàng tháng]` `[Hàng tuần]` `[Hàng quý]`  (default: Hàng tháng)
- "Thu nhập [monthly/weekly/quarterly] của bạn khoảng bao nhiêu?"
  → Numeric input (integer, in cents internally), currency label = default wallet currency (không cho chọn, chỉ hiển thị).
- Hint text: "Nhập ước lượng là được, AI sẽ điều chỉnh cho phù hợp."

**Validation:**
- Income > 0, <= 9,999,999,999 xu (≈ ~10 tỷ VND — overflow guard).
- Income required trước khi Next.

---

### Step 2 — Chọn danh mục

**UI:**
- Header: "Bạn muốn quản lý chi tiêu cho những danh mục nào?"
- Grid 2-column của các budget category phổ biến (preset list dưới đây) + system/user categories chưa có trong preset.
- Multi-select chips: tap để select/deselect.
- Pre-selected: categories đang có budget active (hiển thị badge "hiện tại: [amount]").
- Cuối grid: `[+ Thêm danh mục khác]` → mở text input để user mô tả.

**Preset category list** (match system categories theo `name`/`icon`, không hardcode `category_id`):

| Icon | Tên hiển thị | Mapping với system category |
|---|---|---|
| 🍜 | Ăn uống | "Ăn uống" / "Food" |
| 🚗 | Di chuyển | "Di chuyển" / "Transportation" |
| 🎮 | Giải trí | "Giải trí" / "Entertainment" |
| 💊 | Sức khỏe | "Sức khỏe" / "Health" |
| 👗 | Mua sắm | "Mua sắm" / "Shopping" |
| 📚 | Học tập | "Học tập" / "Education" |
| 💑 | Hẹn hò | "Hẹn hò" / custom |
| 🏠 | Nhà ở & Hóa đơn | "Nhà ở" / "Bills" |
| 📈 | Tiết kiệm & Đầu tư | "Tiết kiệm" / custom |

Client match bằng `lower(name)` với system categories. Nếu không match → wizard sẽ xử lý ở Step 2B.

**Validation:** Phải chọn ít nhất 1 danh mục.

---

### Step 2B — Xác nhận danh mục tự tạo _(conditional)_

_Chỉ hiển thị nếu user nhập custom budget descriptions ở Step 2._

Với mỗi custom description, AI Service gọi `POST /ai/suggest-category-name` (endpoint nhỏ, không lưu chat) và trả về:

```json
{
  "suggested_name": "Hẹn hò / Người yêu",
  "type": "expense",
  "icon": "💑"
}
```

Client hiển thị:
```
Bạn đã mô tả: "[user input]"
Tôi gợi ý tạo danh mục: 💑 "Hẹn hò / Người yêu" (chi tiêu)

  [✅ Xác nhận]   [✏️ Sửa tên]   [🗑️ Bỏ qua]
```

- **Xác nhận** → ghi nhận, sẽ tạo category sau ở submit.
- **Sửa tên** → inline edit, user sửa tên rồi confirm.
- **Bỏ qua** → loại khỏi danh sách, không tạo.

⚠️ Category chưa được tạo ở bước này — chỉ ghi nhận intent. Tạo thực sự xảy ra ở Submit (xem §7).

---

### Step 3 — Mức độ chi tiêu

**UI:**
- Header: "Bạn muốn chi bao nhiêu cho từng danh mục?"
- Mỗi danh mục đã chọn = 1 card:
  - Icon + tên danh mục
  - Nếu existing budget: hiển thị "Hiện tại: [amount]/[period]"
  - Chip group chọn mức độ:

| Option | Label hiển thị | Weight nội bộ | Mô tả tooltip |
|---|---|---|---|
| `very_little` | Rất ít | 0.4× | Cắt giảm tối đa |
| `little` | Ít | 0.7× | Dưới mức bình thường |
| `normal` | Bình thường | 1.0× | Mức phổ biến |
| `a_lot` | Nhiều | 1.5× | Trên mức bình thường |
| `priority` | Ưu tiên | 2.0× | Dành nhiều nhất có thể |
| `ai_decides` | Để AI quyết | (baseline) | AI dùng tỉ lệ chuẩn cho danh mục này |

- Default: `normal` cho category mới; nếu existing budget → pre-select level gần nhất dựa trên `amount/income` ratio so với baseline của danh mục đó.

---

### Step 4 — Đề xuất AI + Pie chart

**Flow:**
1. Client gọi `POST /api/v1/ai/budget-proposals` với income, period, preferences.
2. Show loading skeleton.
3. Kết quả: animated pie/donut chart (reuse `DonutChart.tsx` pattern).

**Chart layout:**
- Mỗi slice: icon + tên danh mục, amount đề xuất, % income.
- Bên dưới chart: legend list mỗi dòng có slider/input để chỉnh.
- Footer: "Chưa phân bổ: [unallocated_amount] ([unallocated_pct]%)" — luôn hiện, kể cả khi = 0.
- Nút `[+ Thêm danh mục]` — quay lại Step 2 để add thêm (giữ nguyên income/period).
- Nút `[Xác nhận & Tạo Budgets]` — tiến đến submit.

**Adjust inline:**
- Tap 1 slice/legend row → expand inline input + slider cho danh mục đó.
- Kéo slider hoặc nhập số → real-time update chart + recalculate unallocated.
- Không gọi lại AI khi user adjust — chỉ client-side recalc.

---

### Step 5 — Submit & Success

Xem §7 cho submit flow.

---

## 6. New API Endpoints

### `GET /api/v1/ai/budget-wizard/prefill`

**Auth:** JWTAuth  
**Handler:** `ChatHandler.BudgetWizardPrefill` (mới)

**Response:**
```json
{
  "success": true,
  "data": {
    "default_currency": "VND",
    "categories": [
      { "id": "uuid", "name": "Ăn uống", "icon": "🍜", "type": "expense", "is_system": true }
    ],
    "existing_budgets": [
      {
        "id": "uuid",
        "category_id": "uuid",
        "period": "monthly",
        "limits": [{ "currency": "VND", "amount_limit": 3000000 }]
      }
    ]
  }
}
```

Không gọi AI Service. Gọi `CategoryRepository.ListCategoriesForUser` + `BudgetRepository.ListBudgetsByUser`.

---

### `POST /api/v1/ai/budget-proposals`

**Auth:** JWTAuth  
**Rate limit:** share `AIChatRateLimiter`  
**Handler:** `ChatHandler.BudgetProposals` (mới)

**Request:**
```json
{
  "income": 20000000,
  "currency": "VND",
  "period": "monthly",
  "preferences": [
    {
      "category_id": "uuid",
      "category_name": "Ăn uống",
      "spending_preference": "a_lot"
    },
    {
      "category_id": "uuid",
      "category_name": "Tiết kiệm",
      "spending_preference": "ai_decides"
    }
  ]
}
```

**Validation (handler layer):**
- `income` > 0, không phải float (BIGINT xu).
- `period` ∈ `{"monthly","weekly","quarterly"}`.
- `preferences` không rỗng, mỗi item có `category_id` và `spending_preference` hợp lệ.

**Backend flow:**
1. Verify mỗi `category_id` visible cho caller (`GetCategoryByID` + check `user_id IS NULL OR user_id = caller`). 403 nếu không pass.
2. Gọi AI Service `POST /budget-proposals`.
3. Trả về proposals đã apply guardrails.

**AI Service — `POST /budget-proposals`:**

Input → output schema (Pydantic):
```python
class BudgetPreference(BaseModel):
    category_id: str
    category_name: str
    spending_preference: Literal[
        "very_little","little","normal","a_lot","priority","ai_decides"
    ]

class BudgetProposalRequest(BaseModel):
    income: int          # BIGINT xu
    currency: str
    period: Literal["monthly","weekly","quarterly"]
    preferences: list[BudgetPreference]

class BudgetProposal(BaseModel):
    category_id: str
    suggested_amount: int    # BIGINT xu
    percentage: float        # e.g. 0.25
    reasoning: str           # tiếng Việt, 1 câu ngắn

class BudgetProposalResponse(BaseModel):
    proposals: list[BudgetProposal]
    unallocated_amount: int
    unallocated_percentage: float
```

**AI guardrails (pure logic, không cần LLM):**

1. **Weight mapping:**

| Preference | Weight |
|---|---|
| very_little | 0.4 |
| little | 0.7 |
| normal | 1.0 |
| a_lot | 1.5 |
| priority | 2.0 |
| ai_decides | category baseline (xem bảng dưới) |

2. **Category baselines** (% of income, dùng khi `ai_decides`):

| Category name pattern | Baseline % |
|---|---|
| ăn uống / food | 25% |
| di chuyển / transport | 10% |
| giải trí / entertainment | 8% |
| sức khỏe / health | 5% |
| mua sắm / shopping | 10% |
| học tập / education | 8% |
| hẹn hò / dating | 7% |
| nhà ở / housing / bills | 15% |
| tiết kiệm / savings | 20% |
| others | 5% |

Match bằng `lower(category_name)` substring. Nếu không match → 5%.

3. **Allocation algorithm:**
   - Tách `ai_decides` categories (dùng baseline trực tiếp, không đưa vào pool weighted).
   - Pool còn lại: phân bổ `(90% income - sum_of_ai_decides_baselines)` theo trọng số.
   - Nếu `ai_decides` baselines vượt 90% income → scale proportionally xuống.
   - Mỗi budget tối thiểu `50_000` xu (nếu sau tính ra thấp hơn → clamp lên 50,000, scale các cái khác xuống).
   - Không có budget nào > 50% income (trừ khi chỉ có 1 budget).
   - `unallocated = income - sum(proposals)`. Luôn >= 10% income.

4. **Reasoning generation:** 1 câu ngắn per proposal, không cần LLM — template string:
   - `"Khoảng [pct]% thu nhập cho [category_name] — [mức_label]"`

> Nếu muốn personalized reasoning → gọi LLM. MVP dùng template.

---

### `POST /api/v1/budgets/bulk`

**Auth:** JWTAuth  
**Handler:** `BudgetHandler.BulkCreateBudgets` (mới)

**Request:**
```json
{
  "budgets": [
    {
      "category_id": "uuid",
      "period": "monthly",
      "start_date": "2026-08-01",
      "limits": [
        { "currency": "VND", "amount_limit": 5000000 }
      ]
    }
  ]
}
```

**Validation (handler):**
- `budgets` không rỗng, tối đa 20 items (guard).
- Mỗi item: `category_id` required, `period` valid, `start_date` valid date, `limits` không rỗng, mỗi `amount_limit` > 0 (BIGINT).
- Không float — client phải gửi integer xu.

**Service flow (1 DB transaction):**
```
BEGIN
  1. SELECT id FROM budgets WHERE user_id = $caller AND deleted_at IS NULL FOR UPDATE
     -- Lock tất cả existing budgets của caller
  2. DELETE FROM budget_limits WHERE budget_id = ANY(existing_ids)
  3. UPDATE budgets SET deleted_at = NOW() WHERE user_id = $caller AND deleted_at IS NULL
  4. For each budget in request:
     a. Verify category_id visible cho caller (user_id IS NULL OR user_id = caller), NOT deleted
     b. Check no duplicate category_id within the request array (validation error nếu có)
     c. INSERT INTO budgets (...) RETURNING id
     d. INSERT INTO budget_limits (...) for each limit
  5. COMMIT
  6. Return created budgets array
```

**Error cases:**
- `category_id` không tồn tại hoặc bị xóa → 404 `CATEGORY_NOT_FOUND`.
- `category_id` của user khác → 403 `FORBIDDEN`.
- Duplicate `category_id` trong request → 422 `DUPLICATE_CATEGORY_IN_REQUEST`.
- DB fail mid-transaction → ROLLBACK → 500 `INTERNAL_ERROR` (partial state không bao giờ xảy ra).

**Response:**
```json
{
  "success": true,
  "data": {
    "created_count": 3,
    "budgets": [ /* array of created budget objects với category_name */ ]
  }
}
```

---

### `POST /ai/suggest-category-name` _(AI Service, internal)_

**Caller:** Backend, từ Step 2B flow.

**Request:**
```json
{ "description": "tiền đi chơi với người yêu" }
```

**Response:**
```json
{
  "suggested_name": "Hẹn hò / Người yêu",
  "type": "expense",
  "icon": "💑"
}
```

Dùng LLM (Groq primary/Anthropic fallback), `temperature=0`, schema-forced output. Prompt ngắn, không cần context categories.

---

### AI Chat — Intent Detection Update

Extend AI Service's `/extract` (hoặc tách endpoint mới `/intent`) để nhận diện `budget_wizard` intent.

Khi user gửi chat message có intent budget setup:
- AI trả về `{ intent: "budget_wizard", reply: "Để tôi giúp bạn lập kế hoạch budget nhé! Bấm vào bên dưới để bắt đầu." }`
- Backend `ChatHandler.Chat` nhận → lưu `chat_messages` (user msg + AI reply) như bình thường → response JSON thêm field `action_type: "budget_wizard"`.
- Client render `BudgetWizardCard`.

---

## 7. Submit Flow (End-to-End)

```
[Client: Step 4 — User tap "Xác nhận & Tạo Budgets"]
  │
  ├─ Nếu có custom categories pending (Step 2B confirmed):
  │    POST /api/v1/categories/ (sequential, abort nếu bất kỳ cái nào fail)
  │    Nhận category_id mới → gán vào proposal tương ứng
  │
  └─ POST /api/v1/budgets/bulk
       ├─ 200: Dismiss modal
       │       Chat bubble cũ (BudgetWizardCard) → update state "✅ Đã thiết lập [N] budgets"
       │       Toast: "Đã tạo [N] budgets thành công!"
       │       Navigate → Insights tab (Budgets subtab)
       │
       └─ 4xx/5xx: Hiển thị error inline trong modal (không dismiss)
                   [Thử lại] button
```

---

## 8. Scenarios (Gherkin)

| Scenario ID | Scenario | Given | When | Then | Notes |
|---|---|---|---|---|---|
| S-BWZ-01 | Mở wizard từ quick-action | User ở AI Chat screen | User tap quick-action "Thiết lập Budget" | System gọi prefill, mở BudgetWizardModal tại Step 1 | Không lưu chat message |
| S-BWZ-02 | Mở wizard từ chat tự nhiên | User ở AI Chat screen | User gửi "giúp tôi set budget" | AI trả BudgetWizardCard, user tap card | Chat message được lưu |
| S-BWZ-03 | Happy path — tạo mới hoàn toàn | User chưa có budget nào | User hoàn thành all steps, confirm | System tạo N budgets mới, trả 200 | Không soft-delete vì không có cũ |
| S-BWZ-04 | Replace existing budgets | User đã có 3 budgets cũ | User chọn 2 danh mục (kể cả 1 cái cũ), confirm | 3 budgets cũ soft-deleted, 2 budgets mới tạo | Atomic trong 1 TX |
| S-BWZ-05 | Existing budget pre-selected | User có budget "Ăn uống" 3M/tháng | Mở wizard Step 2 | "Ăn uống" pre-selected, badge "hiện tại: 3,000,000" | Step 3: pre-select mức phù hợp |
| S-BWZ-06 | Custom category — confirm | User nhập "tiền đi chơi với bạn bè" | Step 2B hiển thị suggestion | User bấm Xác nhận | Category tạo trước, budget tạo sau khi submit |
| S-BWZ-07 | Custom category — bỏ qua | User nhập "tiền café sáng" rồi bấm Bỏ qua | Step 2B | Category không được tạo | Danh mục bị loại khỏi danh sách wizard |
| S-BWZ-08 | Income = 0 | User nhập income = 0 | Step 1, bấm Next | Validation error "Thu nhập phải lớn hơn 0" | Không tiến step |
| S-BWZ-09 | Không chọn danh mục nào | User bỏ chọn hết ở Step 2 | Bấm Next | Validation error "Hãy chọn ít nhất 1 danh mục" | Không tiến step |
| S-BWZ-10 | AI proposals — guardrail single category | User chọn 1 category, income 10M | Proposals | Budget không vượt 50% income khi nhiều categories; với 1 category → có thể 90% | Edge case 1 category |
| S-BWZ-11 | User adjust proposal | Step 4, user kéo slider "Ăn uống" từ 4M lên 6M | Real-time update | Chart redraws, unallocated giảm tương ứng | Client-side only, không gọi AI |
| S-BWZ-12 | Bulk submit — category không tồn tại | client gửi category_id bị xóa | POST /budgets/bulk | 404 CATEGORY_NOT_FOUND, không tạo gì | |
| S-BWZ-13 | Dismiss wizard giữa chừng | User tap X tại bất kỳ step nào | Modal đóng | Không có gì được lưu, không tạo category/budget | Wizard state ephemeral |
| S-BWZ-14 | BudgetWizardCard đã submit | User đã submit wizard thành công | Quay lại chat cũ | Card hiển thị "✅ Đã thiết lập [N] budgets" (readonly) | Prevent double-submit |

---

## 9. Edge Cases

1. **Income rất lớn (>= 9,999,999,999 xu):** Validation error ở client + server. Guard tránh overflow khi nhân weight.
2. **Income rất nhỏ (e.g. 100,000 xu) + nhiều categories:** Sau guardrail minimum 50,000/budget → tổng có thể vượt 90% income. Logic: ưu tiên giảm `priority` trước, sau đó cắt bớt danh mục ít quan trọng nhất (preference thấp nhất), cảnh báo user ở Step 3.
3. **Tất cả preferences là `ai_decides` và baselines tổng > 90%:** Scale proportionally toàn bộ xuống, `unallocated` = 10% income.
4. **User chọn category type = income (e.g. "Lương") làm budget:** Budget management hiện chỉ track expense — warning ở Step 2 nếu category type = income, không block nhưng cảnh báo "Budget thường áp dụng cho danh mục chi tiêu".
5. **Category tạo thành công nhưng bulk budget fail:** Category đã được tạo và tồn tại (không rollback). Cảnh báo user: "Danh mục [X] đã được tạo nhưng budget chưa được lưu. Thử lại."
6. **Duplicate category_id trong request:** Validation ở service layer, 422 `DUPLICATE_CATEGORY_IN_REQUEST`.
7. **User mở wizard từ 2 devices cùng lúc, cả 2 submit:** DB row lock ở step `SELECT ... FOR UPDATE` trong bulk TX serializes them. Cái sau thấy không còn existing budgets cũ để delete (đã bị delete bởi cái trước) → vẫn INSERT budgets mới thành công. Kết quả: budgets của cái submit sau thắng.
8. **AI Service timeout khi gọi budget-proposals:** Backend trả 504 `UPSTREAM_TIMEOUT`. Client hiển thị "AI đang bận, thử lại sau". Không dismiss modal.
9. **User thêm 20+ danh mục (vượt limit):** Server trả 422 `TOO_MANY_BUDGETS` (max 20). Client nên enforce ở Step 2 (disable chip selection sau 20).
10. **Period mismatch với existing budgets:** User chọn "weekly" nhưng existing budgets là "monthly". Bulk replace → tất cả budgets cũ bị soft-delete, budgets mới tạo với period "weekly". Hành vi đúng — không conflict.

---

## 10. Data Flow — Sequence

```
Client              Backend (Go)             AI Service (Python)       DB
  |                     |                          |                    |
  |-- GET /budget-wizard/prefill -->|               |                    |
  |                     |-- ListCategories, ListBudgets -->|             |
  |<------ prefill data ----------|                |                    |
  |                     |                          |                    |
  |--- (Step 2B) -------|                          |                    |
  |    POST /ai/suggest-category-name (via backend) |                   |
  |                     |-- POST /suggest-category-name -->|            |
  |<------ suggested name --------|                |                    |
  |                     |                          |                    |
  |--- POST /ai/budget-proposals ->|               |                    |
  |                     |-- Verify category_ids -------->|              |
  |                     |-- POST /budget-proposals ------>|             |
  |                     |<----- proposals + guardrails ---|             |
  |<---- proposals -----|                          |                    |
  |                     |                          |                    |
  |--- (optional) POST /categories/ ×N -->|        |                    |
  |<---- category_ids --|                          |                    |
  |                     |                          |                    |
  |--- POST /budgets/bulk ---------->|             |                    |
  |                     |-- BEGIN TX -------------->|                   |
  |                     |-- LOCK existing budgets ->|                   |
  |                     |-- DELETE budget_limits -->|                   |
  |                     |-- UPDATE budgets deleted ->|                  |
  |                     |-- INSERT new budgets+limits->|                |
  |                     |-- COMMIT ---------------->|                   |
  |<---- created budgets |                          |                    |
```

---

## 11. Out of Scope

- **Multi-currency budget wizard:** Wizard chỉ hỗ trợ 1 currency (default wallet). Multi-currency budget vẫn tạo được thủ công qua CRUD bình thường.
- **Budget icon selection trong wizard:** Wizard không hỏi icon cho từng budget. User chỉnh sau qua PATCH.
- **Savings/Goal integration:** Wizard có category "Tiết kiệm" nhưng không tự tạo Financial Goal tương ứng (F-08).
- **Budget import từ file:** Out of scope.
- **Recurring re-run wizard theo lịch:** Out of scope. User tự mở lại khi cần.
- **Frontend (Next.js) web client:** Spec này target `mobile/`. Web UI follow-up sau.
- **Undo sau khi submit:** Không có undo — user cần mở lại wizard hoặc edit thủ công.

---

## 12. Open Questions

| # | Question | Impact | Status |
|---|---|---|---|
| OQ-01 | AI Service có nên dùng LLM cho budget-proposals thay vì rule-based không? | LLM cho personalized reasoning nhưng tốn token + latency. Rule-based đủ cho MVP. | **Assumption: rule-based cho MVP.** |
| OQ-02 | Sau khi submit bulk, có nên navigate tự động sang Insights/Budgets tab không, hay chỉ toast? | UX preference | Assumption: navigate + toast |
| OQ-03 | BudgetWizardCard trong chat — sau khi user submit, card state lưu ở đâu? `chat_messages.content` JSON? | Cần quyết định trước khi impl chat state | Assumption: client-side state (React state + TanStack Query cache invalidation). Card chỉ cần biết "đã submit hay chưa" trong session hiện tại. Nếu user restart app → card không biết trạng thái submitted → safe: tapping lại mở wizard mới (Trigger A prefill check: nếu user đã có budgets thì pre-select). Không cần persist card state. |
| OQ-04 | Guardrail "category type = income": Block hẳn hay chỉ warning? | UX + data integrity | Assumption: warning, không block. User tự chịu trách nhiệm. |
| OQ-05 | `POST /budgets/bulk` cần idempotency key không? | Nếu user submit 2 lần (double-tap) → 2 lần bulk replace, kết quả giống nhau. Low risk nhưng có thể flash. | Assumption: không cần idempotency key cho MVP. Client disable button sau lần tap đầu. |

---

## 13. Definition of Done

- [ ] `GET /api/v1/ai/budget-wizard/prefill` hoạt động, trả đúng categories + existing budgets.
- [ ] `POST /api/v1/ai/budget-proposals` trả proposals đã apply đủ 4 guardrails.
- [ ] `POST /api/v1/budgets/bulk` atomic: existing soft-deleted + new created trong 1 TX.
- [ ] AI Service nhận diện `budget_wizard` intent từ natural language message.
- [ ] `BudgetWizardCard` render trong chat, tappable, open modal.
- [ ] Wizard 4 steps hoạt động end-to-end trên mobile: period/income → category selection (pre-selected existing) → spending preference → proposals + adjust → submit.
- [ ] Step 2B (custom category): AI suggest name, user confirm/reject, category tạo trước bulk submit.
- [ ] Submit success: modal dismiss, card update to readonly ✅, navigate Insights/Budgets tab.
- [ ] Submit fail: modal giữ nguyên, error message hiển thị, retry button hoạt động.
- [ ] Unit test: budget-proposals guardrails (income nhỏ, total > 90%, single category, all ai_decides).
- [ ] Unit test: bulk service — soft-delete existing + create new trong 1 TX, rollback on error.
- [ ] Edge case OQ-03 confirmed (card state không persist qua restart là acceptable).