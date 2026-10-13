"""System prompt for the consult (free-text spending question) call.

specs/ai-chat-query-spending/plan.md AIQ-T32. Pure string building, no I/O.
Kept apart from prompt_builder.py (the /extract prompt) so the
transaction-recording path cannot regress when this one changes.

The model only classifies and maps — it never computes or states a figure.
The one rule that matters most is coverage: a question with ANY condition
the model cannot represent must be marked partial, because answering from
the part it understood shows a plausible, wrong number (spec.md S-AIQ-27).
"""

from datetime import date, timedelta

from app.schemas.consult_schema import ConsultCategory, ConsultWallet


def _day_anchors(today: str) -> str:
    """Yesterday and the day before, computed here rather than by the model:
    date arithmetic across a month or year edge is exactly what an LLM gets
    wrong, and copying a printed date is not (plan.md R-F20, BR-24)."""
    try:
        day = date.fromisoformat(today)
    except ValueError:
        return ""
    yesterday, day_before = day - timedelta(days=1), day - timedelta(days=2)
    return f" Hôm qua là {yesterday.isoformat()}. Hôm kia là {day_before.isoformat()}."


def build_consult_prompt(categories: list[ConsultCategory], wallets: list[ConsultWallet], today: str, timezone: str) -> str:
    expense = "\n".join(f'- id={c.id} name="{c.name}"' for c in categories if c.type == "expense") or "(không có)"
    income = "\n".join(f'- id={c.id} name="{c.name}"' for c in categories if c.type == "income") or "(không có)"
    wallet_lines = "\n".join(
        f'- id={w.id} name="{w.name}" currency={w.currency} is_default={w.is_default}' for w in wallets
    ) or "(không có)"

    return f"""Bạn phân loại câu hỏi về chi tiêu cho ứng dụng tài chính cá nhân PFM.
Bạn CHỈ phân loại và ánh xạ câu hỏi thành cấu trúc. Bạn KHÔNG tính toán, KHÔNG trả lời, KHÔNG nêu bất kỳ con số nào.
Hôm nay là {today} (múi giờ {timezone}).{_day_anchors(today)}

Danh mục CHI TIÊU của người dùng:
{expense}

Danh mục THU NHẬP của người dùng:
{income}

Ví của người dùng:
{wallet_lines}

Bạn nhận câu gốc và một dạng đã chuẩn hoá (bỏ dấu, số tiền đã quy đổi). Dùng cả hai để hiểu.

1. kind — chọn đúng một:
- "query": hỏi con số cụ thể — "bao nhiêu", "tổng", "liệt kê", "top", "lớn nhất", "so sánh", "còn bao nhiêu ngân sách".
- "evaluate": xin nhận xét/đánh giá — "đánh giá", "nhận xét", "thế nào", "ổn không", "nhiều không", "có tăng nhiều không".
- "scenario": giả định / mục tiêu tiết kiệm — "nếu", "giả sử", "muốn tiết kiệm", "cắt ... thì", "bao giờ đủ", "muốn mua", "cần X vào tháng Y thì mỗi tháng chi/để dành thế nào".
- "needs_context": câu thiếu chủ thể, phụ thuộc câu trước — "còn tháng trước?", "thế còn ăn uống?".
- "transaction_like": đang mô tả một khoản chi/thu để ghi lại, không phải câu hỏi — "cafe 50k", "ăn trưa 35k". \
Câu có từ hỏi (đâu, gì, nào, bao nhiêu, mấy) KHÔNG BAO GIỜ là transaction_like, kể cả khi không dấu: \
"tien di dau hom nay" = query. transaction_like luôn có số tiền hoặc tên món cụ thể; câu chỉ có động từ chi tiêu \
và một kỳ ("tiêu hnay", "chi tiêu tuần này", "danh mục tiêu hôm nay") là query.
- "unsupported": mọi thứ khác — đầu tư, so với người khác, dự đoán cuối tháng, khoản bất thường, subscription, \
hỏi theo tên cửa hàng/người/địa điểm/ghi chú (ví dụ "tốn bao nhiêu cho Grab" khi không có danh mục tên Grab), \
mốc âm lịch ("từ Tết tới giờ").
Ví dụ ranh giới: "tháng này tiêu bao nhiêu" = query; "tháng này tiêu nhiều không" = evaluate; \
"ăn uống tháng này so tháng trước" = query; "ăn uống tháng này so tháng trước có tăng nhiều không" = evaluate.

2. Khi kind = "query", chọn metric:
- sum: tổng chi (tx_type=expense) hoặc tổng thu nhập (tx_type=income) trong một kỳ. Câu chỉ có động từ chi tiêu \
và kỳ ("tiêu hôm nay", "tháng này chi tiêu") cũng là sum.
- breakdown + group_by: category, wallet ("ví nào tiêu nhiều"), weekday ("hay tiêu vào thứ mấy").
- Hỏi tiền đã tiêu VÀO NHỮNG GÌ luôn là breakdown theo category, với bất kỳ kỳ nào, dù hỏi theo cách nào: \
"tiền đi đâu", "chi vào đâu", "tiêu vào gì", "tiêu gì", "tiêu cái gì", "chi những gì", "đã mua gì", "danh mục nào", \
"theo danh mục", hoặc chỉ "danh mục" kèm động từ/kỳ ("danh mục tiêu hôm nay" = "tiền đi đâu hôm nay").
- compare: một kỳ so với kỳ liền trước (period chỉ được là this_cycle, last_cycle, this_week, last_30_days).
- series: chi theo từng tháng qua nhiều tháng (period = last_3_cycles hoặc last_6_cycles).
- top_n: các khoản chi lớn nhất (limit = số khoản được hỏi, mặc định bỏ trống); hoặc các khoản trên một mức tiền \
(amount_min_vnd = mức tiền bằng đồng, ví dụ "trên 1tr" = 1000000). Hỏi liệt kê TỪNG KHOẢN — "chi những khoản nào", \
"liệt kê các khoản chi", "những giao dịch nào" — cũng là top_n, limit bỏ trống.
- max_tx: MỘT khoản chi lớn nhất.
- avg_daily: trung bình mỗi ngày chi bao nhiêu.
- budget_status: còn bao nhiêu ngân sách (period luôn = this_cycle).

3. period: "tháng này" = this_cycle; "tháng trước" = last_cycle; "3 tháng qua" = last_3_cycles; "6 tháng qua" = \
last_6_cycles; "30 ngày qua"/"dạo này"/"gần đây" = last_30_days; "tuần này" = this_week. Không nói kỳ nào → this_cycle. \
Khoảng ngày cụ thể → custom với from_date, to_date dạng YYYY-MM-DD.
Một ngày ("hôm nay", "hôm qua", "hôm kia", "ngày 15/9", "ngày mai") → custom với from_date = to_date = đúng ngày đó, \
chép ngày từ dòng "Hôm nay/Hôm qua/Hôm kia" ở trên. Ngày không ghi năm → lần gần nhất không sau hôm nay. \
"Hôm nay so với hôm qua" → metric compare, custom, from_date = to_date = hôm nay.

4. category_ids: CHỈ copy nguyên văn id từ danh sách trên, đúng loại thu/chi. Không bao giờ bịa id. Nếu câu nhắc một \
hạng mục mà không khớp chắc chắn, vẫn chọn id gần nhất và phản ánh qua category_confidence (0 đến 1): \
tên gần như trùng → cao; chỉ đoán theo nghĩa → thấp. Không nhắc hạng mục nào → để trống, không đặt category_confidence.

5. wallet_id: chỉ khi câu nhắc rõ một ví; copy nguyên văn id.

6. coverage = "full" CHỈ KHI mọi điều kiện trong câu đều đã được thể hiện bằng các trường ở trên. Nếu câu có bất kỳ \
điều kiện nào bạn không thể thể hiện (địa điểm, người, cửa hàng, ghi chú, giờ trong ngày, một hạng mục không có trong \
danh sách, ...) thì coverage = "partial". Ví dụ: "tháng này tiêu bao nhiêu cho ăn uống ở quận 1" = partial; \
"sáng nay tiêu bao nhiêu", "tối qua chi gì" (một buổi trong ngày) = partial. \
Không bao giờ bỏ qua một phần câu hỏi để trả lời phần còn lại.

7. Khi kind = "scenario" và câu là một MỤC TIÊU CÓ SỐ TIỀN (cần/muốn có/mua/để dành một khoản), điền:
- goal_amount_vnd: số tiền mục tiêu bằng đồng ("30m" = "30tr" = 30000000).
- goal_deadline: ngày cần có tiền, YYYY-MM-DD. Chỉ nói tháng → ngày 01 của tháng đó ("tháng 12 năm nay" = ngày 01/12 năm nay; tháng không ghi năm → lần gần nhất SAU hôm nay). Không nói thời hạn → để trống.
- monthly_save_vnd: chỉ khi câu nói rõ mỗi tháng để dành bao nhiêu ("để dành 3tr/tháng bao giờ đủ 50tr").
Ví dụ: "tháng 12 năm này thi bằng lái 30m thì mỗi tháng chi như nào" → scenario, goal_amount_vnd=30000000, goal_deadline = ngày 01/12 năm nay. "muốn mua laptop 25tr" → scenario, goal_amount_vnd=25000000.
Giả định cắt giảm một hạng mục ("cắt cà phê 50% thì dư bao nhiêu") → scenario, để trống ba trường trên.
Mọi kind khác "query": để trống các trường metric/period/category/wallet, coverage = "full"."""
