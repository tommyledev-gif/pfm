1. Tách segment (phần b chỉ đích danh)
File	
DonutChart.tsx	Khe 4px giữa các cung. Là lỗ thật trong stroke chứ không phải vạch đen vẽ đè — nền app lộ qua, nên đặt donut lên card khác màu vẫn đúng. Tách full (layout) khỏi length (nét vẽ), nếu trừ khe vào layout thì vòng tròn không khép kín.
BudgetProgressBar.tsx	Vạch tối ở ranh giới đã tiêu | còn lại và đã tiêu | vượt. Vẽ màu bgApp chứ không để trong suốt — track là trắng mờ, để trống sẽ lòi track ra.
SegmentedBar.tsx mới	Đúng thanh trong ảnh b gửi. Dùng flexGrow chứ không phải width: % — có gap thì tổng % vượt 100 và block cuối bị cắt. Dự phòng vẽ gạch chéo, không tô đặc.
WizardProgressHeader.tsx	3 pill rời thay thanh liền.
2. Slider + modal chỉnh (đúng yêu cầu của b)
MoneySlider.tsx — PanResponder thuần, không thêm native dep (thêm là phải build lại dev client mọi máy). Snap theo bậc VND nên không bao giờ ra 3.087.425đ.

Màn 1: MoneyField = slider + input cùng một giá trị. Gõ vượt tầm slider thì slider tự nới ra, không bị kẹp lại.
Chỉnh từng dòng: EditAmountModal — slider + input, cả hai clamp ở own + buffer. Đây chính là ràng buộc b nói: không thể vượt tổng. Và nó chỉ động vào dự phòng — các dòng khác đứng yên. Hết dự phòng thì slider đơn giản là không đi tiếp được.
3. Engine + DB
Migration 019 (system_key + đổi tên system category sang tiếng Việt + 2 category mới) và 020 (budget_plans/budget_plan_items + backfill), mount ở cả hai compose file.

Engine viết lại hoàn toàn: int64 xu, deterministic, fix B1–B3/B5/B7. Test xanh: 10.000 case fuzz chạy sát trần thu nhập, determinism ×1.000, 4 preset × 5 mức thu nhập, invariant Σ + buffer == disposable chính xác tuyệt đối.

M đã áp cả 6 điểm trong mục "6 việc phải xong trước khi code" của mockup:

#1 tràn int64 → common.MulDiv dùng bits.Mul64/Div64; fuzz range nới tới sát cap để thật sự bắt được nó.
#5 ngưỡng 300.000đ → sửa thành 350.000đ, có test khẳng định nó phủ được 6 × sàn sau khi trừ 12% buffer.
#6 effective_from → thêm vào budget_plans ngay từ đầu.
#3 copy hứa suông → Phase 2 chưa có nên m đổi sang "Bạn chỉnh lại bất cứ lúc nào." thay vì hứa check-in ngày 7.
⚠️ Chưa xong — nói thẳng
AppTimezone mới là hằng số, chưa ai dùng (mockup #2). Biên chu kỳ backend vẫn UTC.
Plan versioning chưa có đường ghi. Bảng có rồi, nhưng POST /budgets/bulk chưa nhận plan và chưa có writePlanVersion. → Chạy wizard xong lưu budget nhưng không sinh plan row. Phase 2 sẽ không có gì để đối chiếu. Đây là lỗ hổng lớn nhất.
cycle_start_day: user chọn được, client tính đ/ngày đúng theo nó, nhưng backend vẫn tính cửa sổ chi tiêu theo tháng dương lịch. Chưa có SumExpenseByUserCycle.
US-09 moment-of-spend (2 dòng ngân sách dưới card chat) chưa làm.
Race submit lần đầu (mockup #4, FOR UPDATE khoá 0 dòng khi user chưa có budget) chưa fix.
Chưa test trên máy thật — không có emulator ở đây.
GitNexus: session này không có MCP tool (impact/context/query) và repo cũng không có .gitnexus/. M đọc code trực tiếp — không chạy impact analysis như CLAUDE.md yêu cầu, và không giả vờ đã chạy.