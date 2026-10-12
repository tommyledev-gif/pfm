# Glossary

Một khái niệm = một từ, ở cả VI và EN. Cột "Nguồn": `app` = đang dùng trong code hiện tại, `đề xuất` = chưa có trong app, cần Phuc duyệt. Thêm thuật ngữ mới vào đây trước khi dùng.

| Khái niệm | VI | EN | Nguồn | Ghi chú |
|---|---|---|---|---|
| Wallet | ví | wallet | app | Xem "Quyết định còn mở" |
| Transaction | giao dịch | transaction | app | |
| Income | thu nhập | income | app | |
| Expense | chi tiêu | spending | app | EN dùng "spending", không "expense(s)" trong UI chung; "expense" chỉ khi là một khoản cụ thể |
| Category | danh mục | category | app | |
| Budget | ngân sách | budget | app | Gắn với một ví/một loại tiền |
| Net worth | tài sản ròng | net worth | app | |
| Notification | thông báo | notification | app | |
| Audit log | nhật ký giao dịch | transaction history | app | EN tránh "audit log" (jargon); VI đang là "Nhật ký giao dịch" |
| Filter | bộ lọc | filter | đề xuất | App đang dùng "Xóa lọc"; đề xuất "Xóa bộ lọc" |
| Draft (AI gợi ý) | chờ xác nhận | pending | đề xuất | Nhãn trạng thái; nút dùng [Lưu]/[Sửa]/[Bỏ] |
| Skip | bỏ qua | skip | app | |
| Apply | áp dụng | apply | app | |
| Cash / Bank / E-wallet (loại ví) | tiền mặt / ngân hàng / ví điện tử | cash / bank / e-wallet | app | Xem "Quyết định còn mở" |
| Overview | tổng quan | overview | đề xuất | Thay "dashboard" |
| Backup | sao lưu | backup | đề xuất | |
| Sync | đồng bộ | sync | đề xuất | |
| Export / Import | xuất file / nhập file | export / import | đề xuất | |
| Item (dòng hàng của giao dịch) | món | item | app | Không có danh mục riêng; đếm "{{count}} món". Không dùng "mặt hàng", "sản phẩm" |
| Adjustment | thuế, phí, giảm giá | tax, fee, discount | app | Gọi theo loại: "Thuế", "Phí", "Giảm giá", "Khác". Nhóm chung trên UI: "Thuế, phí, giảm giá"; tránh "khoản điều chỉnh" (Hán-Việt, khó hiểu) |
| Items total | tổng các món | items total | app | Khác "số tiền" của giao dịch (số đã trả) |
| Lines total (sau thuế, phí, giảm giá) | tổng | total | app | Dòng duy nhất ở chân "Chi tiết món". Khớp số tiền giao dịch thì không nói gì thêm; lệch thì "Lệch {{amount}} so với số tiền giao dịch {{amount}}." |
| Line amount / Unit price (của một món) | thành tiền / đơn giá | amount / unit price | app | Thành tiền là số gốc; đơn giá chỉ hiện khi số lượng trên 1 |
| Undo | hoàn tác | undo | app | Sau khi xóa một dòng: "Đã xóa {{name}}" + [Hoàn tác] || Account (người dùng) | tài khoản | account | app | Chỉ cho tài khoản người dùng, không bao giờ cho ví |
| Username | tên đăng nhập | username | app | Đặt một lần lúc kích hoạt, đăng nhập thay email. Khác "tên hiển thị". Tài khoản kích hoạt trước khi có nó tự đặt một lần trong Hồ sơ: [Đặt tên đăng nhập] |
| Display name | tên hiển thị | display name | app | Tên người khác thấy, sửa được trong Hồ sơ |
| Access request | yêu cầu tạo tài khoản | access request | app | Gửi từ màn đăng nhập. Trạng thái: "Chờ duyệt" → "Chờ kích hoạt" → "Đang dùng" |
| Approve (yêu cầu) | duyệt | approve | app | Nút: "Duyệt yêu cầu" |
| Reject (yêu cầu) | từ chối | reject | app | Nút: "Từ chối", nhánh an toàn "Giữ lại". Yêu cầu bị xóa khỏi danh sách, người gửi gửi lại được. Đã duyệt hoặc đã từ chối: "không còn chờ duyệt" |

## Từ tránh dùng trong UI

| Tránh | Dùng |
|---|---|
| tài khoản (khi nói về ví) | ví |
| nguồn tiền (khi nói về ví) | ví |
| OTP | mã xác thực 6 số |
| token, session, API, payload | (không lên UI) |
| thao tác, thực hiện, khởi tạo | làm/tạo/mở (động từ cụ thể) |
| Quý khách | (bỏ xưng hô) |

## Quyết định còn mở

1. **"Ví" vs "nguồn tiền".** Code hiện tại dùng cả "Ví của bạn" (tiêu đề) và "{n} nguồn tiền" (đếm). Hai từ cho một thực thể vi phạm quy tắc 11. Đề xuất: chỉ dùng "ví".
2. **"Ví" vs "Ví điện tử".** "Ví điện tử" là một *loại* ví (MoMo, ZaloPay) nằm trong thực thể "ví" của app. Dễ gây hiểu lầm ở màn tạo ví ("Ví điện tử" là loại hay là ví của app?). Cân nhắc nhãn loại: "Tiền mặt", "Ngân hàng", "MoMo/ZaloPay" hoặc "Ví điện tử (MoMo, ZaloPay...)" kèm ví dụ.
3. **"Phân tích" vs "Tổng quan" vs "Thống kê"** cho màn insights: chọn một, đồng bộ tab và title.
4. **"Hủy" vs "Giữ lại"** cho nhánh an toàn trong confirm xóa. Skill đề xuất "Giữ lại"; nếu đổi, đổi đồng loạt.
5. **Tự xưng của AI chat**: mặc định bỏ chủ ngữ. Nếu muốn có persona ("mình"), quyết một lần, ghi vào đây, và cập nhật `llm-runtime-prompt.md`.
