# /renew-features — Làm mới docs/features.md

Mục tiêu: phân tích project state thực tế → xác định feature nào done/pending/cần enhance
→ hỏi clarification → ghi ra docs/features.md chuẩn.

---

## BƯỚC 1 — Thu thập project state (dùng gitnexus)

Đọc theo thứ tự sau để tránh lãng phí token:

```
@.claude/skills/gitnexus/gitnexus-exploring/SKILL.md
```

Sau khi đọc skill, thực hiện:

1. **Scan specs/** — mỗi thư mục trong `specs/` = 1 feature đã có spec. Đọc `spec.md` (skip `plan.md`) để nắm scope.
2. **Scan backend/db/migrations/** — migrations thực tế = schema đã deploy. So sánh vs spec để biết cái gì đã có DB.
3. **Scan backend/internal/handler/** — handler files = endpoints đã implement.
4. **Scan mobile/lib/features/** — thư mục con = features đã có UI.
5. **Đọc @SRS.md** — full product vision.
6. **Đọc @SDS.md section "Scenario Index"** — danh sách scenarios MVP.

Tổng hợp ra ma trận nội bộ (KHÔNG cần in ra user):

| Feature | Spec? | DB Migration? | Backend Handler? | Mobile UI? | Status |
|---------|-------|--------------|-----------------|-----------|--------|
| ...     | ✓/✗   | ✓/✗          | ✓/✗             | ✓/✗       | DONE/PARTIAL/SPEC_ONLY/NOT_STARTED |

---

## BƯỚC 2 — Clarification Questions (BẮT BUỘC, KHÔNG ĐƯỢC BỎ QUA)

Trước khi viết features.md, PHẢI hỏi user những câu sau. In ra rõ ràng, đánh số, chờ user trả lời.

---

### Câu hỏi clarification:

**[Q1 — Priority direction]**
Hiện tại project đang ở giai đoạn nào?
- (A) Hoàn thiện MVP — muốn đảm bảo tất cả MVP features chạy ổn, test được
- (B) Mở rộng Release 1 — muốn add feature mới từ SRS (Financial Goal, Dashboard...)
- (C) AI Features — muốn focus vào AI service (auto-categorize, chatbot, insight)
- (D) Technical debt — muốn refactor/stabilize code hiện tại trước khi add feature mới

**[Q2 — Pain point hiện tại]**
Khi dùng app, luồng nào hay bị lỗi / thiếu / UX kém nhất?
(Trả lời free-form, không cần chọn. VD: "tạo transaction xong balance không update real-time", "filter transactions chậm")

**[Q3 — Mobile vs Backend priority]**  
Feature tiếp theo nên tập trung vào đâu?
- (A) Mobile UI/UX — polish UI, offline mode, charts
- (B) Backend APIs — thêm endpoints còn thiếu, reporting
- (C) Full-stack — cả hai cùng lúc
- (D) AI Service — bắt đầu build Python AI microservice

**[Q4 — Technical constraints]**
Có bất kỳ hard constraint nào không?
- Deadline cụ thể?
- Budget cho API calls (Groq/Anthropic)?
- Đang block bởi issue kỹ thuật cụ thể nào không?

**[Q5 — Enhancement vs New feature]**  
Prefer:
- (A) Hoàn thiện/enhance feature đã có (edge case, validation, UX)
- (B) Add feature hoàn toàn mới từ SRS
- (C) Cả hai, ưu tiên theo ROI

---

## BƯỚC 3 — Viết docs/features.md

Sau khi user trả lời, ghi file với cấu trúc sau:

```markdown
# PFM — Features Status & Roadmap

_Last updated: {date}_
_Updated by: /renew-features_

---

## 1. Project State Summary

> Tóm tắt ngắn gọn: project đang ở giai đoạn nào, gần đây implement gì xong.

**Implemented (code + DB + mobile UI):**
- Feature X: mô tả ngắn gọn những gì đã xong

**Partial (có spec/backend nhưng mobile chưa hoặc ngược lại):**
- Feature Y: thiếu phần nào

**Specced only (có spec, chưa có code):**
- Feature Z

**SRS items chưa spec:**
- ...

---

## 2. Feature Status Matrix

| # | Feature | SRS Ref | Spec | Backend | Mobile | Status |
|---|---------|---------|------|---------|--------|--------|
| 1 | User Management | FR-01 | ✓ | ✓ | ✓ | DONE |
| 2 | ... | | | | | |

Status values: `DONE` / `PARTIAL` / `SPEC_ONLY` / `BACKLOG` / `BLOCKED`

---

## 3. Recommended Next Features

> Dựa trên user input + project state, prioritized list.

### 🔥 High Priority (next sprint)

#### [FEAT-XX] Feature Name
- **Type:** Enhancement | New Feature | Bug Fix | Technical Debt
- **SRS ref:** FR-0X, US-0X-0X
- **Rationale:** Tại sao feature này quan trọng ngay lúc này
- **Scope:** Mobile | Backend | Both | AI Service
- **Dependencies:** Cần gì đã có trước
- **Rough complexity:** S | M | L | XL
- **Clarifying questions to resolve before BA:**
  - [ ] Câu hỏi cụ thể cần clarify trước khi bắt đầu BA
  - [ ] ...

### 📋 Medium Priority (next 2-3 sprints)

#### [FEAT-XX] ...

### 🔮 Low Priority / Future

#### [FEAT-XX] ...

---

## 4. Enhancement Backlog (existing features)

> Những cải tiến cho features đã có, chưa đủ priority để thành sprint riêng.

- [ ] [Feature X] Edge case: ...
- [ ] [Feature Y] UX: ...
- [ ] [Feature Z] Performance: ...

---

## 5. Technical Debt Items

> Anti-pattern hoặc known issue cần xử lý.

- [ ] Item 1: mô tả + file liên quan
- [ ] ...

---

## 6. AI Service Roadmap

> Riêng cho Python AI microservice vì nó độc lập.

**Phase 0 (foundation):** Setup FastAPI, auth với backend, basic health check
**Phase 1 (core AI):** Auto-categorize transaction
**Phase 2 (chatbot):** Chat về chi tiêu
**Phase 3 (insights):** Anomaly detection, spending pattern

Current phase: {phase}
```

---

## BƯỚC 4 — Post-write checklist

Sau khi viết xong, tự review:
- [ ] Feature status matrix có khớp với code thực tế không (cross-check migration count vs spec count)?
- [ ] Recommended features có phụ thuộc vào nhau không? Nếu có, đã note dependency chưa?
- [ ] Có ít nhất 1 "clarifying questions to resolve before BA" cho mỗi high-priority feature không?
- [ ] AI Service roadmap có realistic với budget constraint (prioritize Groq free tier) không?
- [ ] Technical debt list có empty không? (Nếu empty, scan lại code harder — luôn có debt)