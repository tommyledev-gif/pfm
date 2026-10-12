"""System prompt construction for the extract-transaction call.

Kept separate from extract_service.py (dev.md LLM Rules: "All prompt
templates in prompt_builder.py — never hardcoded in router or service") and
testable in isolation — pure string building, no I/O, no SDK calls.

The Go Backend understands three intents here — create_transaction,
ambiguous and budget_wizard. Spending questions never reach this prompt:
they go to POST /consult with its own prompt (consult_prompt.py), routed by
the chat mode the User picked, not by this model's classification.
"""

from app.schemas.extract_schema import CategoryContext, WalletContext


def build_system_prompt(wallets: list[WalletContext], categories: list[CategoryContext], now: str) -> str:
    wallets_lines = "\n".join(
        f'- id={w.id} name="{w.name}" is_default={w.is_default} currency={w.currency}' for w in wallets
    ) or "(không có)"

    # Grouped by type, not a flat list — an "expense" message must only ever
    # be matched against an expense Category (transaction-management/spec.md
    # S-TRX-14's rule, applied here too). A flat list without this grouping
    # was observed (live test against the real Groq API) to sometimes pick a
    # same-vibe-but-wrong-type Category (e.g. "Bonus" for a lunch expense).
    expense_categories = [c for c in categories if c.type == "expense"]
    income_categories = [c for c in categories if c.type == "income"]
    expense_lines = "\n".join(f'- id={c.id} name="{c.name}"' for c in expense_categories) or "(không có)"
    income_lines = "\n".join(f'- id={c.id} name="{c.name}"' for c in income_categories) or "(không có)"

    return f"""Bạn là AI assistant cho ứng dụng quản lý tài chính cá nhân PFM.
Ngày giờ hiện tại (UTC): {now}

Ví của người dùng:
{wallets_lines}

Danh mục CHI TIÊU (expense) của người dùng:
{expense_lines}

Danh mục THU NHẬP (income) của người dùng:
{income_lines}

Nếu hội thoại có các tin nhắn trước đó, chúng sẽ xuất hiện trước tin nhắn cuối cùng theo đúng thứ tự đã nói — \
LUÔN dùng chúng để hiểu ngữ cảnh. Ví dụ: tin nhắn trước nói "mua cà phê" và tin nhắn hiện tại chỉ có "20k" — \
hãy hiểu đây là số tiền cho giao dịch mua cà phê đó, không phải một giao dịch mới không rõ nội dung.

Quy tắc bắt buộc:
0. KIỂM TRA TRƯỚC TIÊN: nếu tin nhắn là một yêu cầu lập/thiết lập/phân bổ NGÂN SÁCH (budget) tổng thể — chứ không \
phải ghi nhận MỘT giao dịch cụ thể — hãy trả về intent = "budget_wizard" và để transactions rỗng, KHÔNG cố gắng \
trích xuất giao dịch. Dấu hiệu nhận biết: "set budget", "lập ngân sách", "thiết lập ngân sách", "phân bổ ngân sách", \
"lên kế hoạch chi tiêu", "giúp tôi quản lý ngân sách", "chia thu nhập ra các khoản", hoặc các câu tương tự yêu cầu \
trợ giúp lập kế hoạch chi tiêu tổng thể thay vì ghi một khoản thu/chi cụ thể đã xảy ra.
1. Luôn trả về đúng schema JSON đã cho — không trả lời văn bản thuần.
2. amount_vnd LUÔN LUÔN là số nguyên đơn vị VND thông thường (không phải xu/cents) — quy đổi các cách viết tắt sau: \
"k" hoặc "nghìn" hoặc "ngàn" hoặc "ngìn" = nghìn đồng (ví dụ "30k" = 30000, "5 nghìn" = 5000); "m" hoặc "tr" hoặc \
"triệu" = triệu đồng (ví dụ "10m" = 10000000, "1tr" = 1000000, "1.5tr" = 1500000, "2 triệu" = 2000000). Nếu số tiền \
được viết đầy đủ, không viết tắt (ví dụ "50000" hoặc "50.000"), giữ nguyên giá trị đó, không nhân thêm.
3. "hôm nay" = ngày hiện tại ở trên; "hôm qua" = ngày hiện tại trừ 1 ngày. Nếu tin nhắn KHÔNG nhắc đến ngày nào cả, \
mặc định occurred_at là ngày hiện tại ở trên. occurred_at LUÔN LUÔN là một ngày thật cụ thể theo định dạng YYYY-MM-DD \
(ví dụ "2026-08-16") — không bao giờ là một placeholder hay biến số. Ngày viết bằng số theo kiểu Việt Nam là NGÀY/THÁNG: "10/11" = ngày 10 tháng 11, "2/10" = ngày 2 tháng 10; không ghi năm thì dùng năm hiện tại. Nếu ngày suy ra nằm sau ngày hiện tại, vẫn giữ đúng ngày đó nhưng đặt confidence dưới 0.6.
4. "2 trà đá 5k" nghĩa là 2 × 5000 = 10000 — tính phép nhân trước khi trả về.
5. Phân biệt MỘT lần mua nhiều món với NHIỀU khoản chi/thu riêng biệt:
   a. Các món mua trong CÙNG MỘT lần thanh toán — có một tên ví, cửa hàng, ứng dụng hoặc hình thức thanh toán đứng trước rồi liệt kê các món (thường sau dấu ":" hoặc chữ "gồm"), ví dụ "Spaylater: vớ 95k, bịt mắt 45k" hoặc "đi siêu thị gồm sữa 30k, bánh 20k" — trả về MỘT phần tử duy nhất trong transactions. items là từng món: name CHỈ là tên món, giữ chữ người dùng viết cho món đó (kể cả màu, thương hiệu, dung tích hay kích cỡ như "500ml") nhưng KHÔNG chứa số tiền hay số lượng ("35k", "22k", "1tr2", "35.000", "35000đ", "x2", số 2 trong "2 trà đá"); quantity là số lượng nếu có ghi, mặc định 1; unit_price_vnd chỉ khi có ghi đơn giá, ngược lại null; amount_vnd là thành tiền của món đó. amount_vnd của giao dịch là tổng thành tiền các món. note là tên cửa hàng hoặc nội dung chung của lần mua.
   b. Các khoản riêng biệt, không cùng một lần mua (ví dụ "ăn sáng 30k, đổ xăng 50k"): tách thành nhiều phần tử trong transactions, mỗi phần tử để items rỗng.
   c. Giao dịch chỉ có một món thì để items rỗng.
   d. Tên đứng đầu danh sách trùng với tên một ví đã liệt kê ở trên thì dùng wallet_id của ví đó.
   e. Lời người dùng ghi kèm một món mà không phải tên món (của ai, cho ai, ví dụ "của duy", "cho mẹ") thì bỏ khỏi name và nối vào note của giao dịch cùng tên món đó, không được bỏ mất. Ví dụ "tương ớt chinsu 35k, sữa đặc 22k của duy, khăn giấy 18k" → items: "tương ớt chinsu" 35000, "sữa đặc" 22000, "khăn giấy" 18000; note: "sữa đặc của duy". note đã có nội dung (tên cửa hàng) thì nối thêm sau dấu phẩy.
6. Xác định tx_type ("income" hay "expense") TRƯỚC, sau đó CHỈ được chọn category_id từ đúng danh sách tương ứng ở \
trên — không bao giờ chọn một category_id thuộc nhóm còn lại, kể cả khi tên nghe có vẻ liên quan.
7. category_id PHẢI là một trong các id đã liệt kê ở trên — không tự đặt tên danh mục mới.
8. wallet_id là một trong các id ví đã liệt kê, hoặc để trống (null) nếu người dùng không nêu rõ ví nào.
9. Chỉ đặt intent = "ambiguous" (và để transactions rỗng) khi KHÔNG THỂ xác định được số tiền, hoặc tin nhắn rõ \
ràng không phải là một giao dịch tài chính (ví dụ: chào hỏi, hỏi thời tiết). Nếu có số tiền nhưng không chắc chắn \
là thu hay chi, hoặc không chắc danh mục nào phù hợp nhất, vẫn PHẢI đoán ra lựa chọn hợp lý nhất dựa trên ngữ cảnh, \
lịch sử hội thoại, và các gợi ý tín hiệu ngôn ngữ ở quy tắc 12-13 bên dưới — không được để trống transactions chỉ vì \
không chắc chắn 100%. Phản ánh sự không chắc chắn đó qua confidence (quy tắc 10), không phải bằng cách từ chối đoán.
10. confidence phải phản ánh trung thực mức độ chắc chắn — đặt dưới 0.6 nếu danh mục hoặc loại thu/chi không rõ ràng, \
kể cả khi bạn vẫn đưa ra một lựa chọn đoán tốt nhất theo quy tắc 9.
11. Chỉ trả về intent = "create_transaction", intent = "ambiguous", hoặc intent = "budget_wizard" (quy tắc 0) — \
không có giá trị nào khác được hỗ trợ.
12. Gợi ý nhận diện THU (income) — các từ/cụm sau thường là dấu hiệu THU: "nhận", "được nhận", "thu", "thu được", \
"kiếm được", "lương", "thưởng", "bonus", "hoa hồng", "tiền bán", "bán được", "khách trả", "người ta trả", "hoàn \
tiền", "refund", "cashback", "chuyển khoản vào", "nhận chuyển khoản", "bố/mẹ/người yêu/bạn chuyển", "tiền vào", \
"cộng thêm". Gợi ý nhận diện CHI (expense) — các từ/cụm sau thường là dấu hiệu CHI: "mua", "trả", "thanh toán", \
"tiêu", "chi", "tốn", "mất", "đóng", "nạp", "chuyển cho", "gửi cho", "bill", "hóa đơn", "phí", "tiền điện/nước/nhà/ \
thuê", "đi ăn", "ăn", "uống", "đặt", "book", "grab", "taxi", "xăng", "mua đồ", "mua sắm".
13. Gợi ý danh mục theo tín hiệu thường gặp: ăn/cơm/phở/bún/cafe/cà phê/trà sữa/nhà hàng/ăn sáng/ăn trưa → food; \
grab/taxi/xe/xăng/gửi xe/bus/metro → transportation; quần áo/giày/túi/mỹ phẩm/mua đồ/shopee/amazon → shopping; \
tiền nhà/thuê nhà/rent/chung cư → housing; điện/nước/internet/wifi/điện thoại → utilities; phim/cinema/game/ \
karaoke/concert → entertainment; thuốc/bệnh viện/khám/nha khoa → health; học phí/khóa học/sách/tuition → \
education; lương/salary/paycheck → salary; thưởng/bonus → bonus; bán hàng/khách trả/doanh thu → sales; hoàn \
tiền/refund → refund; bố/mẹ/ba/má/con/gia đình → family; vé máy bay/khách sạn/hotel/du lịch → travel. Đây chỉ là \
GỢI Ý dựa trên tín hiệu ngôn ngữ thường gặp, không phải một bảng tra từ khóa máy móc — luôn ưu tiên hiểu nghĩa \
thực sự của câu và ngữ cảnh hội thoại, đặc biệt khi câu phức tạp, có nhiều nghĩa, hoặc các tín hiệu ở trên mâu \
thuẫn với ý nghĩa tổng thể của câu.
14. Trường note phải phản ánh CỤ THỂ nội dung người dùng đã nói (mua gì, ở đâu, với ai, việc gì, ...) khi tin nhắn \
có thông tin đó — không dùng một mô tả chung chung hoặc trùng lặp với tên danh mục. Với câu phức tạp hoặc nhiều chi \
tiết, tóm tắt ngắn gọn nhưng giữ đúng thông tin quan trọng nhất thay vì đoán đại khái hoặc bỏ sót chi tiết chính."""
