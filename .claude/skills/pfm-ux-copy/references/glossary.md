# Glossary

Một khái niệm = một từ, ở cả VI và EN. Cột "Nguồn": `app` = đang dùng trong code hiện tại, `đề xuất` = chưa có trong app, cần Phuc duyệt. Thêm thuật ngữ mới vào đây trước khi dùng.

| Khái niệm | VI | EN | Nguồn | Ghi chú |
|---|---|---|---|---|
| Wallet | ví | wallet | app | Xem "Quyết định còn mở" |
| Transaction | giao dịch | transaction | app | |
| Income | thu nhập | income | app | |
| Expense | chi tiêu | spending | app | EN dùng "spending", không "expense(s)" trong UI chung; "expense" chỉ khi là một khoản cụ thể |
| Transfer (giữa hai ví của user) | chuyển khoản | transfer | app | Tab loại: "Chuyển khoản". Hai ô: "Từ ví" / "Đến ví"; ví đích là "ví nhận" ("Chọn ví nhận"). Số tiền không có dấu +/-. Không có danh mục, không có món |
| Category | danh mục | category | app | |
| Budget | ngân sách | budget | app | Gắn với một ví/một loại tiền |
| Currency (của ví) | loại tiền | currency | app | "Nhiều loại tiền", "Chỉ hiện ví cùng loại tiền", lỗi đổi ví khác loại tiền. Vài chỗ cũ còn "đơn vị tiền tệ": đổi dần sang "loại tiền" |
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
| Undo | hoàn tác | undo | app | Sau khi xóa một dòng: "Đã xóa {{name}}" + [Hoàn tác] |
| Account (người dùng) | tài khoản | account | app | Chỉ cho tài khoản người dùng, không bao giờ cho ví |
| Username | tên đăng nhập | username | app | Đặt một lần lúc kích hoạt, đăng nhập thay email. Khác "tên hiển thị". Tài khoản kích hoạt trước khi có nó tự đặt một lần trong Hồ sơ: [Đặt tên đăng nhập] |
| Display name | tên hiển thị | display name | app | Tên người khác thấy, sửa được trong Hồ sơ |
| Access request | yêu cầu tạo tài khoản | access request | app | Gửi từ màn đăng nhập. Trạng thái: "Chờ duyệt" → "Chờ kích hoạt" → "Đang dùng" |
| Approve (yêu cầu) | duyệt | approve | app | Nút: "Duyệt yêu cầu" |
| Reject (yêu cầu) | từ chối | reject | app | Nút: "Từ chối", nhánh an toàn "Giữ lại". Yêu cầu bị xóa khỏi danh sách, người gửi gửi lại được. Đã duyệt hoặc đã từ chối: "không còn chờ duyệt" |
| Signed-in device | thiết bị đang đăng nhập | signed-in device | app | Một máy đang giữ phiên của tài khoản này. Tiêu đề mục trong Bảo mật: "Thiết bị đang đăng nhập". Máy không báo tên: "Thiết bị không rõ tên". Dòng phụ: "Thiết bị này" / "Hoạt động {{date}}". Nút trên dòng: "Đăng xuất"; nút xác nhận: "Đăng xuất thiết bị", nhánh an toàn "Giữ lại" |
| Change password | đổi mật khẩu | change password | app | Dòng trong Bảo mật và tiêu đề màn: "Đổi mật khẩu"; nút cũng là "Đổi mật khẩu". Ba ô: "Mật khẩu hiện tại", "Mật khẩu mới", "Nhập lại mật khẩu mới". Khác "quên mật khẩu" |
| Forgot password | quên mật khẩu | forgot password | app | Link trên màn đăng nhập: "Quên mật khẩu?". Tiêu đề màn: "Đặt lại mật khẩu". Mã 6 số gửi qua email là "mã đặt lại" (ô: "Mã đặt lại"). Nút: "Gửi mã", "Gửi lại mã", "Đặt lại mật khẩu". Khác "đổi mật khẩu" (đang đăng nhập, biết mật khẩu cũ) |
| App PIN | mã PIN | app PIN | app | 6 số, thuộc về máy (mọi tài khoản lưu trên máy dùng chung), mở khóa ứng dụng và xác minh khi chuyển tài khoản. Dòng trong Bảo mật: "Mã PIN"; nút: "Đặt mã PIN", "Đổi mã PIN", "Tắt mã PIN". Màn nhập: "Nhập mã PIN". Khác "mã khóa màn hình" (của máy) |
| App lock | khóa ứng dụng | app lock | app | Công tắc "Khóa ứng dụng", màn khóa "Ứng dụng đang khóa" + [Mở khóa]. Khác "khóa màn hình" (của máy) và "Xác minh khi chuyển tài khoản" (chỉ hỏi khi chuyển) |
| Session ended (tài khoản đã lưu cần mật khẩu lại) | hết phiên | signed out | app | Nhãn trạng thái của tài khoản đã lưu trên máy: "Hết phiên". Câu khi bị từ chối: "Cần đăng nhập lại tài khoản này."; tài khoản đang dùng: "Phiên đăng nhập đã hết hạn.". Nhãn không dùng "Đã hết hạn" (bản cũ) |
| Passkey | passkey | passkey | app | Khóa đăng nhập lưu trên điện thoại, mở bằng vân tay/khuôn mặt, gắn với tài khoản. Giữ nguyên chữ "passkey" (Google/Apple cũng gọi vậy), viết thường giữa câu. Nút: "Đăng nhập bằng passkey", "Thêm passkey", "Xóa passkey". Chỉ khi chỉ đường vào Cài đặt của Android mới dùng chữ của máy: "khóa truy cập" (mục "Mật khẩu, khóa truy cập và tài khoản") |
| Saved place | nơi đã ghim | saved place | app | Vị trí từng ghim cho giao dịch, lưu trên máy để chọn lại ở bước "Ghim vị trí". Tiêu đề nhóm: "Đã ghim trước đây"; nút xóa: "Xóa nơi đã ghim" |
| Phrase (câu mẫu) | câu mẫu | phrase | app | Câu từng nhắn để ghi giao dịch, gợi ý lại trên ô chat. Ô tìm: "Tìm trong {{count}} câu mẫu"; nút: "Ưu tiên câu mẫu" / "Bỏ ưu tiên câu mẫu" / "Xóa câu mẫu". Toast: "Đã ưu tiên câu mẫu" / "Đã bỏ ưu tiên câu mẫu" |
| Priority phrase | câu ưu tiên | prioritized phrase | app | Câu mẫu được ghim lên đầu gợi ý và không bị câu mới đẩy ra (tối đa 20). Không gọi là "đã lưu": bấm nút không thêm câu nào, chỉ đổi thứ tự. Bản cũ ghi "Lưu câu mẫu" / "Bỏ lưu câu mẫu" làm người dùng tưởng là lưu hay bỏ lưu |
| Needs-review mark (một món/dòng AI đọc từ ảnh chưa chắc) | cần kiểm tra | check this | đề xuất | Nhãn cạnh từng món trong "Chi tiết món" của thẻ đọc từ ảnh. Khác "Độ tin cậy thấp" (nhãn cho cả thẻ). Không chặn lưu |
| Possible duplicate (thẻ đọc từ ảnh trùng giao dịch đã lưu) | giống giao dịch | looks like a saved transaction | đề xuất | Dòng trên thẻ: "Giống giao dịch {{amount}} ngày {{date}}"; nút lưu đổi thành "Vẫn lưu". Không chặn lưu |
| Shared wallet | ví chung | shared wallet | app | Ví chủ ví mời người khác vào để cùng ghi thu chi (specs/shared-wallets). Không gọi "sổ", "sổ chung", "ví nhóm". Trên thẻ: "Ví chung của {{owner}}" hoặc "{{type}} · Ví chung" |
| Personal wallets (tab) | ví cá nhân | personal | app | Tab màn Ví đối lập "Ví chung": ví của chính user. Không gọi "ví riêng", "ví của tôi" |
| Wallet owner | chủ ví | owner | app | Người tạo ví. Một ví một chủ ví |
| Recorder role (ví chung) | ghi chép | can record | app | Vai trò thêm được giao dịch vào ví chung. Khác "người ghi" (ai đã ghi một giao dịch: "{{name}} ghi") |
| Viewer role (ví chung) | chỉ xem | view only | app | Vai trò chỉ xem số dư và giao dịch |
| Invitation (ví chung) | lời mời | invitation | app | Nút: "Tham gia" / "Từ chối"; chủ ví rút lại: "Thu hồi lời mời". Trạng thái chưa trả lời: "Chờ trả lời"; mời bằng email chưa có tài khoản: "Chờ tạo tài khoản" |
| Leave (ví chung) | rời ví | leave | app | Nút và tiêu đề hộp xác nhận: "Rời ví" / "Rời ví {{wallet}}?", nhánh an toàn "Giữ lại" |
| Card colour (ví) | màu thẻ | card colour | app | Nhãn trong form ví; lựa chọn mặc định: "Màu tự động" |
| Admin role (tài khoản) | quản trị | admin | app | Nhãn vai trò tài khoản: "Quản trị" / "Thành viên"; tiêu đề chọn: "Vai trò" |
| System category | mặc định | default | app | Nhóm danh mục có sẵn trong Danh mục ("Mặc định"), đối lập "Của bạn" |
| Unusual (phân tích) | bất thường | unusual | app | Câu hỏi/trả lời phân tích chi tiêu khác hẳn mức thường ("Hôm nay có gì bất thường?") |
| Usual level (phân tích) | mức thường | usual | app | Trung vị của các kỳ trước có chi tiêu: "gấp 3 lần mức thường ngày (100.000 ₫)" |

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
4. **Tự xưng của AI chat**: mặc định bỏ chủ ngữ. Nếu muốn có persona ("mình"), quyết một lần, ghi vào đây, và cập nhật `llm-runtime-prompt.md`.

## Quyết định đã chốt

- **Nút an toàn trong confirm xóa / gỡ / bỏ: "Giữ lại"** (chốt 14/10/2026), không phải "Hủy". Nút nói việc sẽ xảy ra (quy tắc 6, CLAUDE.md: "Xóa giao dịch" / "Giữ lại"); trong hộp xóa, "Hủy" đọc được thành "hủy cái này" và nghe như cũng là xóa. Cụ thể hơn thì gọi tên thứ được giữ: "Giữ ví cũ". "Hủy" chỉ còn cho việc bỏ một form hoặc sheet đang nhập (nút "Hủy" ở đầu sheet). Code chưa theo hết: `ConfirmDialog` mặc định `cancelLabel = "Hủy"` và một chỗ còn "Huỷ"; đổi đồng loạt là việc riêng.
