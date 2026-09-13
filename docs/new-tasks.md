# F-13.1 — AI Budget Setup Wizard v2

_Feature code: F-13.1 — thay thế toàn bộ §5 (Wizard Steps) và §6.2 (allocation algorithm) của `specs/ai-budget-wizard/spec.md`._
_Giữ nguyên: §6 `GET /prefill` (mở rộng), §6 `POST /budgets/bulk` (mở rộng), §7 Submit flow, §10 Sequence._
_Status: Proposal — 2026-09-12_
_Depends on: F-04 (Category), F-05 (Budget), F-12 (AI Chat)_
_Target client: `mobile/` (React Native)_

---

## 0. TL;DR — cái gì đổi

| | v1 (spec hiện tại) | v2 (spec này) |
|---|---|---|
| User chính | Không xác định | **P1 — user chưa có data** (đông nhất) → P2 → P3 |
| Số bước | 4 bước cứng cho mọi user | **3 màn cho P1**, 1 màn confirm cho P2, mode gõ tự do cho P3 |
| Cách hỏi mức chi | 6 chip tier × N category (tới 120 quyết định) | **2 câu hỏi** → preset profile |
| Đơn vị phân bổ | % của gross income | **% của disposable** (`income − fixed − savings`) |
| Tiết kiệm | Là 1 category trong danh sách | **Trừ trước ở màn 1**, không phải phần dư |
| Số hiển thị | `3.087.425đ` | **Làm tròn theo bậc VND** + quy ra `đ/ngày` |
| Budget là gì | Một con số cứng | **Một dải `min–max`** kèm độ tin cậy |
| Sau khi tạo | One-shot, không quay lại | **Vòng lặp hội tụ**: ngày 7 → ngày 14 → cuối chu kỳ |
| Khi user vượt | Báo đỏ | AI nhận sai số của mình, đưa lựa chọn zero-sum |
| Kiểu số | `float64` rồi truncate | `int64` VND toàn bộ |

**Tuyên bố nền tảng của v2:** vì P1 là user chính và P1 **không có data**, ngân sách lần đầu **chắc chắn sai**. Sản phẩm không được giả vờ nó đúng. Giá trị nằm ở tốc độ hội tụ, không ở độ chính xác lần đầu.

---

## 1. Nguyên tắc thiết kế (dùng để xử lý mọi tình huống spec chưa nói tới)

| # | Nguyên tắc | Hệ quả cụ thể |
|---|---|---|
| **P-01** | **Budget v1 là giả thuyết, không phải chân lý.** | Phải nói trước với user rằng đây là ước lượng. Phải có lịch kiểm lại. |
| **P-02** | **AI chịu trách nhiệm cho sai số, không đổ cho user.** | Copy luôn là "ngân sách tôi đặt chưa sát", không bao giờ là "bạn tiêu quá tay". |
| **P-03** | **Không bao giờ tự sửa budget mà không hỏi.** | Mọi calibration đều cần 1 tap xác nhận. Silent auto-adjust phá trust nặng hơn số sai. |
| **P-04** | **Nâng budget phải zero-sum.** | Không được nâng tự do — phải lấy từ category khác / dự phòng / tiết kiệm, và hiện rõ lấy từ đâu. Nếu không, budget chỉ là gương phản chiếu hành vi. |
| **P-05** | **Mỗi category là một cơ hội thất bại.** | Mặc định ≤ 6 category. Cảnh báo khi user chọn > 7. |
| **P-06** | **Số phải actionable tại thời điểm chi tiêu.** | Ưu tiên `đ/ngày` hơn `đ/tháng` ở mọi bề mặt. |
| **P-07** | **Không shaming.** | Không màu đỏ, không emoji buồn, không dấu than. Chỉ số và bước tiếp theo. |
| **P-08** | **LLM không được làm phép tính.** | LLM chỉ trích xuất text → JSON. Mọi arithmetic ở Go, `int64`, deterministic. |
| **P-09** | **Mọi con số phải có xuất xứ.** | Mỗi dòng budget mang badge nguồn + evidence string. Không có "AI đề xuất" trống rỗng. |
| **P-10** | **Giá trị trước khi hoàn thành.** | Màn 1 tự nó đã hữu ích (hiện `đ/ngày`). User bỏ ngang vẫn học được gì đó. |

---

## 2. Persona — routing

P1/P2 là **trạng thái dữ liệu** (hệ thống tự xác định). P3 không phải branch — là **chế độ nhập liệu tuỳ chọn**, có ở cả P1 lẫn P2.

```go
type Persona string
const (
    PersonaCold Persona = "cold" // P1 — không / rất ít data
    PersonaWarm  Persona = "warm" // P1.5 — có ít data, dùng lai
    PersonaHot   Persona = "hot"  // P2 — đủ data để tự đề xuất
)

// Chạy trong GET /prefill. Chỉ tính transaction type=expense, chưa soft-deleted.
func ResolvePersona(txCount90d int, distinctMonths int) Persona {
    switch {
    case txCount90d >= 40 && distinctMonths >= 2:
        return PersonaHot
    case txCount90d >= 10:
        return PersonaWarm
    default:
        return PersonaCold
    }
}
```

| Persona | Flow | Confidence khởi tạo | Lịch calibration |
|---|---|---|---|
| `cold` | 3 màn: Thu nhập → Profile → Kết quả | `low` | **Ngày 7, ngày 14, cuối chu kỳ** |
| `warm` | 3 màn, nhưng category nào đủ data (≥8 tx) thì lấy từ history, còn lại lấy preset | `medium` | Ngày 14, cuối chu kỳ |
| `hot` | **1 màn confirm** | `high` | Cuối chu kỳ |

> **Quy tắc:** tần suất kiểm lại **tỉ lệ nghịch với độ tin cậy**. Data càng ít, phải kiểm lại càng sớm.

---

## 3. Thời điểm trigger wizard

| Trigger | Điều kiện | Ghi chú |
|---|---|---|
| **KHÔNG** trigger ở onboarding | — | User vừa cài app chưa tin app, chưa có data → budget bịa → churn tuần 2. Cấm. |
| Soft prompt trong AI Chat | Sau **5 transaction đầu tiên** HOẶC **ngày thứ 3** kể từ khi cài | Một `BudgetWizardCard` trong chat, dismissible. Hiện tối đa **2 lần**, cách nhau ≥ 7 ngày. |
| Quick-action chip | Luôn có | Trigger A của spec v1. P3 cần từ ngày 0 thì vào đây. |
| Natural language | "giúp tôi set budget"… | Trigger B của spec v1, giữ nguyên. |
| Sau calibration cuối chu kỳ | Chu kỳ mới bắt đầu | Không mở wizard, mở màn Calibration (§8). |

---

## 4. Mô hình dữ liệu

### 4.1 Bảng mới — tách lớp *kế hoạch* khỏi lớp *thực thi*

`budgets` / `budget_limits` giữ nguyên vai trò **enforcement**. Thêm lớp **planning** để calibration có thứ để so sánh và audit.

```sql
CREATE TABLE budget_plans (
  id               uuid PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES users(id),
  version          int  NOT NULL,              -- 1, 2, 3… tăng mỗi lần calibrate
  parent_plan_id   uuid REFERENCES budget_plans(id),  -- plan được calibrate từ
  period           text NOT NULL,              -- monthly | weekly | quarterly
  cycle_start_day  smallint NOT NULL DEFAULT 1,-- ngày lương về (1..28)
  income           bigint NOT NULL,            -- VND, int64 đồng. KHÔNG phải xu.
  income_source    text NOT NULL,              -- manual | median_history | lowest_history
  fixed_total      bigint NOT NULL DEFAULT 0,
  savings_target   bigint NOT NULL DEFAULT 0,
  disposable       bigint NOT NULL,            -- income - fixed_total - savings_target
  profile_preset   text,                       -- rented_eating_out | with_family | own_family | student | NULL
  confidence       text NOT NULL,              -- low | medium | high
  created_at       timestamptz NOT NULL DEFAULT now(),
  superseded_at    timestamptz,
  CONSTRAINT chk_disposable_positive CHECK (disposable > 0),
  CONSTRAINT chk_cycle_day CHECK (cycle_start_day BETWEEN 1 AND 28)
);
CREATE UNIQUE INDEX uq_active_plan ON budget_plans(user_id) WHERE superseded_at IS NULL;

CREATE TABLE budget_plan_items (
  id           uuid PRIMARY KEY,
  plan_id      uuid NOT NULL REFERENCES budget_plans(id) ON DELETE CASCADE,
  category_id  uuid NOT NULL REFERENCES categories(id),
  amount_min   bigint NOT NULL,     -- mép dưới của dải
  amount_max   bigint NOT NULL,     -- mép trên = giá trị ghi vào budget_limits.amount_limit
  source       text   NOT NULL,     -- stated | history | preset | manual
  locked       boolean NOT NULL DEFAULT false,
  confidence   real   NOT NULL,     -- 0..1
  evidence     text,                -- "54 giao dịch / 3 tháng, TB 53k/lần"
  CONSTRAINT chk_band CHECK (amount_min <= amount_max AND amount_min > 0),
  UNIQUE (plan_id, category_id)
);
```

**Quy tắc ánh xạ sang bảng enforcement:** `budget_limits.amount_limit = budget_plan_items.amount_max`.
`amount_min` chỉ dùng để render dải trên UI và để phân loại trạng thái (§6.5).

### 4.2 Struct trung gian trong engine

Mọi nguồn đầu vào phải chuẩn hoá về struct này **trước khi** vào allocator. Không có engine thứ hai.

```go
type IntentSource string
const (
    SourceStated  IntentSource = "stated"  // user nói rõ (NL hoặc nhập tay)
    SourceHistory IntentSource = "history" // trung vị chi tiêu thực tế
    SourcePreset  IntentSource = "preset"  // profile preset
    SourceManual  IntentSource = "manual"  // user kéo slider ở màn kết quả
)

type CategoryIntent struct {
    CategoryID   uuid.UUID
    CategoryName string
    Source       IntentSource
    AmountMin    int64   // VND đồng
    AmountMax    int64
    Locked       bool    // user chốt cứng → allocator không scale, quantizer không làm tròn
    Confidence   float64 // 0..1
    Evidence     string
}
```

**Precedence khi một category có nhiều nguồn** (cao → thấp): `stated` → `manual` → `history` → `preset`.
Ghi đè hoàn toàn, không trộn. Nguồn thắng quyết định luôn `Confidence` và `Evidence`.

---

## 5. Luồng UI — P1 (`cold`) — ĐÂY LÀ FLOW CHÍNH

Mục tiêu: **≤ 45 giây, 3 màn, ≤ 8 lần chạm**.

### 5.1 Màn 1 — Tiền vào, tiền cố định, tiền để dành

```
┌──────────────────────────────────────────────┐
│  ●○○                                     ✕   │
│                                               │
│  Mỗi tháng bạn có bao nhiêu?                 │
│                                               │
│  Thu nhập            [ 12.000.000 ] đ        │
│                                               │
│  Chi phí cố định     [  2.500.000 ] đ        │
│  ⓘ nhà, điện nước, internet, học phí         │
│                                               │
│  Muốn để dành                                 │
│  ├──●────────────────┤   1.200.000đ  (10%)   │
│  Chưa   Ít  [Vừa]  Nhiều                     │
│                                               │
│  ─────────────────────────────────────       │
│  Còn được chi          8.300.000đ            │
│                        276.000đ / ngày        │
│                                               │
│  Lương về ngày [ 1 ▾ ] hàng tháng            │
│                                               │
│                          [ Tiếp → ]           │
└──────────────────────────────────────────────┘
```

**Quy tắc:**
- `Còn được chi` và `đ/ngày` cập nhật **realtime** khi user gõ. Đây là giá trị tức thì (P-10).
- Slider tiết kiệm: `0% / 5% / 10% / 20% / tuỳ chỉnh`. **Mặc định 10%**, KHÔNG phải 20%.
  > _Lý do:_ best practice tài chính là 20%, nhưng với user chưa từng theo dõi chi tiêu, cam kết 20% + chi phí chưa biết = vỡ kế hoạch tuần 2 = churn. 10% là mức gần như chắc chắn giữ được. Vòng lặp calibration (§8) sẽ chủ động đề nghị nâng lên khi thấy user thừa tiền. **Tăng dần từ mức giữ được > đặt cao rồi thất bại.**
- `Lương về ngày N` → `cycle_start_day`. Mặc định 1. Ảnh hưởng trực tiếp độ chính xác của `đ/ngày`.
- Validation: `income > 0`; `fixed + savings < income` (nếu không → chặn Next, message: _"Chi phí cố định và tiết kiệm đã vượt thu nhập. Bạn xem lại giúp nhé."_); `income ≤ 9.999.999.999`.

**Nếu là `warm`/`hot`:** ô thu nhập pre-fill từ history kèm nhãn nguồn, xem §7.1.

### 5.2 Màn 2 — Một câu hỏi duy nhất

**Không hỏi từng category. Không hỏi tier.** Hỏi hoàn cảnh sống — thứ user chắc chắn biết.

```
┌──────────────────────────────────────────────┐
│  ●●○                                     ✕   │
│                                               │
│  Bạn đang sống kiểu nào?                     │
│  Tôi sẽ dựng ngân sách khởi điểm từ đây.     │
│                                               │
│  ┌─────────────────────────────────────────┐ │
│  │ 🏙  Ở trọ, đi làm, ăn ngoài là chính    │ │
│  ├─────────────────────────────────────────┤ │
│  │ 🏡  Ở với gia đình, ăn cơm nhà          │ │
│  ├─────────────────────────────────────────┤ │
│  │ 👨‍👩‍👧  Có gia đình riêng, có con nhỏ      │ │
│  ├─────────────────────────────────────────┤ │
│  │ 🎓  Sinh viên                            │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ✏️  Hoặc kể tôi nghe cách bạn tiêu tiền     │
│      (gõ tự do)                               │
└──────────────────────────────────────────────┘
```

Dòng cuối = lối vào **mode P3** (§9). Để nhỏ, không phải nút chính.

### 5.3 Bảng preset — % của **disposable**, không phải của gross

> Dùng disposable làm mẫu số giúp tỉ lệ ổn định hơn nhiều giữa các mức thu nhập, và bắt buộc mental model "trừ tiết kiệm trước".

| Category | 🏙 `rented_eating_out` | 🏡 `with_family` | 👨‍👩‍👧 `own_family` | 🎓 `student` |
|---|---|---|---|---|
| 🍜 Ăn uống | **40%** | 26% | 34% | 40% |
| 🚗 Di chuyển | 11% | 12% | 10% | 8% |
| ☕ Cafe & Giải trí | 14% | 20% | — | 17% |
| 🛍 Mua sắm | 11% | 17% | 9% | 6% |
| 💊 Sức khoẻ | 4% | 5% | 8% | — |
| 👶 Con cái & Học tập | — | — | 20% | 12% |
| ⋯ Chi khác | 8% | 8% | 7% | 5% |
| **Tổng phân bổ** | **88%** | **88%** | **88%** | **88%** |
| 🛟 **Dự phòng** | **12%** | **12%** | **12%** | **12%** |

**Ràng buộc thiết kế preset:**
- Mỗi profile ≤ **6 category** (P-05).
- Tổng luôn = 88%, dự phòng = 12% → thoả `BudgetWizardMinUnallocatedShare ≥ 10%` của spec v1.
- `Dự phòng` **không phải** một budget category — nó là `unallocated_amount`, hiện ở footer với tên thân thiện. Transaction không được gán vào nó.
- Preset map tới category bằng **tên**, không hardcode `category_id` (giữ quy tắc của spec v1 §5 Step 2).
- Category nào trong preset mà user chưa có → tạo ở bước submit (dùng lại luồng §7 spec v1).

### 5.4 Màn 3 — Kết quả

```
┌──────────────────────────────────────────────┐
│  ●●●                                     ✕   │
│                                               │
│  Ngân sách khởi điểm của bạn                 │
│  ⓘ Đây là ước lượng — tôi chưa biết thói quen│
│    chi tiêu của bạn. Sau 1 tuần tôi sẽ xem   │
│    số thật và chỉnh lại cùng bạn.            │
│                                               │
│         ╭───────────╮                         │
│         │   DONUT   │   276.000đ/ngày         │
│         ╰───────────╯                         │
│                                               │
│  🍜 Ăn uống        3.300.000  ○○○ ước lượng  │
│  ☕ Cafe & Giải trí 1.150.000  ○○○           │
│  🚗 Di chuyển         900.000  ○○○           │
│  🛍 Mua sắm           900.000  ○○○           │
│  💊 Sức khoẻ          350.000  ○○○           │
│  ⋯ Chi khác           650.000  ○○○           │
│  ─────────────────────────────────────       │
│  🛟 Dự phòng        1.000.000                │
│                                               │
│  📈 Tiết kiệm       1.200.000  (đã trừ trước)│
│  🏠 Cố định         2.500.000  (đã trừ trước)│
│                                               │
│  [ Chỉnh ]              [ Bắt đầu dùng ]     │
└──────────────────────────────────────────────┘
```

**Bắt buộc:**
- **Dòng ⓘ về "ước lượng" không được bỏ.** Đây là pre-commitment ngăn cảm giác bị lừa ở tuần 2 (P-01).
- Badge độ tin cậy mỗi dòng: `○○○ ước lượng` / `●●○ từ N tuần data` / `●●● bạn đã nói`.
- Tap một dòng → expand slider + input. Sửa tay → `source = manual`, `locked = true`, và **các dòng khác KHÔNG tự động scale** (đã bàn ở P-03; im lặng đổi số của người khác là mất trust). Thay vào đó cập nhật `Dự phòng` và hiện cảnh báo nếu dự phòng < 5%.
- Tiết kiệm & Cố định hiện ở cuối như tham chiếu, **không nằm trong donut** — donut chỉ vẽ disposable.

---

## 6. Thuật toán

### 6.1 Income resolution

```go
type IncomeSuggestion struct {
    Median   int64  // trung vị tổng thu nhập theo tháng, 6 tháng gần nhất
    Lowest   int64  // tháng thấp nhất trong cùng cửa sổ
    Months   int    // số tháng có dữ liệu
    Reliable bool   // Months >= 3
}
```

```sql
WITH m AS (
  SELECT date_trunc('month', t.transaction_date) AS mo, SUM(t.amount) AS total
  FROM transactions t JOIN categories c ON c.id = t.category_id
  WHERE t.user_id = $1 AND c.type = 'income'
    AND t.deleted_at IS NULL
    AND t.transaction_date >= (now() - interval '6 months')
  GROUP BY 1
)
SELECT
  COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY total), 0)::bigint AS median,
  COALESCE(MIN(total), 0)::bigint AS lowest,
  COUNT(*)::int AS months
FROM m;
```

- **Dùng median, KHÔNG dùng AVG.** Một tháng thưởng Tết kéo mean lên → user lập kế hoạch trên số ảo.
- `Months < 3` → `Reliable = false` → **không pre-fill**, chỉ hiện gợi ý nhỏ bên dưới ô nhập.
- `Reliable = true` → pre-fill `Median`, kèm chip phụ `[ Dùng tháng thấp nhất: 10.500.000 ]` cho user thu nhập không đều.
- Luôn ghi `income_source` vào `budget_plans` để audit.

### 6.2 Allocation engine

```go
func BuildPlan(in PlanInput) (Plan, error)

type PlanInput struct {
    Income        int64
    FixedTotal    int64
    SavingsTarget int64
    Intents       []CategoryIntent   // đã resolve precedence xong
    Confidence    string             // low | medium | high
}
```

Thứ tự các bước — **cố định, không được đảo**:

```
1. disposable = income - fixedTotal - savingsTarget
   Nếu disposable <= 0 → lỗi E_DISPOSABLE_NONPOSITIVE (chặn ở client trước).

2. raw[i] = intent amount trung tâm
   - source=preset  → presetShare[i] * disposable
   - source=history → median chi tiêu tháng của category đó
   - source=stated  → số user nói (đã normalize về /chu kỳ)
   - source=manual  → số user kéo

3. capAllocatable = disposable * (1 - MinUnallocatedShare)   // MinUnallocatedShare = 0.12

4. Nếu sum(raw của các item KHÔNG locked) + sum(locked) > capAllocatable:
     - Chỉ scale các item KHÔNG locked, theo tỉ lệ.
     - Nếu riêng sum(locked) đã > capAllocatable → KHÔNG scale gì cả,
       trả về Result.OverCommitted = true + thiếu bao nhiêu.
       (User khai số tuyệt đối → tự ý giảm là phá ý định của họ. Hiện cảnh báo, để họ quyết.)

5. Sàn: mọi item >= MinAmountPerCategory (50.000đ).
   Nâng lên sàn, shrink các item không locked & trên sàn theo tỉ lệ. Lặp tới khi hội tụ
   (tối đa n vòng). Nếu không còn gì để shrink → chấp nhận thiếu, set ScaledDown = true.

6. Trần: không item nào > MaxShareOfIncome (50%) * disposable, TRỪ KHI chỉ có 1 item.
   Phần cắt đi thành dự phòng, KHÔNG chia lại cho item khác.

7. Dải min–max: xem §6.4

8. Làm tròn: xem §6.3  (chạy SAU cùng, trên cả min lẫn max)

9. unallocated = disposable - sum(amount_max)
   Invariant: sum(amount_max) + unallocated == disposable, CHÍNH XÁC.
```

**`ScaledDown` chỉ được `true` khi thực sự có ít nhất 1 đồng bị giảm.** (Bug B3 ở code hiện tại: trả `true` ngay cả khi vòng lặp không giảm được gì.)

### 6.3 Quantization — làm tròn kiểu VND

```go
// Bậc làm tròn theo độ lớn. Đây là business rule — phải có test riêng.
func roundStep(a int64) int64 {
    switch {
    case a <    100_000: return   5_000
    case a <  1_000_000: return  10_000
    case a < 10_000_000: return  50_000
    default:             return 100_000
    }
}

// Quantize: floor về bậc rồi trả lại phần dư theo largest-remainder.
// Bảo đảm: mọi amount là bội của bậc; tổng KHÔNG vượt cap; không phá sàn.
func Quantize(raw []int64, locked []bool, floor, cap int64) []int64 {
    n := len(raw)
    out  := make([]int64, n)
    step := make([]int64, n)
    rem  := make([]int64, n)
    var total int64

    for i := range raw {
        if locked[i] {                        // "đúng 500k" của user — không đụng
            out[i] = raw[i]
            total += out[i]
            continue                          // step[i] = 0 → bị bỏ qua ở vòng 2
        }
        s := roundStep(raw[i])                // FREEZE step từ raw, tránh dao động
        step[i] = s
        out[i] = raw[i] / s * s               // floor về bậc
        if out[i] < floor {
            out[i] = (floor + s - 1) / s * s  // nâng lên sàn, vẫn là bội của s
        }
        rem[i] = raw[i] - out[i]
        total += out[i]
    }

    for _, i := range argsortDesc(rem) {      // ưu tiên item bị cắt nhiều nhất
        if step[i] == 0 { continue }
        if rem[i]*2 < step[i] { continue }    // mất dưới nửa bậc → thôi
        if total+step[i] > cap { continue }
        out[i] += step[i]
        total  += step[i]
    }
    return out
}
```

**Invariant bắt buộc — property test, fuzz `income ∈ [100k, 1 tỷ]`, `n ∈ [1, 20]`, 10.000 case:**

| # | Invariant |
|---|---|
| I1 | `out[i] % roundStep(raw[i]) == 0` với mọi `i` không locked |
| I2 | `Σ out[i] ≤ cap` |
| I3 | `out[i] ≥ MinAmountPerCategory` với mọi `i` |
| I4 | `Σ out[i] + unallocated == disposable` **chính xác tuyệt đối** |
| I5 | Cùng input → cùng output, 1000 lần liên tiếp, byte-identical |
| I6 | `locked[i] == true ⟹ out[i] == raw[i]` |

### 6.4 Dải min–max

```go
func band(center int64, source IntentSource, hist *HistoryStats) (min, max int64) {
    switch {
    case source == SourceStated || source == SourceManual:
        return center, center                    // user đã chốt → không có dải
    case source == SourceHistory && hist != nil && hist.Months >= 3:
        return hist.P40, hist.P75                // dải THẬT từ dữ liệu
    case source == SourceHistory:
        return center*92/100, center*110/100     // ±8% / +10%
    default: // preset — độ tin cậy thấp nhất → dải rộng nhất
        return center*85/100, center*115/100
    }
}
```

Sau đó cả `min` và `max` đều đi qua `Quantize` với cùng `step`.

### 6.5 Trạng thái tiêu dùng theo dải (dùng ở mọi bề mặt hiển thị)

| Điều kiện | Trạng thái | Copy | Màu |
|---|---|---|---|
| `spent < min` | `under` | "còn thoải mái" | neutral |
| `min ≤ spent ≤ max` | `in_band` | "đang trong khoảng ổn" | neutral |
| `max < spent ≤ max*1.15` | `over_edge` | "vượt mép trên {X}đ" | amber |
| `spent > max*1.15` | `over` | "vượt {X}đ" | amber đậm |

**Không dùng đỏ ở bất kỳ trạng thái nào** (P-07). Đỏ để dành cho lỗi hệ thống.

---

## 7. Luồng UI — P2 (`hot`) — 1 màn, ~20 giây

### 7.1 Màn confirm duy nhất

```
┌──────────────────────────────────────────────┐
│  Tôi đã xem 3 tháng chi tiêu của bạn     ✕   │
│                                               │
│  Thu nhập (trung vị 5 tháng)  12.000.000 ✏️  │
│  Chi phí cố định               2.500.000 ✏️  │
│  Tiết kiệm                     2.000.000 ✏️  │
│  ──────────────────────────────────────      │
│  Còn được chi                  7.500.000     │
│                                250.000đ/ngày │
│                                               │
│                   đề xuất    thực tế 3 tháng │
│  🍜 Ăn uống      3.100.000    3.250.000  ●●● │
│  ☕ Cafe           900.000    1.150.000  ●●● │
│  🚗 Di chuyển      800.000      790.000  ●●● │
│  🛍 Mua sắm      1.200.000    1.400.000  ●●● │
│  ⋯ Chi khác        600.000      580.000  ●●○ │
│  ──────────────────────────────────────      │
│  🛟 Dự phòng       900.000                   │
│                                               │
│  [ Chỉnh chi tiết ]      [ Dùng luôn ]       │
└──────────────────────────────────────────────┘
```

**Cột "thực tế" là toàn bộ giá trị của màn này.** Nó vừa tạo trust (app không bịa) vừa tự thuyết phục (user tự thấy Cafe lệch, AI không cần lên lớp).

**Quy tắc tính cột "đề xuất" cho `hot`:**
- Mặc định = `median` chi tiêu thực tế của category đó.
- Nếu `Σ median > capAllocatable` → giảm **chỉ nhóm tuỳ ý** (Cafe/Giải trí/Mua sắm) theo tỉ lệ, KHÔNG giảm nhóm bắt buộc (Ăn/Di chuyển/Sức khoẻ). Ghi rõ trên UI: _"Tôi giảm Cafe và Mua sắm để vừa thu nhập."_
- Category có < 8 transaction trong 90 ngày → dùng preset, badge `●●○`.

### 7.2 Phân loại category (dùng ở §7.1 và §8)

```go
type CategoryClass string
const (
    ClassFixed      CategoryClass = "fixed"       // nhà, bill, học phí — trừ trước, KHÔNG budget
    ClassEssential  CategoryClass = "essential"   // ăn, di chuyển, sức khoẻ — co giãn ít
    ClassDiscretion CategoryClass = "discretion"  // cafe, giải trí, mua sắm — cắt được
)
```

Map bằng keyword, **phải là slice có thứ tự, không phải map** (xem §11 bug B1). Khi cắt giảm luôn theo thứ tự `discretion` → `essential`, không bao giờ đụng `fixed`.

---

## 8. VÒNG LẶP HỘI TỤ — phần quan trọng nhất của v2

Vì P1 là user chính, budget lần đầu chắc chắn lệch. Đây là cơ chế biến cái lệch đó từ **lý do churn** thành **lý do quay lại**.

### 8.1 Lịch check-in

| Mốc | Áp dụng cho | Điều kiện chạy | Bỏ qua nếu |
|---|---|---|---|
| **Ngày 7** | `cold` | ≥ 5 transaction trong 7 ngày | < 5 tx (không đủ tín hiệu để kết luận) |
| **Ngày 14** | `cold`, `warm` | ≥ 10 transaction | đã calibrate ở ngày 7 và độ lệch < 10% |
| **Cuối chu kỳ** | tất cả | luôn chạy | < 8 tx cả chu kỳ |

Mỗi mốc = **1 notification + 1 card trong AI Chat**. Không bao giờ là modal chặn màn hình.

### 8.2 Nội dung check-in ngày 7 (P1)

```
┌──────────────────────────────────────────────┐
│  7 ngày đầu — tôi xem thử nhé                │
│                                               │
│  Bạn đã chi 2.150.000đ.                      │
│  Theo đà này cả tháng khoảng 9.200.000đ,     │
│  trong khi kế hoạch là 8.300.000đ.           │
│                                               │
│  ☕ Cafe & Giải trí   nhanh hơn 40%          │
│  🍜 Ăn uống           nhanh hơn 18%          │
│  🚗 Di chuyển         đúng nhịp              │
│                                               │
│  Ngân sách tuần trước là tôi ước lượng khi   │
│  chưa biết thói quen của bạn. Giờ có số thật │
│  rồi, chỉnh lại cho sát nhé?                 │
│                                               │
│  [ Chỉnh theo thực tế ]                      │
│  [ Giữ kế hoạch, tôi sẽ giảm chi ]           │
│  [ Để sau ]                                   │
└──────────────────────────────────────────────┘
```

**Copy bắt buộc theo P-02:** _"Ngân sách tuần trước là **tôi** ước lượng"_ — chủ ngữ là AI. Không bao giờ _"bạn đã tiêu quá"_.

**Công thức ngoại suy:**
```
elapsedDays   = số ngày đã qua trong chu kỳ
projected[i]  = spent[i] / elapsedDays * totalDaysInCycle
pace[i]       = projected[i] / amount_max[i] - 1     // +0.40 = nhanh hơn 40%
```
Chỉ liệt kê category có `|pace| ≥ 0.15`. Tối đa 3 dòng. Còn lại gộp `"các mục khác đúng nhịp"`.

### 8.3 Hành động "Chỉnh theo thực tế" — BẮT BUỘC zero-sum (P-04)

Đây là guardrail chống vòng xoáy chết *"budget cứ chạy theo chi tiêu đến khi vô nghĩa"*.

```
┌──────────────────────────────────────────────┐
│  Chỉnh Cafe & Giải trí                       │
│  1.150.000  →  1.450.000   (+300.000)        │
│                                               │
│  Phải lấy 300.000đ từ đâu đó:                │
│                                               │
│  ○ 🛟 Dự phòng        1.000.000 → 700.000    │
│       (khuyên dùng — không ảnh hưởng gì khác)│
│  ○ 🛍 Mua sắm           900.000 → 600.000    │
│  ○ 📈 Tiết kiệm       1.200.000 → 900.000    │
│       ⚠️ giảm 25% mục tiêu tiết kiệm         │
│                                               │
│              [ Huỷ ]      [ Xác nhận ]        │
└──────────────────────────────────────────────┘
```

**Quy tắc cứng:**
- Thứ tự nguồn bù mặc định: `Dự phòng` → `discretion` khác → `essential` → `Tiết kiệm` (cuối cùng, luôn kèm cảnh báo).
- Nếu nguồn bù duy nhất còn lại là `Tiết kiệm` → **phải hiện cảnh báo rõ ràng**, không được để nó là lựa chọn im lặng.
- **Không bao giờ** nâng budget mà tổng vượt `disposable`.
- Mỗi lần xác nhận → tạo `budget_plans` version mới (`parent_plan_id` trỏ về bản cũ), plan cũ `superseded_at = now()`. Bulk-replace `budgets`. Lịch sử giữ nguyên để user xem được mình đã chỉnh gì.

=> trong 8.3 thì ko chỉ riêng việc cắt bớt của 1 khoản khác, thì hoan toaà co thể cắt bớt từ nhiều khoản khác nhau để chia cho đủ với category user muốn tăng budget

### 8.4 Hành động "Giữ kế hoạch, tôi sẽ giảm chi" — phải có thật

Không được chỉ đóng dialog. Phải trả về mục tiêu mới, cụ thể:

```
Rõ. Để về đúng 8.300.000đ, từ giờ đến hết tháng
bạn còn 265.000đ/ngày (thay vì 276.000đ).

Riêng Cafe: còn 24.000đ/ngày.
```

Và set cờ `user_committed_to_reduce = true` → **bỏ qua check-in ngày 14** (đã hỏi rồi, hỏi nữa là phiền), chỉ gặp lại ở cuối chu kỳ.

### 8.5 Cuối chu kỳ

```
┌──────────────────────────────────────────────┐
│  Tháng 9 của bạn                             │
│                                               │
│  ✅ Tiết kiệm     1.200k / 1.200k  đúng KH   │
│  ✅ Ăn uống       3.020k / 3.300k  dư 280k   │
│  ⚠️ Cafe          1.480k / 1.150k  vượt 330k │
│  ✅ Di chuyển       760k /   900k            │
│  ✅ Mua sắm         840k /   900k            │
│                                               │
│  Độ chính xác của tôi tháng này: 82%         │
│                                               │
│  Cafe vượt 2 tháng liền (~1.45M).            │
│  Ngân sách 1.150k có vẻ chưa thực tế.        │
│                                               │
│  [ Nâng Cafe lên 1.450k ]                    │
│  [ Giữ nguyên ]                               │
│  [ Xem đề xuất cắt chỗ khác ]                │
└──────────────────────────────────────────────┘
```

- **"Độ chính xác của tôi tháng này: 82%"** — `100% − mean(|actual−budget| / budget)`. Công khai chỉ số này là cách mạnh nhất để thể hiện P-02, và nó tự tăng qua từng chu kỳ → user thấy app đang học.
- Chỉ đề nghị chỉnh khi **lệch cùng chiều ≥ 2 chu kỳ liên tiếp**. Một tháng bất thường không phải xu hướng.
- Nút "Nâng…" vẫn đi qua dialog zero-sum §8.3.
- Nếu `Σ actual < disposable` đáng kể (dư > 10%) → **chủ động đề nghị nâng tiết kiệm**: _"Bạn dư 900k tháng này. Nâng tiết kiệm từ 1.2M lên 1.5M nhé?"_ Đây là cách đưa user từ 10% lên 20% mà không ép ngay từ đầu.

---

## 9. Mode P3 — nhập bằng ngôn ngữ tự nhiên

Không phải branch riêng. Là **một lối vào** có ở màn 2 (P1) và ở "Chỉnh chi tiết" (P2).

### 9.1 UI hai bước

```
BƯỚC 1 — gõ
┌──────────────────────────────────────────────┐
│  Kể tôi nghe cách bạn tiêu tiền              │
│  ┌────────────────────────────────────────┐ │
│  │ ăn sáng 35k mỗi ngày, ăn trưa 35k 5    │ │
│  │ lần/tuần, cafe 25k 3 lần/tuần, đổ xăng │ │
│  │ 3 ngày 1 lần, shopping ít nhất 500k    │ │
│  └────────────────────────────────────────┘ │
│  💡 Nói tự nhiên, ví dụ: "ăn trưa 35k,      │
│     5 ngày một tuần"                         │
│                              [ Phân tích → ] │
└──────────────────────────────────────────────┘

BƯỚC 2 — xác nhận từng dòng  (BẮT BUỘC, không được bỏ)
┌──────────────────────────────────────────────┐
│  Tôi hiểu như này, sai chỗ nào bạn sửa nhé   │
│                                               │
│  ✏️ Ăn sáng    35.000 × 7/tuần  = 1.060.000  │
│      └ bạn nói: "ăn sáng 35k mỗi ngày"       │
│  ✏️ Ăn trưa    35.000 × 5/tuần  =   760.000  │
│  ✏️ Cafe       25.000 × 3/tuần  =   325.000  │
│  ✏️ Mua sắm   ≥500.000 × 1/tháng =  500.000  │
│  ⚠️ Đổ xăng      ???   × 10/tháng            │
│      Bạn còn 598.000đ cho mục này            │
│      [ 50k ] [ 60k ] [ 70k ] [ nhập số ]     │
│                                               │
│  🗑 Xoá dòng    ➕ Thêm dòng                  │
│                          [ Tiếp → ]           │
└──────────────────────────────────────────────┘
```

**Ba chi tiết quyết định thành bại:**
1. **Mỗi dòng sửa được inline.** LLM sẽ nghe `35k` thành `350k`. Không sửa được từng dòng → user phải làm lại từ đầu → không quay lại.
2. **Chỗ thiếu thì HỎI, kèm gợi ý có căn cứ** ("bạn còn 598.000đ → khoảng 60k/lần"). **Tuyệt đối không bịa số.** Đây là khoảnh khắc tạo ấn tượng mạnh nhất của cả feature.
3. **Hiện nguyên văn user nói** (`raw_span`) dưới mỗi dòng để đối chiếu.

### 9.2 LLM Extractor — ranh giới cứng

**Model:** gpt-oss-120b. **`temperature = 0`, `seed` cố định, guided/structured JSON decoding** (vLLM `guided_json`). Không bao giờ parse free text rồi `json.Unmarshal` cầu may.

```json
{
  "items": [{
    "label":       "ăn trưa",
    "amount_min":  35000,
    "amount_max":  35000,
    "freq_count":  5,
    "freq_unit":   "week",
    "freq_every":  1,
    "kind":        "expense",
    "constraint":  "exact",
    "category_hint": "Ăn uống",
    "missing":     [],
    "raw_span":    "ăn trưa 35k 5 lần 1 tuần",
    "confidence":  0.95
  }],
  "income":  null,
  "savings": null
}
```

| Field | Giá trị hợp lệ |
|---|---|
| `freq_unit` | `day` \| `week` \| `month` \| `n_days` \| `n_weeks` |
| `freq_every` | `≥1` — "mỗi 2 tuần" → `unit=week, every=2, count=1` |
| `constraint` | `exact` \| `at_least` \| `at_most` |
| `kind` | `expense` \| `saving` \| `income` |
| `missing` | tập con của `["amount","frequency"]` |

**System prompt — quy tắc tuyệt đối:**
```
BẠN CHỈ TRÍCH XUẤT. BẠN KHÔNG TÍNH TOÁN.
- KHÔNG nhân, chia, cộng bất kỳ số nào.
- KHÔNG quy đổi tuần sang tháng.
- KHÔNG suy đoán số tiền người dùng không nói. Thiếu thì ghi vào "missing".
- KHÔNG điền giá trị mặc định.
- "35k" = 35000. "1tr" / "1 triệu" = 1000000. "1m" = 1000000.
- "25-35k" → amount_min=25000, amount_max=35000.
- "ít nhất 500k" → constraint="at_least".
- Giữ nguyên văn người dùng vào raw_span.
```

**Few-shot:** 10–12 ví dụ tiếng Việt đúng văn phong thật (`"35k"`, `"mỗi 2 tuần"`, `"3 ngày đổ xăng 1 lần"`, `"cafe 9 lần 1 tháng"`, `"tiền nhà 2tr5"`).

### 9.3 Cross-check bằng regex — bắt buộc

LLM nghe nhầm số là rủi ro lớn nhất. Chạy một regex pre-parser độc lập và đối chiếu:

```go
var amountRe = regexp.MustCompile(`(?i)(\d+(?:[.,]\d+)?)\s*(k|nghìn|ngàn|tr|triệu|m|đ|vnd|d)\b`)
```

- Nếu `amount` LLM trả về **không nằm** trong tập số regex tìm thấy → set `confidence = 0.3`, đánh dấu dòng đó `⚠️ cần kiểm tra`, và **highlight nó lên đầu danh sách** ở bước xác nhận.
- Nếu regex tìm ra số mà LLM bỏ sót hoàn toàn → thêm một dòng trống `⚠️ "…60k…" — đây là khoản gì?`

### 9.4 Normalizer (Go, `int64`, deterministic)

```go
const WeeksPerMonthNum = 52   // 52/12 — là BUSINESS RULE, không phải lựa chọn của model
const WeeksPerMonthDen = 12

func ToMonthly(amount int64, count int, unit string, every int) int64 {
    if every < 1 { every = 1 }
    switch unit {
    case "day":     return amount * int64(count) * 365 / 12 / int64(every)
    case "week":    return amount * int64(count) * WeeksPerMonthNum / WeeksPerMonthDen / int64(every)
    case "month":   return amount * int64(count) / int64(every)
    case "n_days":  return amount * 365 / 12 / int64(every)
    case "n_weeks": return amount * WeeksPerMonthNum / WeeksPerMonthDen / int64(every)
    }
    return 0
}
```

Quy đổi phải **hiện cho user thấy**: _"quy đổi 4,33 tuần/tháng"_ ở footer bước xác nhận. Không giấu.

### 9.5 Bảo mật

- Cap độ dài input **2.000 ký tự**.
- Text gốc **chỉ** đi vào Extractor. Tuyệt đối **không** đưa vào bất kỳ prompt nào khác (đặc biệt là Advisor nếu sau này có) → chặn prompt injection ở tầng kiến trúc thay vì tầng prompt.
- Output extractor đi qua schema → không có đường thoát ra ngoài dạng free text.
- Rate limit: dùng chung `AIChatRateLimiter`.

---

## 10. Tích hợp thời điểm chi tiêu — ROI cao nhất toàn feature

Bề mặt đã có sẵn: màn AI Chat nhập transaction. User **đã gõ vào đó rồi** — chỉ cần trả thêm 2 dòng. Zero effort thêm từ user, tác động lớn nhất lên hành vi.

**Hiện tại:**
```
✓ phindi almond coffee    −55.000đ
```

**Phải thành:**
```
✓ phindi almond coffee    −55.000đ   [☕ Cafe & Giải trí]
─────────────────────────────────────────
☕ 640k / 900k  ███████░░░  hôm nay còn 12.000đ
💸 Hôm nay còn 95.000đ
```

**Trường hợp đã vượt:**
```
☕ 980k / 900k  ██████████  vượt 80.000đ
💸 Hôm nay còn 95.000đ · 17 ngày còn lại: 178.000đ/ngày
```

**Quy tắc:**
- Chỉ hiện dòng budget nếu category đó **có** budget trong plan đang active.
- Luôn hiện **`còn hôm nay`**, không phải `còn tháng này` (P-06).
- Công thức: `remainingToday = (amount_max − spentThisCycle) / daysLeftInCycle`, làm tròn xuống bậc 1.000đ.
- Khi vượt: nêu sự thật + con số đi tiếp. **Không** màu đỏ, **không** emoji buồn, **không** dấu than (P-07).
- Dòng `💸 Hôm nay còn X` là tổng toàn bộ disposable, luôn hiện kể cả category không có budget.

---

## 11. Bug bắt buộc phải fix trong code hiện tại

| # | Vị trí | Vấn đề | Fix |
|---|---|---|---|
| **B1** | `budgetproposal.categoryBaseline()` | `for pattern := range common.BudgetWizardCategoryBaselines` — **Go randomize map iteration order**. Category `"Cafe & Ăn uống"` match cả `"cafe"` lẫn `"ăn uống"` → **mỗi lần chạy ra kết quả khác nhau**. Package tự nhận deterministic nhưng không phải. | Đổi sang `[]struct{Pattern string; Share float64}` sắp xếp **longest-pattern-first**, duyệt tuần tự, lấy match đầu tiên. Thêm test khẳng định thứ tự ổn định. |
| **B2** | `budgetproposal.Compute()` | Dùng `float64` toàn bộ rồi `int64(amounts[i])` truncate → `Σ Entries.Amount + UnallocatedAmount ≠ income`. Vi phạm nguyên tắc #4 của project (tiền = integer). | Chuyển toàn bộ sang `int64` VND. Chia tỉ lệ bằng `a * num / den` (nhân trước chia sau). `unallocated` hấp thụ toàn bộ phần lẻ → I4 luôn đúng. |
| **B3** | `enforceUnallocatedFloor()` | `return true` ngay cả khi vòng lặp không giảm được đồng nào (mọi entry đã ở sàn) → `ScaledDown` nói dối → UI cảnh báo sai. | Đếm số tiền thực sự giảm; `return reduced > 0`. |
| **B4** | `applyFloor()` | Sau khi shrink không re-check trần ở Step 3. Chuỗi floor→ceiling→floor không có chứng minh hội tụ. | Đổi sang vòng lặp `for { applyFloor; applyCeiling; if stable break }` với `maxIter = n+2`, và test hội tụ trên fuzz input. |
| **B5** | Spec v1 §5 vs §6 | §5 ghi *"integer, in cents internally"*, §6 example `"income": 20000000` với `"currency":"VND"`. Nếu là xu thì = 200.000đ — vô nghĩa. **VND không có đơn vị nhỏ hơn đồng.** | **Chốt: `int64` đồng.** Xoá mọi chữ "cents"/"xu" khỏi spec và code. Thêm comment ở struct để tránh tái phạm. |
| **B6** | Spec v1 §6.3 vs code | Spec mô tả *weighted pool* (chia tỉ lệ tương đối), code đã đổi sang *absolute target share*. Dev đọc spec sẽ implement sai. | Spec này (§6.2) là nguồn sự thật duy nhất. Đánh dấu §6.3 của v1 là **superseded**. |
| **B7** | `reasoningFor()` | `"AI đề xuất mức chi tiêu tiêu biểu… dựa trên tỷ lệ ngân sách thông thường"` — câu này không mang thông tin nào, là filler text. | Thay bằng `evidence` cụ thể (§4.2). Không có evidence thật thì **bỏ hẳn dòng đó**, chỉ để badge `○○○ ước lượng`. |

---

## 12. API

### 12.1 `GET /api/v1/ai/budget-wizard/prefill` — mở rộng

```json
{
  "success": true,
  "data": {
    "default_currency": "VND",
    "persona": "cold",
    "income_suggestion": {
      "median": 12000000, "lowest": 10500000, "months": 5, "reliable": true
    },
    "fixed_suggestion": 2500000,
    "history": [
      { "category_id": "uuid", "name": "Ăn uống",
        "median_monthly": 3250000, "p40": 3100000, "p75": 3500000,
        "tx_count_90d": 54, "avg_per_tx": 53000 }
    ],
    "presets": [
      { "key": "rented_eating_out", "label": "Ở trọ, đi làm, ăn ngoài là chính", "icon": "🏙",
        "shares": [{ "category_name": "Ăn uống", "share": 0.40 }] }
    ],
    "categories": [],
    "existing_plan": null
  }
}
```

Không gọi AI Service. Thêm 2 query: income stats (§6.1) + per-category spending stats.

### 12.2 `POST /api/v1/ai/budget-wizard/parse` — MỚI

```json
// request
{ "text": "lương 12m, để dành 5m, ăn sáng 35k mỗi ngày…" }

// response
{ "success": true, "data": {
  "items": [ /* §9.2 schema, đã normalize sang monthly + đã map category_id */ ],
  "income": 12000000,
  "savings": 5000000,
  "needs_input": [
    { "label": "đổ xăng", "field": "amount",
      "hint": "khoảng 10 lần/tháng, bạn còn 598.000đ cho mục này",
      "suggestions": [50000, 60000, 70000] }
  ],
  "warnings": [
    { "item_index": 2, "code": "AMOUNT_UNVERIFIED",
      "message": "Số tiền chưa khớp với nguyên văn — bạn kiểm tra giúp" }
  ]
}}
```

Rate limit chung với AI Chat. Timeout 15s → 504 `UPSTREAM_TIMEOUT`, client cho retry, **không** dismiss modal.

### 12.3 `POST /api/v1/ai/budget-proposals` — đổi payload

```json
{
  "income": 12000000,
  "fixed_total": 2500000,
  "savings_target": 1200000,
  "currency": "VND",
  "period": "monthly",
  "cycle_start_day": 1,
  "profile_preset": "rented_eating_out",
  "intents": [
    { "category_id": "uuid", "category_name": "Ăn uống",
      "source": "preset", "amount_min": 0, "amount_max": 0, "locked": false }
  ]
}
```

`source="preset"` + `amount=0` → engine tự điền từ bảng preset. `source="stated"` → dùng số đã cho.
**Chạy hoàn toàn trong Go** (`budgetproposal` package), không round-trip sang AI Service.

### 12.4 `POST /api/v1/budgets/bulk` — mở rộng

Thêm `plan` object vào request; service tạo `budget_plans` + `budget_plan_items` **trong cùng transaction** với bulk-replace `budgets`. Giữ nguyên `SELECT … FOR UPDATE` và toàn bộ error case của spec v1.

### 12.5 `GET /api/v1/budgets/calibration` — MỚI

```json
{ "success": true, "data": {
  "should_show": true,
  "checkpoint": "day_7",
  "elapsed_days": 7, "total_days": 30,
  "spent_total": 2150000, "projected_total": 9214000, "planned_total": 8300000,
  "accuracy_pct": null,
  "items": [
    { "category_id": "uuid", "name": "Cafe & Giải trí",
      "spent": 420000, "projected": 1800000, "planned_max": 1150000, "pace": 0.40 }
  ],
  "suggestion": {
    "type": "raise", "category_id": "uuid", "from": 1150000, "to": 1450000,
    "funding_options": [
      { "source": "buffer",   "category_id": null, "from": 1000000, "to": 700000, "recommended": true },
      { "source": "category", "category_id": "uuid-mua-sam", "from": 900000, "to": 600000 },
      { "source": "savings",  "category_id": null, "from": 1200000, "to": 900000, "warning": "giảm 25% mục tiêu tiết kiệm" }
    ]
  }
}}
```

### 12.6 `POST /api/v1/budgets/calibration/apply` — MỚI

```json
{ "action": "raise", "category_id": "uuid", "new_amount": 1450000,
  "funding": { "source": "buffer" } }
// hoặc
{ "action": "commit_reduce" }   // "tôi sẽ giảm chi"
{ "action": "dismiss" }
```

Server **phải** validate lại toàn bộ ràng buộc zero-sum. Không tin client.

---

## 13. Notification policy

| Khi nào | Nội dung | Trần |
|---|---|---|
| 8:00 hàng ngày (opt-in, **mặc định TẮT**) | "Hôm nay bạn có 276.000đ" | 1/ngày |
| Category dùng ≥ 50% trước khi qua 40% chu kỳ | "Cafe đã dùng 50% mà mới ngày 9" | 1/category/chu kỳ |
| Ngày 7 / ngày 14 (P1) | Card calibration §8.2 | 1/mốc |
| Cuối chu kỳ | Tổng kết §8.5 | 1/chu kỳ |
| **KHÔNG GỬI** | Mỗi lần vượt budget | — |

**Trần cứng: tối đa 2 notification/tuần ngoài daily digest.** Notification opt-out là chỉ báo sớm nhất của churn — bảo vệ nó như bảo vệ tài nguyên khan hiếm.

---

## 14. Edge cases

| # | Tình huống | Xử lý |
|---|---|---|
| E-01 | `fixed + savings ≥ income` | Chặn ở màn 1, message cụ thể. Không cho Next. |
| E-02 | `disposable` quá nhỏ (< 6 × 50.000đ) | Cảnh báo + ép giảm số category xuống ≤ `disposable/50.000`. |
| E-03 | User chọn > 7 category | Cảnh báo + gợi ý gộp cụ thể. Không block. |
| E-04 | User `cold` gõ NL nhưng LLM không trích được gì | Fallback về preset, message: _"Tôi chưa hiểu được. Chọn giúp tôi hoàn cảnh sống nhé."_ Không hiện lỗi kỹ thuật. |
| E-05 | NL cho ra tổng > disposable | **KHÔNG scale xuống.** Hiện `OverCommitted`: _"Bạn khai 9,2tr nhưng chỉ còn 8,3tr. Cần cắt 900k ở đâu?"_ + gợi ý cắt `discretion` trước. |
| E-06 | Trùng lặp: user vừa nói "ăn trưa 35k×5" vừa nói "ăn uống 3tr" | Detect 2 item map về cùng `category_id` → hỏi: _"Bạn nói 'ăn uống 3tr' — số này đã gồm ăn trưa chưa?"_ `[Đã gồm]` / `[Riêng]`. |
| E-07 | Thu nhập không đều (freelance) | `Months ≥ 3` và `(median−lowest)/median > 0.25` → chủ động gợi ý dùng `lowest`: _"Thu nhập của bạn thay đổi nhiều. Lập kế hoạch theo tháng thấp nhất cho an toàn?"_ |
| E-08 | Chi tiền mặt không ghi → history thiếu | Ở màn P2, luôn kèm: _"Dựa trên 54 giao dịch. Nếu bạn có chi tiền mặt chưa ghi, số thật có thể cao hơn."_ |
| E-09 | Check-in ngày 7 nhưng < 5 transaction | **Bỏ qua hoàn toàn**, không notification. Dữ liệu không đủ để kết luận. |
| E-10 | User dismiss calibration 2 lần liên tiếp | Ngừng calibration card trong chu kỳ đó. Chỉ gặp lại ở cuối chu kỳ. |
| E-11 | `cycle_start_day = 28` gặp tháng 2 | `daysInCycle` tính từ ngày bắt đầu tới ngày bắt đầu kế tiếp. Không hardcode 30. |
| E-12 | User đổi income giữa chu kỳ | Tạo plan version mới, `daysLeft` tính lại từ hôm nay. Chi tiêu đã phát sinh giữ nguyên. |
| E-13 | Category bị xoá sau khi plan đã tạo | `budget_plan_items` giữ nguyên (audit), enforcement bỏ qua item đó, calibration không tính. |
| E-14 | Timezone | Mọi tính toán ngày dùng `Asia/Ho_Chi_Minh`, không dùng UTC. "Hôm nay còn X" tính theo giờ local của user. |
| E-15 | Plan active trùng lặp (2 device submit cùng lúc) | `uq_active_plan` partial unique index chặn. Submit sau thắng, submit trước bị `superseded_at`. |

---

## 15. Definition of Done

### Engine
- [ ] Toàn bộ `budgetproposal` dùng `int64` VND. Không còn `float64` ở đường tính tiền.
- [ ] Fix B1–B7.
- [ ] `Quantize()` pass 6 invariant I1–I6, property test 10.000 case ngẫu nhiên.
- [ ] Test: cùng input → output byte-identical qua 1.000 lần chạy (chống B1 tái phát).
- [ ] Test: `disposable ≤ 0`, 1 category, 20 category, tất cả `locked`, `locked` vượt cap.
- [ ] Test 4 preset profile × 5 mức thu nhập (3tr / 8tr / 12tr / 25tr / 100tr) → không ra số lẻ, không vi phạm sàn/trần.

### Wizard
- [ ] P1 hoàn thành trong ≤ 3 màn, đo được ≤ 45 giây (test với 5 người thật).
- [ ] Màn 1 hiện `đ/ngày` realtime khi gõ.
- [ ] Dòng ⓘ "đây là ước lượng" hiện với mọi user `cold`.
- [ ] Badge nguồn (`○○○` / `●●○` / `●●●`) đúng cho từng dòng.
- [ ] P2 (`hot`) có màn confirm 1 bước với cột "thực tế".
- [ ] Cảnh báo khi chọn > 7 category.
- [ ] Sửa tay một dòng **không** làm các dòng khác tự đổi.

### NL mode
- [ ] Eval set **100 câu tiếng Việt thật**, đo per-field precision/recall.
  **Gate ship: `amount` ≥ 95%, `freq_count` ≥ 90%, `freq_unit` ≥ 90%.** Dưới ngưỡng → không ship mode này, không phải "ship rồi sửa sau".
- [ ] Regex cross-check hoạt động, flag được case `35k → 350k`.
- [ ] Trường thiếu → hiện `needs_input` + gợi ý có căn cứ. **Không bịa số** (test riêng).
- [ ] Mỗi dòng sửa/xoá được inline trước khi tính.

### Calibration
- [ ] Check-in ngày 7 chạy đúng cho `cold`, bỏ qua khi < 5 transaction.
- [ ] Dialog zero-sum: **không có đường nào nâng budget mà không lấy từ nguồn khác**.
- [ ] Chọn nguồn = Tiết kiệm → luôn có cảnh báo.
- [ ] "Tôi sẽ giảm chi" trả về mục tiêu `đ/ngày` mới, không phải chỉ đóng dialog.
- [ ] Plan versioning: `parent_plan_id`, `superseded_at` đúng; xem lại được lịch sử chỉnh.
- [ ] Chỉ đề nghị chỉnh khi lệch cùng chiều ≥ 2 chu kỳ.

### Moment-of-spend
- [ ] Sau khi confirm transaction, chat trả thêm dòng budget category + dòng `Hôm nay còn X`.
- [ ] Không màu đỏ, không emoji buồn ở mọi trạng thái.
- [ ] Category không có budget → không hiện dòng budget, vẫn hiện `Hôm nay còn X`.

---

## 16. Metrics — đo cái này, KHÔNG đo completion rate

| Metric | Ngưỡng tốt | Vì sao |
|---|---|---|
| **Sai số chu kỳ 1** — `mean(\|actual−budget\|/budget)` | < 30% (P1), < 20% (P2) | Thước đo AI có giỏi thật không. |
| **Sai số chu kỳ 1 → 2 → 3** | phải **giảm đơn điệu** | Chứng minh vòng lặp học hoạt động. Đây là metric quan trọng nhất của v2. |
| **Tỉ lệ mở lại calibration chu kỳ 2** | > 40% | Không ai quay lại = feature chết. |
| **Notification opt-out sau 30 ngày** | < 15% | Chỉ báo sớm nhất của churn. |
| **Tỉ lệ sửa tay trong 7 ngày đầu** | < 30% | Sửa nhiều = đề xuất ban đầu dở. |
| **Tỉ lệ dùng "Chỉnh theo thực tế" vs "Để sau"** | > 50% chọn hành động | Đo chất lượng copy §8.2. |
| **Extraction accuracy (NL mode)** | `amount` ≥ 95% | Gate ship. |
| Completion rate wizard | *(chỉ theo dõi)* | **Vanity metric.** Hoàn thành wizard không tạo giá trị nào nếu budget sai và user bỏ ở tuần 2. |

---

## 17. Lộ trình — thứ tự theo độ ưu tiên persona

| Phase | Nội dung | Lý do thứ tự |
|---|---|---|
| **1** | Fix B1–B7 · `int64` · Quantization · **P1 3-màn + preset** · dòng moment-of-spend | P1 là user đông nhất. Quantization + bug fix là nợ kỹ thuật chặn mọi thứ khác. Moment-of-spend rẻ nhất mà tác động lớn nhất. |
| **2** | **Calibration ngày 7 / ngày 14 / cuối chu kỳ** · zero-sum dialog · plan versioning | Với P1, đây **là** sản phẩm, không phải tính năng phụ. Budget v1 sai là chắc chắn — phase này biến nó thành lý do quay lại. |
| **3** | **P2 màn confirm** + cột thực tế · income median/lowest | Tự nhiên đến sau: phải có user tích luỹ đủ 2 tháng data thì P2 mới tồn tại. |
| **4** | **NL mode (P3)** · extractor · regex cross-check · eval set | Ít user nhất, tốn công nhất, rủi ro accuracy cao nhất. Làm cuối, và chỉ ship khi qua gate 95%. |

---

## 18. Out of scope (v2)

- Budget theo hộ gia đình / chia sẻ giữa các member — **đã chốt: v2 chỉ cá nhân.** Nhưng khi thiết kế schema, giữ `budget_plans.user_id` để sau này thêm `household_id` không phải migrate phá vỡ.
- Multi-currency trong wizard (giữ nguyên giới hạn v1).
- Tự tạo Financial Goal (F-08) từ mục Tiết kiệm.
- LLM sinh reasoning cá nhân hoá — dùng `evidence` template. Nếu sau này thêm, LLM **chỉ được nhìn số đã tính**, và phải có verifier chặn số không nằm trong tập đã tính.
- Web client (Next.js) — follow-up.
- Undo sau submit (có plan versioning rồi thì đây thành khả thi, nhưng chưa làm UI ở v2).

---

## 19. Câu hỏi còn mở

| # | Câu hỏi | Ảnh hưởng | Giả định tạm |
|---|---|---|---|
| OQ-10 | Preset % (§5.3) lấy từ đâu — số tôi đề xuất là ước lượng theo bối cảnh VN, chưa có dữ liệu thật | Ảnh hưởng trực tiếp sai số chu kỳ 1 của **toàn bộ user P1** | Dùng bảng §5.3 cho v1. **Sau 200 user có ≥ 1 chu kỳ hoàn chỉnh, tính lại preset từ chính data đó** (median theo profile) và cập nhật. Đây nên là một task định kỳ. |
| OQ-11 | Cột "thực tế" của P2 — dùng median hay mean? | Median ổn định hơn nhưng bỏ qua tháng bất thường | Median. Kèm hiện `p40–p75` làm dải. |
| OQ-12 | Có nên cho user tắt hẳn calibration không? | Người ghét bị nhắc sẽ churn nếu bị ép | Có — setting "Nhắc tôi chỉnh ngân sách: Thường xuyên / Cuối chu kỳ / Không". Mặc định "Thường xuyên" cho `cold`. |
| OQ-13 | `Dự phòng` có nên cho user chi vào không (như một category thật)? | Nếu không, user chi vượt sẽ không biết ghi vào đâu | v2: không phải category. Chi vượt vẫn ghi vào category gốc và hiện trạng thái `over_edge`. Xem lại sau chu kỳ đầu. |

---

## 20. Đối chiếu với codebase thật — blindspot

_Thêm 2026-09-13. Mỗi dòng dưới đây đã được kiểm chứng trực tiếp trên code hiện tại, có dẫn `file:line`. Đây là những chỗ spec v2 đang mô tả một codebase **khác** với codebase đang có._

### 20.1 Bảng tổng hợp

| # | Mức | Spec v2 nói | Code thật | Hệ quả nếu implement nguyên văn |
|---|---|---|---|---|
| **BS-01** | 🔴 Chặn | §4.1 + B5: `income bigint -- VND, int64 đồng. KHÔNG phải xu.` Xoá mọi chữ "xu" khỏi code. | **Toàn hệ thống đang là xu.** `transactions.amount`, `wallets.balance`, `budget_limits.amount_limit` đều BIGINT xu. `CLAUDE.md` → Data Conventions: *"Money \| BIGINT integer cents (xu)"*. Mobile `formatCurrency()` chia 100 (`mobile/src/lib/currency.ts:7`). Wizard hiện tại đã gửi income dạng xu (`WizardStepIncomePeriod.tsx:42` — `Math.round(incomeValue * 100)`). | Quy tắc ánh xạ §4.1 `budget_limits.amount_limit = budget_plan_items.amount_max` trở thành **bug 100×**: plan tính bằng đồng, `budget_limits` đọc bằng xu. Mọi số hiện trên app nhỏ đi 100 lần. |
| **BS-02** | 🔴 Chặn | `cycle_start_day` (1..28, "lương về ngày N") là trục thời gian của §5.1, §8 (`elapsedDays`/`totalDaysInCycle`) và §10 (`daysLeftInCycle`). | **Không tồn tại.** Cửa sổ "chi tiêu kỳ này" duy nhất trong backend là `SumExpenseByUserCurrentPeriod`, hardcode `date_trunc('month', NOW())` (`backend/db/queries/transactions.sql:217-218`). `budgets.start_date` có lưu nhưng **chưa query nào dùng tới** để giới hạn cửa sổ chi tiêu. | Mọi con số của §8 và §10 sai với user không nhận lương ngày 1. `đ/ngày` — chỉ số cốt lõi của P-06 — sai. |
| **BS-03** | 🔴 Chặn | §6.1 SQL dùng `t.transaction_date`, và lọc income qua `JOIN categories c … c.type='income'`. | Cột thật tên là **`occurred_at`** (21 lần trong `backend/db/queries/transactions.sql`; `transaction_date` không tồn tại ở đâu cả). `transactions` có cột `type` riêng — lọc income nên là `t.type='income'`. | Query không compile, sqlc gen fail ngay. |
| **BS-04** | 🟠 Cao | §9.2: *"guided/structured JSON decoding (vLLM `guided_json`)"*, `seed` cố định. | Không có vLLM. AI service dùng **Groq + Anthropic tool calling** (`ai-service/app/services/extract_service.py:125-150`), không có tham số `seed`. Chính file đó đã ghi lại bài học: gpt-oss-20b **âm thầm xử lý sai schema có `$ref` lồng nhau** dưới `tool_choice` cưỡng bức (dòng 70). Schema `items[]` của §9.2 chính là dạng array-of-object đó. | NL mode (P3) không build được theo đúng chữ trong spec; bê schema lồng nhau vào là trúng đúng cái bug đã có tiền lệ. |
| **BS-05** | 🟠 Cao | §5.1: `income ≤ 9.999.999.999` (đồng ≈ 10 tỷ). Spec v1 S-BWZ-08 cũng ghi *"9,999,999,999 xu (~10 billion VND)"*. | `dto.BudgetProposalsRequest.Income validate:"lte=9999999999"` — đơn vị là **xu**, nên trần thật là **~100 triệu đồng**, không phải 10 tỷ. Chú thích của spec v1 sai 100×. | User thu nhập > 100tr/tháng bị chặn ngay ở màn 1 mà không hiểu vì sao. |
| **BS-06** | 🟡 Vừa | §4.1: `period text -- monthly \| weekly \| quarterly`. | Ba nguồn đang mâu thuẫn sẵn: `dto.BudgetProposalsRequest.Period` nhận `monthly weekly quarterly`; `common.BudgetPeriodMonthly` là **giá trị duy nhất được chấp nhận** cho Budget thật (`constants.go:107-109`); mobile `budget-pace.ts` giả định hoàn toàn monthly. | Thêm danh sách thứ tư càng rối. Phải chốt monthly-only, hoặc làm weekly/quarterly cho tới nơi. |
| **BS-07** | 🟡 Vừa | §13: notification 8:00 hàng ngày, card ngày 7/14, tổng kết cuối chu kỳ. §16 đo `notification opt-out sau 30 ngày`. | **Không có hạ tầng push.** `mobile/package.json` không có `expo-notifications`. `notifications` chỉ là bảng in-app (`009_notifications.sql`), lại có CHECK constraint + unique dedup index **gắn cứng vào `budget_exceeded`**. | Thêm loại notification mới cần migration (nới CHECK). "8:00 hàng ngày" hiện chỉ là badge trong app — user không mở app thì không thấy gì. Metric opt-out không đo được. |
| **BS-08** | 🟡 Vừa | §4.1 `budget_plans` chỉ có một `income bigint`, không có cột currency. | `budget_limits` là **một dòng / một currency** cho mỗi budget. Mobile đã phải lọc `limit.currency === primaryCurrency` để không cộng nhầm (`BudgetsTab.tsx`). | Quy tắc `amount_limit = amount_max` không xác định được với user nhiều ví nhiều tiền tệ. |
| **BS-09** | 🟡 Vừa | E-14: mọi tính toán ngày dùng `Asia/Ho_Chi_Minh`. | Toàn bộ ranh giới kỳ hiện tại là **UTC**: `date_trunc('month', NOW())` trong SQL, `time.UTC` trong `report_service.go:124` và `notification_service.go:126`. | Đổi timezone là thay đổi xuyên F-05/F-07 (số báo cáo đổi theo), không phải việc riêng của wizard. Phải tách task riêng. |
| **BS-10** | 🟢 Thấp | B1 mô tả bug map-iteration. | **Đúng, và tệ hơn mô tả:** chú thích ngay trên biến còn khẳng định ngược — *"Order is insignificant since matches are keyword-based, not positional"* (`constants.go:227`). Pattern chồng nhau có thật: `"nhà"` vs `"tiết kiệm"`, `"ăn"` vs `"food"`. | Fix B1 phải xoá cả chú thích sai, nếu không người sau lại tưởng là cố ý. |
| **BS-11** | 🟢 Thấp | §3: soft prompt sau *"ngày thứ 3 kể từ khi cài"*. | `users` không có cột install/first-seen. Mốc gần nhất là `users.activated_at`. | Hoặc dùng `activated_at`, hoặc client tự giữ mốc cài đặt — phải chốt, đừng để mơ hồ. |
| **BS-12** | 🟢 Thấp | §12.6 `funding: { source: "buffer" }` — một nguồn bù duy nhất. | Ghi chú của chính bạn ở cuối §8.3 yêu cầu **cắt từ nhiều khoản cùng lúc**. | Payload phải là mảng: `funding: [{ source, category_id, amount }]`; server cộng lại và check tổng khớp `new_amount − old_amount`. |

### 20.2 Chốt lại các quyết định bị ảnh hưởng

| Vấn đề | Quyết định cho v2 |
|---|---|
| **Đơn vị tiền** | **Giữ nguyên xu (cents) ở DB, API và mọi struct Go.** Cái B5 phát hiện đúng là **ví dụ trong spec v1 sai**, không phải đơn vị lưu trữ sai — `"income": 20000000` lẽ ra phải là `"income": 2000000000` (20tr đồng). Đơn vị đồng **chỉ tồn tại ở tầng hiển thị**, qua `formatCurrency()`. Hệ quả: `MinAmountPerCategory = 5_000_000` xu (= 50.000đ); `roundStep()` nhận đối số **xu**, các bậc thành `500_000 / 1_000_000 / 5_000_000 / 10_000_000` xu. Điều B5 nói đúng và phải làm là **bỏ `float64`**, không phải đổi đơn vị. |
| **Trần income** | `lte=999999999900` (xu) = 9.999.999.999đ, đúng như §5.1 mong muốn. Sửa luôn chú thích sai ở spec v1 S-BWZ-08. |
| **`cycle_start_day`** | Là **hạng mục backend riêng, nằm ở Phase 1**, không phải chi tiết UI của màn 1: cần query `SumExpenseByUserCycle(user_id, cycle_start, cycle_end)` thay cho `date_trunc('month')`, và `budgets`/`budget_plans` phải cùng đọc một cửa sổ. Trước khi có nó, mọi `đ/ngày` chỉ đúng với `cycle_start_day = 1`. |
| **`period`** | **monthly-only cho v2.** Xoá `weekly`/`quarterly` khỏi §4.1 và khỏi `dto.BudgetProposalsRequest` để ba nguồn nói cùng một thứ. |
| **Currency của plan** | Thêm `budget_plans.currency text NOT NULL`; một plan phủ **đúng một** currency (currency chính của user). Multi-currency giữ nguyên out-of-scope như v1. |
| **LLM structured output** | Bỏ `guided_json`/`seed`. Dùng **tool calling** đúng như `extract_service.py` đang làm, với schema **phẳng, không `$ref` lồng** — `items[]` phải là mảng object inline. Giữ nguyên regex cross-check của §9.3: với ràng buộc này nó càng cần thiết hơn, không phải kém đi. |
| **Notification** | Phase 2 phải gồm: migration nới CHECK/dedup index của `notifications` cho các loại mới (`calibration_day7`, `calibration_day14`, `cycle_summary`), và **chốt có thêm `expo-notifications` hay không**. Nếu không thêm: bỏ dòng "8:00 hàng ngày" khỏi §13 và bỏ metric opt-out khỏi §16 — đừng đo cái không tồn tại. |
| **Timezone** | Tách task độc lập, **không nhét vào wizard**. Trước khi task đó xong, E-14 chưa được thoả và phải ghi rõ như vậy. |
| **Funding zero-sum** | `funding` là mảng nhiều nguồn (BS-12). Server tự cộng và validate lại, không tin client. |

### 20.3 Ảnh hưởng tới lộ trình §17

Phase 1 phải bổ sung 3 việc backend mà §17 chưa liệt kê, và cả ba đều **chặn** các phase sau:

1. `SumExpenseByUserCycle` + `cycle_start_day` (BS-02) — chặn §8 và §10.
2. Sửa `occurred_at` và trần income (BS-03, BS-05) — chặn §6.1.
3. Chuyển `budgetproposal` sang `int64` **xu** (BS-01 + B2) — chặn toàn bộ engine.

### 20.4 Màn 1 sau khi sửa — mockup để đối chiếu

Chỉ đổi hai thứ so với §5.1: nhãn nguồn của cửa sổ chu kỳ, và cảnh báo trần income đúng mốc. Mọi số hiển thị đi qua `formatCurrency()`; giá trị trong state là **xu**.

```
┌──────────────────────────────────────────────┐
│  ●○○                                     ✕   │
│                                               │
│  Mỗi tháng bạn có bao nhiêu?                 │
│                                               │
│  Thu nhập            [ 12.000.000 ] đ        │
│                       state: 1_200_000_000 xu │
│                                               │
│  Chi phí cố định     [  2.500.000 ] đ        │
│  ⓘ nhà, điện nước, internet, học phí         │
│                                               │
│  Muốn để dành                                 │
│  ├──●────────────────┤   1.200.000đ  (10%)   │
│  Chưa   Ít  [Vừa]  Nhiều                     │
│                                               │
│  ─────────────────────────────────────       │
│  Còn được chi          8.300.000đ            │
│                        276.000đ / ngày        │
│                                               │
│  Lương về ngày [ 1 ▾ ] hàng tháng            │
│  ⚠️ Chọn khác ngày 1: số đ/ngày và các mốc    │
│     kiểm lại vẫn tính theo tháng dương lịch   │
│     cho tới khi BS-02 xong.                   │
│                                               │
│                          [ Tiếp → ]           │
└──────────────────────────────────────────────┘
```

Validation của màn này, viết lại cho khớp đơn vị thật:

| Điều kiện | Ngưỡng (xu) | Ngưỡng (hiển thị) |
|---|---|---|
| `income > 0` | `> 0` | > 0đ |
| `income ≤ trần` | `≤ 999_999_999_900` | ≤ 9.999.999.999đ |
| `fixed + savings < income` | so sánh trong xu | — |
| `disposable ≥ 6 × MinAmountPerCategory` (E-02) | `≥ 30_000_000` | ≥ 300.000đ |

---

## 21. Notification & Settings — chốt quyết định

_Thêm 2026-09-13. Phần này **override** §13 (notification policy) và **đóng** OQ-12, BS-07, BS-11. E-14 (timezone) được **hoãn có chủ ý** — xem D-09._

### 21.0 Bảng chốt

| # | Vấn đề | Quyết định | Thay thế / đóng |
|---|---|---|---|
| D-01 | Có push thật không | **Có.** `expo-notifications` + Expo Push Service. | BS-07 |
| D-02 | Platform | **Android-only.** iOS ẩn hẳn toggle (không disable), không đăng ký token. | — |
| D-03 | Build workflow | **Local Gradle build**, không tiêu lượt EAS. Xem §21.1. | — |
| D-04 | Loại noti mặc định BẬT | `budget_near_limit`, `budget_exceeded` | **§13 dòng "KHÔNG GỬI — mỗi lần vượt budget"** |
| D-05 | Tần suất noti budget | **Mỗi transaction chạm ngưỡng đều bắn.** Không dedup theo chu kỳ. User tắt ở Settings, hoặc ngay trên push bằng action button. | §13 trần cứng — **bỏ hẳn** |
| D-06 | Daily digest 8:00 | Giữ **mặc định TẮT** như §13. | — |
| D-07 | Nơi lưu setting | Server — bảng `user_preferences` mới. | — |
| D-08 | Nhắc calibration | Select 3 mức, mặc định `frequent` cho `cold`. | **OQ-12 → đóng** |
| D-09 | Timezone | **Hoãn.** Hardcode `Asia/Ho_Chi_Minh` một chỗ trong Go. Không có UI, không có cột DB. | E-14 vẫn **chưa thoả** |
| D-10 | Map preset ↔ category | **`categories.system_key`**. | BS-13 (mới, §21.9) |
| D-11 | Sàn mỗi category | `BudgetWizardMinAmountPerCategory` = **`5_000_000` xu** (= 50.000đ). | `constants.go:182` |
| D-12 | Plan versioning | **Mọi** budget đều có plan version — kể cả budget user tự tạo ở màn Budgets. Thêm `budget_plans.origin`. | §4.1 |
| D-13 | Wizard cũ | **Thay tại chỗ toàn bộ**, xoá 4 step cũ. Không chạy song song. | §17 Phase 1 |

---

### 21.1 Build & dev workflow — không tiêu lượt EAS

Nhận định "dev build chỉ build lại khi đổi thư viện native" là **đúng**. Sau khi có dev client trên máy, mọi thay đổi JS/TS vẫn Fast Refresh qua `npx expo start --dev-client` y như Expo Go.

> ⚠️ **`eas build --local` KHÔNG chạy trên Windows.** EAS local build chỉ hỗ trợ macOS/Linux; trên Windows phải qua WSL2. Máy dev của project là Windows 11 → **không dùng đường này.**

**Đường đi thực tế trên Windows:**

| Việc | Lệnh | Tốn lượt EAS |
|---|---|---|
| Build dev client lần đầu / sau khi thêm native module | `npx expo run:android` | **0** |
| Dev hằng ngày | `npx expo start --dev-client` | 0 |
| APK release để chia sẻ / cài máy khác | `npx expo prebuild` → `cd android && ./gradlew assembleRelease` | **0** |
| Bản phát hành chính thức | `eas build -p android --profile preview` | 1 |

Yêu cầu môi trường: **Android Studio + Android SDK + JDK 17** (React Native 0.81 / Expo SDK 54).
`android/` và `ios/` đã nằm trong `mobile/.gitignore` → prebuild không làm bẩn repo, `app.json` vẫn là nguồn sự thật duy nhất của config native (CNG).

**Hệ quả bắt buộc:** kể từ khi thêm `expo-notifications`, **Expo Go không còn dùng để test được nữa** — từ SDK 53 Expo Go bỏ hẳn remote push trên Android. Mọi hướng dẫn test trong repo phải đổi sang dev client.

---

### 21.2 Wiring `expo-notifications`

```bash
npx expo install expo-notifications expo-device
```

`app.json` — thêm plugin và trỏ file FCM:

```jsonc
"android": {
  "googleServicesFile": "./google-services.json",   // FCM V1 — tạo ở bước Firebase
  "permissions": ["POST_NOTIFICATIONS"]
},
"plugins": [
  ["expo-notifications", {
    "icon": "./assets/notification-icon.png",
    "color": "#85FF33"
  }]
]
```

**Ràng buộc:**
- `google-services.json` **không commit** — thêm vào `.gitignore`, nạp qua EAS secret khi build EAS. Local build đọc file thật trên máy dev.
- `getExpoPushTokenAsync({ projectId })` — `projectId` lấy từ `app.json → extra.eas.projectId` (đã có sẵn), **không hardcode**.
- Android 13+ cần xin quyền runtime: `Notifications.requestPermissionsAsync()`. Xin **đúng lúc user bật toggle đầu tiên**, không xin ở màn login (xin sớm = bị từ chối vĩnh viễn).
- iOS: `Platform.OS === "ios"` → bỏ qua toàn bộ khối đăng ký, ẩn nhóm toggle (D-02).

---

### 21.3 Bảng `user_push_tokens`

```sql
-- migration 019
CREATE TABLE user_push_tokens (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid NOT NULL REFERENCES users(id),
  expo_push_token  text NOT NULL UNIQUE,
  platform         text NOT NULL CHECK (platform IN ('android', 'ios')),
  device_name      text,
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  revoked_at       timestamptz
);
CREATE INDEX idx_push_tokens_user_active ON user_push_tokens (user_id) WHERE revoked_at IS NULL;
```

**Vòng đời — phải làm đủ 4 nhánh, thiếu nhánh nào là gửi noti cho nhầm người:**

| Sự kiện | Hành động |
|---|---|
| Login xong / mở app có session | `POST /api/v1/me/push-tokens` → upsert. `ON CONFLICT (expo_push_token) DO UPDATE SET user_id = EXCLUDED.user_id, revoked_at = NULL, last_seen_at = now()` — **bắt buộc cập nhật `user_id`**: hai người dùng chung một máy thì token không đổi, nếu không ghi đè thì người sau nhận noti của người trước. |
| Logout | `DELETE /api/v1/me/push-tokens` (body: token hiện tại) → `revoked_at = now()`. Gọi **trước** `clearSession()` trong `settings.tsx`, cùng kiểu best-effort/timeout như `flushSync()` đang làm. |
| Expo trả `DeviceNotRegistered` | `revoked_at = now()` ngay trong job. Không retry. |
| Token đổi (OS cấp lại) | `addPushTokenListener` → gọi lại upsert. |

**Không bao giờ log `expo_push_token`** (CLAUDE.md — không log sensitive data). Log `user_id` + số token là đủ.

---

### 21.4 Gửi push — nằm trong job sẵn có

**Hai đường bắn khác nhau, vì D-05 đổi ngữ nghĩa từ "theo chu kỳ" sang "theo transaction":**

| Loại | Bắn ở đâu | Vì sao |
|---|---|---|
| `budget_near_limit`, `budget_exceeded` | **Ngay sau khi DB transaction của `CreateTransaction` commit**, trong một goroutine fire-and-forget | D-05 là "mỗi transaction". Đợi job 5 phút thì push về sau khi user đã đóng app và đã quên mình vừa nhập gì — noti mất hết tính actionable, mà vẫn tốn đúng chi phí phiền. |
| `calibration_day7/14`, `cycle_summary`, `daily_digest` | Job 5 phút sẵn có | Bản chất là theo lịch, không theo hành động. |

Ràng buộc của nhánh fire-and-forget:
- Chạy **sau** `tx.Commit()`, không nằm trong DB transaction — push fail không được rollback transaction của user.
- Có `context.WithTimeout` riêng, **không** dùng ctx của HTTP request (request kết thúc trước khi Expo trả lời).
- Panic trong goroutine phải `recover()` — panic ở đây giết cả process.
- Job 5 phút giữ vai trò **lưới an toàn**: quét transaction trong 15 phút gần nhất chưa có `notifications` row tương ứng (server restart giữa chừng, goroutine chết) và bắn bù.

```
backend/internal/service/push/          # client Expo Push API, zero business logic
  client.go      POST https://exp.host/--/api/v2/push/send, batch <= 100 message
  receipts.go    poll receipt -> DeviceNotRegistered -> revoke token
```

`NotificationService` giữ nguyên vai trò: quyết định **có tạo row `notifications` hay không** (nguồn sự thật + dedup). Push chỉ là **hệ quả** của một row vừa được tạo — `created == true` thì mới đẩy sang push queue. Row đã tồn tại (dedup chặn) → không push. Đây là thứ giữ cho in-app list và push không bao giờ lệch nhau.

Thứ tự trong một lần chạy job: `(1) tính trạng thái → (2) insert notification (dedup) → (3) lọc theo user_preferences → (4) lọc token còn sống → (5) gửi batch`.
Bước (3) đứng **sau** (2) là cố ý: user tắt push vẫn phải thấy thông báo trong app, chỉ là không bị đẩy ra ngoài.

---

### 21.5 Các loại notification & điều kiện bắn

| `type` | Điều kiện | Trần | Mặc định |
|---|---|---|---|
| `budget_near_limit` | `ratio >= 0.50` **VÀ** `ratio > periodElapsed + 0.05` | **không trần** — mỗi transaction | **BẬT** |
| `budget_exceeded` | `spent > amount_limit` | **không trần** — mỗi transaction | **BẬT** |
| `calibration_day7` | §8.1 — `cold`, >= 5 tx | 1/plan | theo select |
| `calibration_day14` | §8.1 | 1/plan | theo select |
| `cycle_summary` | §8.5 | 1/chu kỳ | theo select |
| `daily_digest` | 08:00 giờ VN | 1/ngày | **TẮT** |

**`budget_near_limit` phải dùng đúng công thức mà UI đang dùng**, không được đặt ngưỡng phẳng 80%:

```
ratio         = spent / amount_limit
periodElapsed = share chu kỳ đã trôi qua
at-risk  <=>  ratio > periodElapsed + PACE_TOLERANCE      // PACE_TOLERANCE = 0.05
```

Đây là logic của `mobile/src/features/budgets/budget-pace.ts → budgetRowStatus()` — nguồn của chip **"Sắp vượt"** trong `BudgetsTab.tsx`. Nếu push dùng ngưỡng khác thì user nhận push "sắp vượt" rồi mở app thấy chip đếm 0 — mất trust ngay lần đầu.

Điều kiện `ratio >= 0.50` là **guard chống nhiễu đầu chu kỳ** (chính là quy tắc *"dùng ≥ 50% trước khi qua 40% chu kỳ"* của §13, viết lại cho khớp biến): không có nó thì tiêu 12% ngân sách vào ngày 2 đã đủ vượt `elapsed + 0.05` → bắn noti vô nghĩa.

> ⚠️ Logic pace hiện **chỉ tồn tại ở client** (TypeScript). Job chạy ở Go → **phải port sang Go**, và hai bên phải có test cùng bộ case. Đây là việc backend mới, §17 chưa liệt kê.

**Cả hai loại bắn mỗi transaction chạm ngưỡng, không có trần chu kỳ (D-05).** Đây là quyết định sản phẩm, ghi lại nguyên văn đánh đổi để người sau không tưởng là sơ suất:

- §13 gốc cấm điều này, và §16 đặt `notification opt-out sau 30 ngày < 15%` làm chỉ báo churn sớm nhất. Rủi ro thật: user tắt push → mất luôn `calibration_day7/14` → mất phần lõi của v2 (§8).
- Đánh đổi được chấp nhận vì **quyền tắt nằm ngay trên notification** (§21.5.1), không bắt user đi tìm trong Settings. Một cú chạm để im lặng là thứ giữ cho việc bắn dày không biến thành opt-out toàn bộ.
- **Bắt buộc đo:** tách metric opt-out theo từng loại, không gộp một số. `notify_budget_*` bị tắt nhiều là kết quả mong đợi của D-05; `calibration_reminder = 'off'` tăng mới là tín hiệu hỏng. Nếu mute-rate của budget vượt **40%** sau 30 ngày → xem lại D-05.

**Chống ngập khay thông báo — bắt buộc, không phải tối ưu:** mọi push của cùng một budget dùng **chung một Android notification id** (`identifier = "budget:" + budgetID`). Android sẽ **thay thế** notification cũ thay vì xếp chồng — user uống 5 ly cafe trong ngày thì thấy một dòng luôn hiện số mới nhất, không phải 5 dòng. Không có cái này thì D-05 làm khay thông báo không dùng được, và đó mới là thứ khiến user tắt.

#### 21.5.1 Action button trên push

```
☕ Cafe & Giải trí — 980k / 900k
Vượt 80.000đ. Còn 17 ngày.
[ Không nhắc mục này ]   [ Tắt loại này ]
```

Dùng `Notifications.setNotificationCategoryAsync()` với 2 action:

| Action | Tác dụng | Phạm vi |
|---|---|---|
| `mute_budget` | Im lặng **budget này**, **hết chu kỳ này** | 1 budget × 1 chu kỳ |
| `mute_type` | Tắt hẳn loại đó, y như toggle trong Settings | mọi budget, vĩnh viễn |

`mute_budget` cần bảng mới:

```sql
CREATE TABLE notification_mutes (
  user_id      uuid NOT NULL REFERENCES users(id),
  type         text NOT NULL,
  budget_id    uuid REFERENCES budgets(id),
  period_start date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, type, budget_id, period_start)
);
```

Hết chu kỳ, `period_start` đổi → mute tự hết hạn, không cần job dọn. Đây là lý do mute gắn vào `period_start` chứ không phải một cột `expires_at`.

**Cách xử lý cú chạm — phải chọn đúng, chỗ này dễ làm hỏng:** xử lý action button **trong background** trên Android cần data-only message + `TaskManager`, dễ gãy và khó debug. Cách chắc chắn hơn: action button **mở app qua deep link** `pfm://preferences?mute=<budgetId>&type=<type>`, app gọi API rồi hiện toast xác nhận *"Đã tắt nhắc Cafe & Giải trí trong tháng này."* Đánh đổi: user phải thấy app mở ra một nhịp, nhưng bù lại luôn có phản hồi rõ ràng là lệnh đã ăn — im lặng mà không biết đã tắt được hay chưa còn tệ hơn.

Job và nhánh fire-and-forget đều phải **lọc `notification_mutes` trước khi gửi push**, nhưng **vẫn tạo row `notifications`** — cùng nguyên tắc với bước (3) ở §21.4: mute là tắt cái bị đẩy ra ngoài, không phải xoá lịch sử trong app.

---

### 21.6 Migration `notifications` (BS-07)

`009_notifications.sql` gắn cứng `CHECK` và dedup index vào `type = 'budget_exceeded'`. Migration 019 phải:

```sql
ALTER TABLE notifications DROP CONSTRAINT chk_notifications_budget_exceeded_fields;
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_scoped_fields CHECK (
    type NOT IN ('budget_exceeded', 'budget_near_limit')
    OR (related_budget_id IS NOT NULL AND currency IS NOT NULL AND period_start IS NOT NULL)
);
ALTER TABLE notifications ADD COLUMN related_plan_id uuid REFERENCES budget_plans(id);

ALTER TABLE notifications ADD COLUMN related_transaction_id uuid REFERENCES transactions(id);

-- D-05: budget noti KHÔNG còn dedup theo chu kỳ nữa, nên index cũ phải bỏ.
DROP INDEX idx_notifications_budget_exceeded_dedup;

-- Thay bằng dedup theo TRANSACTION: mỗi transaction tối đa 1 noti mỗi loại.
-- Đây không phải để hạn chế tần suất (D-05 muốn bắn dày) mà để nhánh
-- fire-and-forget của §21.4 và lưới an toàn của job không bắn hai lần
-- cho cùng một giao dịch.
CREATE UNIQUE INDEX idx_notifications_per_transaction
    ON notifications (related_transaction_id, type)
    WHERE related_transaction_id IS NOT NULL;

-- Các loại theo lịch vẫn cần dedup theo chu kỳ. NULLS NOT DISTINCT
-- (PostgreSQL 15+, project chạy 16) là thứ khiến nó hoạt động: không có nó,
-- related_budget_id NULL của calibration/digest bị coi là khác nhau và dedup
-- mất tác dụng.
CREATE UNIQUE INDEX idx_notifications_dedup_scheduled
    ON notifications (user_id, type, period_start, related_budget_id, currency)
    NULLS NOT DISTINCT
    WHERE type IN ('calibration_day7', 'calibration_day14', 'cycle_summary', 'daily_digest');
```

`CHECK` cũng phải đòi `related_transaction_id` cho hai loại budget — không có nó thì không truy được noti sinh ra từ giao dịch nào, và dedup per-transaction vô hiệu:

```sql
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_budget_needs_tx CHECK (
    type NOT IN ('budget_exceeded', 'budget_near_limit') OR related_transaction_id IS NOT NULL
);
```

`period_start` đổi nghĩa thành **"ngày mà notification này thuộc về"**: budget → đầu chu kỳ; `calibration_*`/`cycle_summary` → `cycle_start` của plan; `daily_digest` → ngày hôm đó. Phải ghi rõ nghĩa mới này vào comment của cột, nếu không người sau đọc `009` sẽ hiểu sai.

**Copy tiếng Việt:** `buildBudgetExceededNotification()` (`notification_service.go:111`) đang sinh tiếng Anh (*"Budget exceeded: …"*). Dịch luôn khi động vào, cùng chuẩn với phần còn lại của app.

---

### 21.7 `user_preferences` + API

```sql
-- migration 020
CREATE TABLE user_preferences (
  user_id                    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  notify_budget_near_limit   boolean NOT NULL DEFAULT true,
  notify_budget_exceeded     boolean NOT NULL DEFAULT true,
  calibration_reminder       text    NOT NULL DEFAULT 'frequent'
                                     CHECK (calibration_reminder IN ('frequent', 'cycle_end', 'off')),
  notify_daily_digest        boolean NOT NULL DEFAULT false,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  updated_at                 timestamptz NOT NULL DEFAULT now()
);
INSERT INTO user_preferences (user_id) SELECT id FROM users WHERE deleted_at IS NULL;
```

`POST /api/v1/me/notification-mutes` → body `{ type, budget_id }`; server tự điền `period_start` của chu kỳ hiện tại (không tin client, cùng nguyên tắc §12.6). Đây là đích đến của deep link `pfm://preferences?mute=…` ở §21.5.1.

`GET /api/v1/me/preferences` → không có row thì **trả về default, không 404** (row được tạo lazy ở lần PUT đầu). Như vậy user cũ và user mới đi chung một đường, không phụ thuộc backfill chạy đúng hay không.
`PUT /api/v1/me/preferences` → partial update, chỉ field nào gửi mới đổi.

**Không có cột `timezone`** — xem D-09. Thêm cột bây giờ là nói dối: backend vẫn tính mọi ranh giới chu kỳ bằng UTC. Giờ VN dùng cho `daily_digest` nằm ở một hằng số Go duy nhất `common.AppTimezone = "Asia/Ho_Chi_Minh"`, để task timezone sau này chỉ phải đổi một chỗ.

---

### 21.8 Màn Settings

Route mới `mobile/app/(app)/preferences.tsx`, vào từ một row mới trong `SETTINGS_ROWS` của `mobile/app/(app)/settings.tsx`:

```ts
{ label: "Thông báo", Icon: BellIcon, href: "/preferences" as const, adminOnly: false },
```

```
Thông báo
  ├ Sắp vượt ngân sách         [ON]      ← mặc định bật
  ├ Đã vượt ngân sách          [ON]      ← mặc định bật
  ├ Nhắc tôi chỉnh ngân sách   [Thường xuyên ▾]   Thường xuyên / Cuối chu kỳ / Không
  └ Tóm tắt hằng ngày 8:00     [OFF]     ← mặc định tắt
```

**Quy tắc UI:**
- `useQuery` + `useMutation` với **optimistic update** — toggle phải nhảy ngay, rollback nếu request fail. Không `useState` giữ bản sao của server state (CLAUDE.md).
- Bật toggle đầu tiên mà OS chưa cấp quyền → xin quyền; **bị từ chối thì trả toggle về OFF** và hiện dòng hướng dẫn mở Cài đặt hệ thống. Không để toggle ON trong khi OS đang chặn — đó là nói dối user.
- iOS: ẩn cả nhóm (D-02).
- `calibration_reminder = 'off'` → job bỏ qua cả `calibration_day7/14` lẫn `cycle_summary` của user đó, nhưng **card trong AI Chat vẫn hiện** (§8.1 nói mỗi mốc = 1 notification + 1 card; tắt là tắt cái bị đẩy ra ngoài, không phải tắt sản phẩm).

- Dưới nhóm toggle, nếu user đang có `notification_mutes` còn hiệu lực → hiện một dòng **"Đang tắt nhắc: Cafe & Giải trí, Mua sắm — [Bật lại]"**. Mute đặt từ push mà không thấy được ở đâu là mute không gỡ được: user sẽ tưởng noti hỏng.

> Các row còn lại của `SETTINGS_ROWS` vẫn đang tiếng Anh (`Wallets`, `Categories`, `Security`…) — nằm trong đợt dịch còn tồn, không thuộc scope task này.

---

### 21.9 BS-13 — preset §5.3 không map được với category đang có

_Blindspot mới, §20 chưa bắt._

System category đang seed **tiếng Anh** (`006_seed_categories.sql`): `Food, Rent, Transport, Utilities, Entertainment, Shopping, Health` + `Tiết kiệm` (`017`).
Preset §5.3 map **bằng tên tiếng Việt**: `Ăn uống, Di chuyển, Cafe & Giải trí, Mua sắm, Sức khoẻ, Con cái & Học tập, Chi khác`.

→ **Không khớp một dòng nào.** User `cold` chạy wizard sẽ được tạo 6 category mới nằm cạnh 7 category tiếng Anh có sẵn, chi tiêu bị chẻ đôi giữa `Food` và `Ăn uống`, và mọi số của §8 sai từ chu kỳ đầu.

**Quyết định (D-10): thêm `categories.system_key`.**

```sql
-- migration 021
ALTER TABLE categories ADD COLUMN system_key text;
CREATE UNIQUE INDEX idx_categories_system_key
    ON categories (system_key) WHERE user_id IS NULL AND deleted_at IS NULL;
```

| `system_key` | `name` (đổi sang tiếng Việt) | Class (§7.2) |
|---|---|---|
| `food` | Ăn uống | `essential` |
| `transport` | Di chuyển | `essential` |
| `entertainment` | Cafe & Giải trí | `discretion` |
| `shopping` | Mua sắm | `discretion` |
| `health` | Sức khoẻ | `essential` |
| `housing` | Nhà ở | `fixed` |
| `utilities` | Hoá đơn & Tiện ích | `fixed` |
| `children_education` | Con cái & Học tập *(mới)* | `essential` |
| `other` | Chi khác *(mới)* | `discretion` |
| `savings` | Tiết kiệm | — (trừ trước) |
| `salary` / `bonus` / `investment` | Lương / Thưởng / Đầu tư | — (income) |

**Ba việc trong cùng migration 021:**
1. `ADD COLUMN system_key` + gán key cho các row `user_id IS NULL` đang có (match theo tên tiếng Anh hiện tại).
2. `UPDATE … SET name = '<tiếng Việt>' WHERE user_id IS NULL` — chỉ đụng system category. **Category user tự tạo không bị động tới.**
3. `INSERT` 2 category mới: `children_education`, `other`.

**Hệ quả kéo theo:**
- Preset §5.3 map bằng `system_key`, **bỏ hẳn** map-theo-tên.
- Bug **B1** (`BudgetWizardCategoryBaselines` map-iteration) được giải quyết **triệt để**, không phải bằng cách vá thứ tự keyword: baseline tra theo `system_key`, deterministic tuyệt đối. Keyword matching **chỉ còn** là fallback cho category user tự đặt tên.
- Phân loại `fixed/essential/discretion` của §7.2 tra theo `system_key` trong một bảng Go. Category user tự tạo (`system_key IS NULL`) → mặc định **`essential`**, không phải `discretion`: thứ tự cắt của §7.2 là `discretion` trước, và cắt nhầm category do chính user đặt ra là sai hướng an toàn.
- Ghi chú sai ở `constants.go:227` (*"Order is insignificant…"*) phải xoá cùng lúc (BS-10).

---

### 21.10 Plan version cho **mọi** budget, không chỉ budget từ wizard (D-12)

Budget user tự tạo ở `mobile/src/features/budgets/components/BudgetsTab.tsx` cũng phải có plan version, và phải biết được **budget này ra đời từ đâu**.

```sql
ALTER TABLE budget_plans ADD COLUMN origin text NOT NULL
    CHECK (origin IN ('wizard', 'manual', 'calibration'));
```

| `origin` | Sinh ra khi |
|---|---|
| `wizard` | Submit wizard (§7 spec v1) |
| `manual` | Tạo/sửa/xoá budget ở màn Budgets (`BudgetFormModal`) |
| `calibration` | Xác nhận ở dialog zero-sum §8.3 hoặc tổng kết §8.5 |

**Ràng buộc phải nới:** plan `origin='manual'` không có ngữ cảnh wizard (không income, không savings target).

```sql
-- thay chk_disposable_positive của §4.1
ALTER TABLE budget_plans ALTER COLUMN income DROP NOT NULL;
ALTER TABLE budget_plans ALTER COLUMN disposable DROP NOT NULL;
ALTER TABLE budget_plans ADD CONSTRAINT chk_disposable_positive
    CHECK (origin = 'manual' OR (income > 0 AND disposable > 0));
```

- Plan `manual` **kế thừa** `income/fixed_total/savings_target/disposable` từ plan đang active nếu có (`parent_plan_id`); chỉ để NULL khi user chưa từng chạy wizard.
- Calibration **xuống cấp có kiểm soát** khi `disposable IS NULL`: pace từng category (§8.2) vẫn chạy đúng vì chỉ cần `amount_max` + `spent`; riêng dòng *"Còn được chi … đ/ngày"* và §10 `Hôm nay còn X` **ẩn đi**, không đoán bừa. Đây là lối để wizard đề nghị đúng lúc: *"Tôi chưa biết thu nhập của bạn — cho tôi 30 giây nhé?"*
- Mỗi thay đổi → **version mới**, `parent_plan_id` trỏ bản cũ, bản cũ `superseded_at = now()`. Toàn bộ trong **cùng 1 DB transaction** với bulk-replace `budgets` (CLAUDE.md).

**Backfill (migration 022):** với mỗi user đang có budget active → tạo plan `version = 1, origin = 'manual'`, items lấy từ `budget_limits` (`amount_min = amount_max = amount_limit`, `source = 'manual'`, `confidence = 0.3`, `evidence = NULL`), `created_at = MIN(budgets.created_at)`. Không có bước này thì §8 im lặng bỏ qua toàn bộ user hiện tại — calibration không có gì để so.

> **Rủi ro đã biết:** sửa 6 budget liên tiếp ở màn Budgets = 6 version. Chấp nhận ở v2 (audit trail là mục đích, dung lượng không đáng kể). Nếu lịch sử trở nên khó đọc, gộp sau bằng quy tắc: plan `origin='manual'` tạo < 5 phút trước và chưa có calibration xen giữa thì **sửa tại chỗ** thay vì tạo version mới.

---

### 21.11 Thay wizard cũ tại chỗ (D-13)

Xoá, không giữ bản song song:

| Xoá | Thay bằng |
|---|---|
| `WizardStepIncomePeriod.tsx` | `WizardStepIncome.tsx` — §5.1 (thu nhập / cố định / để dành / `cycle_start_day`) |
| `WizardStepCategories.tsx` + `WizardStepPreferences.tsx` | `WizardStepProfile.tsx` — §5.2, **một câu hỏi** |
| `WizardStepProposal.tsx` | `WizardStepResult.tsx` — §5.4 (donut + dải + badge nguồn) |

Giữ nguyên: `BudgetWizardModal.tsx` (vỏ), `WizardProgressHeader.tsx` (3 chấm thay vì 4), `use-submit-budget-wizard.ts`, `SuggestedCategoryDialog.tsx`.
`use-budget-wizard-state.ts` viết lại theo state mới (`income/fixed/savings/preset/intents`), **không patch dần** — state cũ mang mô hình 6-tier × N-category đã bị §5.2 loại bỏ.

`WizardStepIncomePeriod.tsx:42` (`Math.round(incomeValue * 100)`) là chỗ duy nhất đang đổi đồng→xu ở client. Màn mới giữ **state bằng xu** từ đầu, chỉ format ra đồng khi hiển thị (§20.4).

---

### 21.12 Ảnh hưởng tới lộ trình §17

§17 Phase 1 và Phase 2 phải bổ sung:

**Phase 1** (thêm vào 3 việc backend của §20.3):
4. Migration 021 — `categories.system_key` + đổi tên system category + 2 category mới (§21.9). **Chặn toàn bộ §5.3**, phải làm trước mọi thứ khác của wizard.
5. Port logic pace từ `budget-pace.ts` sang Go (§21.5). Chặn cả `budget_near_limit` lẫn §8.
6. Migration 022 — `budget_plans.origin` + nới constraint + backfill (§21.10).

**Phase 2** (cùng lô với calibration):
7. `expo-notifications` + dev client + FCM (§21.1–21.2).
8. Migration 019/020 — `user_push_tokens`, nới `notifications`, `user_preferences` (§21.3, §21.6, §21.7).
9. Màn Settings (§21.8).
10. `push` client + nhánh fire-and-forget sau `CreateTransaction` + lưới an toàn trong job (§21.4).
11. `notification_mutes` + notification category/action + deep link `pfm://preferences?mute=…` (§21.5.1).

---

### 21.13 Còn mở sau §21

| # | Câu hỏi | Giả định tạm |
|---|---|---|
| OQ-14 | Đổi tên system category sang tiếng Việt (§21.9 bước 2) có đụng user đang dùng không? | Không — chỉ `user_id IS NULL`, và `transactions` tham chiếu bằng `category_id`. Nhưng ai đã quen thấy "Food" sẽ thấy tên đổi. Chấp nhận: app đang chuẩn hoá tiếng Việt toàn bộ. |
| OQ-15 | Firebase project dùng chung hay riêng cho dev/prod? | Một project, hai Android app (`…pfm` và `…pfm.dev`) nếu sau này cần tách. Chốt khi tới bước tạo Firebase. |
| OQ-16 | `daily_digest` 08:00 — job chạy 5 phút/lần, lấy gì làm mốc "đã gửi hôm nay"? | Dedup index §21.6 với `period_start` = ngày hôm đó theo `common.AppTimezone`. Job chỉ gửi khi giờ VN thuộc [08:00, 08:05). |
| OQ-17 | E-14 chưa thoả (D-09) — bao giờ làm? | Gộp chung task với `cycle_start_day` (BS-02), vì cả hai sửa đúng một chỗ: cửa sổ chu kỳ. Task riêng, sau Phase 2. |
| OQ-18 | D-05 bắn mỗi transaction — có trần tuyệt đối nào không (vd. tối đa 10 push/ngày/user)? | **Không đặt trần ở v2.** Notification id dùng chung theo budget (§21.5) đã khiến khay thông báo không ngập, và mute một chạm là van xả. Nếu mute-rate > 40% sau 30 ngày thì xem lại D-05 trước khi thêm trần. |
| OQ-19 | `budget_near_limit` bắn mỗi transaction: một budget đã at-risk thì **mọi** giao dịch sau đó đều thoả điều kiện | Chấp nhận theo đúng chữ của D-05 — đó chính là "bắn liên tục". Notification id chung khiến nó hiện ra như **một dòng tự cập nhật**, không phải N dòng. Nếu muốn giảm, chèn điều kiện "chỉ bắn khi `ratio` tăng thêm ≥ 5 điểm % so với lần bắn trước" — **chưa áp dụng ở v2**. |
