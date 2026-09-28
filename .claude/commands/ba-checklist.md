# Spec Quality Workflow

Quy trình đặt câu hỏi và kiểm tra chất lượng spec cho User Story (US), dùng cho AI khi generate/review spec.

---

## 1. WHs Question (Pre-generate)

Trả lời các câu hỏi sau, trình bày ngắn gọn theo bullet points và có dẫn chứng trích từ docs hoặc UI:

- Actors là ai?
- Mục đích của US?
- Khi nào sử dụng?
- Tại sao cần có US này?
- US này cần đáp ứng được những gì để vào được success flow?
- Có thể có các trường hợp lỗi nào?
- Có các table nào tham gia vào US này (trực tiếp và gián tiếp)?
- In scope và out of scope (các scope đã có US khác đảm nhận hoặc ngoài phạm vi US) của US này là gì?
- US này có liên quan trực tiếp đến các US nào? Và liên quan thế nào? (ghi ngắn gọn)
- Tạo checklist các case cần cover (thành công và các case thất bại)

---

## 2. Post-generate Check Questions

1. Đọc lại ACs của US này trong `specs/{feature-slug}/spec.md`, liệt kê ra đây theo bullet points, **bằng tiếng Việt**, ghi ngắn gọn nội dung (nội dung chính, quá trình thực hiện AC, kết quả) của các AC này.
2. Liệt kê những điểm cần phải sửa sau các câu hỏi bên trên và mục đích sửa, trình bày theo bullet points.

> Có thể hỏi cùng lúc cả 2 câu trên.
>
> ⚠️ Tiếng Việt ở mục này là cho **phần trả lời/phân tích trong chat**, không phải cho `spec.md`. File `spec.md` vẫn phải 100% tiếng Anh (§3).

---

## 3. Checklist for a Quality Spec

Đọc lại spec của US này thật kỹ và tiến hành kiểm tra theo checklist sau, đảm bảo không có chỗ nào vi phạm checklist. **Checklist này rất quan trọng, ảnh hưởng lớn đến chất lượng đầu ra nên cần xem xét kỹ lưỡng và cẩn thận.**

- [ ] Giữ spec ở mức tổng quát, không đề cập đến chi tiết
- [ ] AC phải cover đủ các FR 100% (cover toàn phần)
- [ ] Assumptions không được tồn tại requirement nào
- [ ] Spec phải cover đủ UI
- [ ] Key entities không được thiếu, không được quá chi tiết và phải kẻ bảng
- [ ] Các AC dài, có "and" thì nên trình bày tách "and" xuống dòng riêng rõ ràng
- [ ] Loại bỏ các EC và assumption đã được cover
- [ ] Hạn chế referer tới docs khác khi có thể
- [ ] No tech words
- [ ] No Vietnamese
- [ ] Check lỗi wording
- [ ] Đóng vai 1 developer đang làm design step, check và fix các gap và ambiguity có trong spec **(quan trọng)**
- [ ] Spec phải đảm bảo consistency xuyên suốt US **(quan trọng)**
- [ ] Các số của các IDs phải được đánh đúng thứ tự
- [ ] Spec phải cover đủ error state, empty state, success state, loading state của giao diện
- [ ] Các hành vi ẩn elements hoặc chặn truy cập phải được diễn đạt đúng theo docs hoặc UI yêu cầu
- [ ] Đảm bảo hạn chế spec bị ảnh hưởng khi sửa các file khác nhất có thể (không đề cập đến constant hay những giá trị có khả năng thay đổi trong tương lai, chỉ nói chung chung, tổng quát)

---

## 4. Final Checklist (Combine with Section 3)

> PFM-specific. There is **no Jira, no ticket workflow and no `bee-NNN` branch convention** in this project — if you have seen those in another checklist, they do not apply here.

### Branch & Files
- [ ] Working on a feature branch off `develop` (the default branch), never committing to `develop` directly
- [ ] Spec lives at `specs/{feature-slug}/spec.md` — kebab-case slug matching the feature (e.g. `ai-chat-query-spending`), **not** a numbered `00N-` folder
- [ ] Never run `git commit` — the user commits. This applies to every step of the flow.

### Story & SRS Structure
- [ ] Story statement exists in `SRS.md` **§6 Features and User Stories**, under the correct `## Feature-NN:` heading
- [ ] Story format is correct: *As a [actor], I want [goal] so that [reason]*
- [ ] Actor is one PFM actor: `User` · `Admin` · `Visitor` · `System` (app roles in DB are only `admin | member`)
- [ ] SRS carries the story statement plus its Gherkin scenarios; the full **AC / Edge Case / DoD block lives in `spec.md`**, not in SRS
- [ ] If the US is new, `SRS.md` §6 is updated **before** `/cook-ba` runs — `/cook-ba` Step 2 reads SRS to pick the feature and cannot pick one that isn't there
- [ ] If a new Functional Requirement is implied, `SRS.md` §2 (`FR-01`…`FR-10`) gains or extends an entry

### Acceptance Criteria Quality
- [ ] All acceptance criteria provided in the prompt are present in `spec.md`
- [ ] Every AC describes a testable, observable outcome — not an implementation detail
- [ ] No technology names, endpoint paths, DB table/field names or Go/TS type names leaked into ACs (those belong to `plan.md`)

### Spec Scope Boundaries
- [ ] No Domain Objects, no ERD, no sequence diagrams, no migration SQL, no pre-defined table fields — `spec.md` stays conceptual; those belong to `plan.md`
- [ ] Business terminology matches this project's domain language: **Wallet, Category, Budget, Transaction, User, Notification** — not "account", "label", "spending limit", "record", "member/staff"
- [ ] A `spec.md` **may contain several User Stories** when they belong to the same feature slug (precedent: `specs/ai-budget-wizard-v2/spec.md` has US-01…US-09). Each US still needs its own Main Flow, Scenarios, Edge Cases and Definition of Done — no shared/implicit ones.
- [ ] No `Priority: P1/P2/P3`, no "Why this priority", no "Independent Test" fields — priority is tracked in `docs/features.md`, not per spec

### PFM Domain Rules (check every spec that touches these)
- [ ] Money: unit stated as integer cents (VND xu, `BIGINT`), currency named, rounding behavior explicit — **never float at any layer**
- [ ] Timestamps: UTC stored / local displayed, stated wherever a new time-bearing field or period appears
- [ ] Soft delete: `deleted_at` behavior stated for any entity that supports it — never silently imply hard delete
- [ ] User isolation: every read/write is scoped to the calling User; cross-user access is an explicit 403 scenario, never a silent empty result
- [ ] Idempotency: stated for every write that creates or mutates financial data
- [ ] Any requirement that could cause data loss or financial inconsistency carries a ⚠️ marker

### Traceability
- [ ] This US traces to a Functional Requirement (`SRS.md` §2 `FR-NN`) **and** to a Business Flow step (`SRS.md` §5 `BF-NN`) where one applies
- [ ] Business rules, ACs, Edge Cases, Scenarios each carry a stable ID (`BR-08`, `AC-03`, `EC-06`, `S-{FEATURE_CODE}-NN`) for traceability into `plan.md` and `test_cases.md`
- [ ] Scenario IDs use this project's format: `S-{FEATURE_CODE}-{NN}` (e.g. `S-AI-14`, `S-BWZ2-50`)
- [ ] Related existing specs are linked once in the header (`> Related: [...]`), not re-explained inline