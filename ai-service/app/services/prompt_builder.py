"""System prompt construction for the extract-transaction call.

Kept separate from extract_service.py (dev.md LLM Rules: "All prompt
templates in prompt_builder.py — never hardcoded in router or service") and
testable in isolation — pure string building, no I/O, no SDK calls.

This cut's Go Backend only understands two intents — create_transaction and
ambiguous (specs/ai-chat-assistant/spec.md Resolved design decision #2) — so
the prompt never asks the model to emit edit_transaction/query_spending/
general_advice, even though a broader Feature-12 vision includes them.
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

Quy tắc bắt buộc:
1. Luôn trả về đúng schema JSON đã cho — không trả lời văn bản thuần.
2. amount_vnd LUÔN LUÔN là số nguyên đơn vị VND thông thường (không phải xu/cents) — quy đổi các cách viết tắt sau: \
"k" hoặc "nghìn" hoặc "ngàn" hoặc "ngìn" = nghìn đồng (ví dụ "30k" = 30000, "5 nghìn" = 5000); "m" hoặc "tr" hoặc \
"triệu" = triệu đồng (ví dụ "10m" = 10000000, "1tr" = 1000000, "1.5tr" = 1500000, "2 triệu" = 2000000). Nếu số tiền \
được viết đầy đủ, không viết tắt (ví dụ "50000" hoặc "50.000"), giữ nguyên giá trị đó, không nhân thêm.
3. "hôm nay" = ngày hiện tại ở trên; "hôm qua" = ngày hiện tại trừ 1 ngày. Nếu tin nhắn KHÔNG nhắc đến ngày nào cả, \
mặc định occurred_at là ngày hiện tại ở trên. occurred_at LUÔN LUÔN là một ngày thật cụ thể theo định dạng YYYY-MM-DD \
(ví dụ "2026-08-16") — không bao giờ là một placeholder hay biến số.
4. "2 trà đá 5k" nghĩa là 2 × 5000 = 10000 — tính phép nhân trước khi trả về.
5. Nếu câu nhắn tin có nhiều khoản chi/thu riêng biệt, tách thành nhiều phần tử trong transactions.
6. Xác định tx_type ("income" hay "expense") TRƯỚC, sau đó CHỈ được chọn category_id từ đúng danh sách tương ứng ở \
trên — không bao giờ chọn một category_id thuộc nhóm còn lại, kể cả khi tên nghe có vẻ liên quan.
7. category_id PHẢI là một trong các id đã liệt kê ở trên — không tự đặt tên danh mục mới.
8. wallet_id là một trong các id ví đã liệt kê, hoặc để trống (null) nếu người dùng không nêu rõ ví nào.
9. Nếu không thể xác định rõ ràng số tiền, loại giao dịch (thu/chi), hoặc danh mục phù hợp đúng loại, đặt \
intent = "ambiguous" và để transactions rỗng.
10. confidence phải phản ánh trung thực mức độ chắc chắn — đặt dưới 0.6 nếu danh mục hoặc số tiền không rõ ràng.
11. Chỉ trả về intent = "create_transaction" hoặc intent = "ambiguous" — không có giá trị nào khác được hỗ trợ."""
