Nhưng có 1 spec còn lỗ hổng thật: ai-budget-wizard-v2
Đúng như docs/new-tasks.md tự khai ở mục "⚠️ Chưa xong" — mình verify lại thì 3 user story vẫn zero code:

US-03 — Spending cycle window. Không có SumExpenseByUserCycle. Cửa sổ chi tiêu duy nhất vẫn là date_trunc('month', NOW()) ở transactions.sql:217. AppTimezone khai ở budget_wizard_v2.go:83 nhưng không file nào import. → cycle_start_day user chọn được nhưng backend bỏ qua.
US-04 — Budget plan layer & versioning. budget_plan chỉ xuất hiện ở đúng 1 file: 020_budget_plans.sql. Không có query trong backend/db/queries/, không có dòng Go nào. POST /budgets/bulk ở budget_handler.go:147 không nhận plan, không ghi version. → Chạy wizard xong có budget nhưng không sinh plan row.
US-09 — Budget context at moment of spend. budget_impact / daily_remaining_total không tồn tại ở cả backend lẫn mobile. Có thứ gần giống: TransactionActionCard.tsx:84-93 vẽ bar budget trước khi confirm, tính client-side. Đó không phải DoD của US-09 (server trả về sau khi ghi, kèm remaining_today làm tròn 1.000đ).
US-01, US-02, US-05…US-08 thì xong — engine int64 deterministic có compute_test.go, system_key đã xuyên suốt từ mig 019 → categories.sql.go → classify.go.

Hai điều đáng lưu ý thêm
docs/features.md đã stale (ghi _Last updated: 2026-09-13_). Nó nói F-13.1 là SPEC_ONLY — not in specs/, nhưng specs/ai-budget-wizard-v2/ đã tồn tại từ 2026-09-22 và implement gần hết. Nó cũng không biết mobile-visual-refinements và transaction-delete-guardrails. Nếu muốn, chạy /renew-features sẽ sync lại.
Feature chưa có spec (khác với "spec chưa làm"): F-08 Financial Goal, F-09 Investment Portfolio — không spec, không mig, không code. F-11 Dashboard có UI thật ở app/(app)/index.tsx nhưng chưa bao giờ có spec.
Muốn m viết spec bổ sung cho 3 US còn thiếu của v2, hay chạy /renew-features để refresh features.md trước?


ok đây là list cần làm:
cloudflare r2 cron job auto backup db data, retetion 30-60d
log retention 30d các log thường, 60d các log nguy hiểm, nghiêm trọng
fix bảo mật chat history filter user_id
fix cái này (Rate limit IP bị Cloudflare che → 20 user dùng chung 1 bộ đếm)
thêm recover middleware để handle panic
fix invite resend (dc thì enable tính năng resend invitation (lần đầu 1p, từ lần 2 thì 30p mới dc resend)
fix Email case-sensitive → User@gmail.com ≠ user@gmail.com
fix refresh token