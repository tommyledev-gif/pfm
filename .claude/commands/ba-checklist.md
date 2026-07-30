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

1. Đọc lại ACs của US này trong `@specs/00N-usname/spec.md`, liệt kê ra đây theo bullet points, bằng tiếng Việt, ghi ngắn gọn nội dung (nội dung chính, quá trình thực hiện AC, kết quả) của các AC này.
2. Liệt kê những điểm cần phải sửa sau các câu hỏi bên trên và mục đích sửa, trình bày theo bullet points.

> Có thể hỏi cùng lúc cả 2 câu trên.

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

### Jira & Branch
- [ ] Spec Step task ticket exists in Jira, is **In Progress**, in **active Sprint**, assigned to the right person and blocks the Jira Story ticket
- [ ] Branch is checked out: `feature/bee-NNN-xx-us-NN-spec-step` (ex: `feature/bee-123-ss-us-01-spec-step`)

### Story & SRS Structure
- [ ] Story statement is under the correct Feature section (§7.x)
- [ ] Story format is correct: *As a/an [actor], I want to [goal] so that [reason]*
- [ ] Actor matches one of the defined roles: `ADMIN | HR | FA | PM | DM | SYSTEM`
- [ ] No ACs in SRS — only the story statement; AC block is detailed in `spec.md`
- [ ] Spec link (`> Spec: [...]`) appears once on the Feature header (§7.x), not under the US entry
- [ ] SRS Table of Contents is updated to include the new US entry

### Acceptance Criteria Quality
- [ ] All acceptance criteria provided in the prompt are present in `spec.md`
- [ ] Every AC describes a testable, observable outcome — not an implementation detail
- [ ] No technology names, endpoint paths, or DB field names leaked into ACs (those belong to `plan.md`)

### Spec Scope Boundaries
- [ ] No Domain Objects, no ERD, no sequence diagrams, no pre-defined table fields present — `spec.md` stays conceptual; those belong to the Design step
- [ ] Business terminology matches the constitution (e.g. "Business Unit" not "Department", "Employee" not "Staff")
- [ ] `spec.md` contains exactly one US — no User Story 1 / User Story 2 sub-sections, no `Priority: P1/P2/P3`, no "Why this priority", no "Independent Test" fields

### Traceability
- [ ] This US can be traced to a CDM entity (SRS §2) or a business flow step (SRS §6)
- [ ] If a new Domain Entity is introduced, SRS §2 is updated and the sync date is current
- [ ] Business rules, functional requirements, ACs, Edge Cases, etc. each carry a stable ID (e.g. `BR-08`, `EM-FR-01`, `AC-03`, `EC-06`...) for traceability