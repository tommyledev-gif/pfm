# Mẫu theo loại thành phần

Giới hạn độ dài là mốc để cắt, không phải mục tiêu. VI tính theo âm tiết (cách nhau bằng dấu cách), EN tính theo từ. Placeholder tính là 1.

## Mục lục
1. Bảng giới hạn nhanh
2. Nút / CTA
3. Empty state
4. Lỗi
5. Toast
6. Confirm dialog
7. Draft-confirmation (AI/tự động gợi ý)
8. Trạng thái ngân sách
9. Push notification
10. Onboarding và xin quyền
11. Setting và toggle
12. AI chat
13. Loading, placeholder, a11y

## 1. Bảng giới hạn nhanh

| Thành phần | VI (âm tiết) | EN (từ) | Dấu chấm cuối |
|---|---|---|---|
| Nút | ≤ 3 (tối đa 4) | ≤ 3 | Không |
| Tab/nav | 1-2 | 1-2 | Không |
| Title màn hình/sheet | ≤ 5 (tối đa 7) | ≤ 4 | Không |
| Label, placeholder, chip | ≤ 5 | ≤ 5 | Không |
| Toast | ≤ 6 | ≤ 6 | Không (cụm từ) |
| Body | ≤ 2 câu, ≤ 25 | ≤ 2 sentences, ≤ 25 | Có |
| Push title | ≤ 40 ký tự | ≤ 40 chars | Không |
| Push body | ≤ 90 ký tự | ≤ 90 chars | Có |
| AI chat reply | ≤ 2 câu + dữ liệu | ≤ 2 sentences + data | Có |

## 2. Nút / CTA

Công thức: **động từ + đối tượng** ("Lưu giao dịch", "Tạo ví", "Xóa bộ lọc"). Nút nói việc *sẽ xảy ra ngay khi bấm*, không nói mục tiêu xa.

- Nút chính trong form tạo/sửa: "Lưu", hoặc "Lưu + đối tượng" khi màn có nhiều thứ ("Lưu ngân sách").
- Không dùng: "Xác nhận" trơn, "OK", "Gửi", "Tiếp tục" (trừ wizard nhiều bước), "Có/Không".
- Không hứa điều không đảm bảo: "Gửi mã" không phải "Nhận mã".
- Nút phụ rút lui theo bảng phân biệt Hủy/Xóa/Bỏ qua/Đóng/Quay lại trong `vi-style.md`.
- Khó đặt tên nút thường là dấu hiệu màn hình làm quá nhiều việc: tách màn, đừng cố nén vào một nhãn.

Chip/nút trong lời user (role-play): viết bằng giọng user. "Tháng này mình chi bao nhiêu?" chứ không phải "Xem tổng chi tiêu".

## 3. Empty state

Empty state tốt tự hủy: chỉ đường để user thoát khỏi trạng thái rỗng. Không nói "ở đây trống" (hiển nhiên).

| Loại | Mẫu | Ví dụ VI | Ví dụ EN |
|---|---|---|---|
| Chưa có dữ liệu (lần đầu) | Sự thật + CTA | "Chưa có giao dịch." [Thêm giao dịch] | "No transactions yet." [Add transaction] |
| Thiếu điều kiện tiên quyết | Thiếu gì + tạo | "Chưa có ví. Tạo ví để ghi giao dịch." [Tạo ví] | "No wallet yet. Create one to log transactions." [Create wallet] |
| Không có kết quả search/lọc | Sự thật + 1 gợi ý + nút xóa lọc | "Không tìm thấy giao dịch" / "Thử từ khóa khác." [Xóa bộ lọc] | "No transactions found" / "Try another keyword." [Clear filters] |
| Rỗng tích cực | Chỉ sự thật, không CTA | "Không có thông báo mới." | "No new notifications." |
| Rỗng vì lỗi | Dùng mẫu lỗi, không dùng empty state | xem mục 4 | |

Nút "Xóa bộ lọc" chỉ hiện khi đang có bộ lọc. Không có bộ lọc mà vẫn rỗng thì dùng "Chưa có giao dịch.".

## 4. Lỗi

Cấu trúc: **chuyện gì** + (**vì sao**, nếu biết) + **làm gì**. Thêm **trạng thái tiền/dữ liệu** khi lỗi xảy ra trong luồng ghi tiền. Không đổ lỗi, không đùa, không xin lỗi dài (Google và NN/g cùng khuyến nghị).

Chỉ viết "Số dư chưa thay đổi" / "Giao dịch chưa được lưu" khi backend thực sự đảm bảo (ghi atomic trong một transaction). Nếu không chắc, bỏ câu đó và ghi vào assumption cho dev xác nhận.

| Tình huống | VI | EN |
|---|---|---|
| Mất mạng | Không có kết nối mạng. [Thử lại] | No connection. [Try again] |
| Server lỗi khi ghi tiền | Chưa lưu được giao dịch. Số dư chưa thay đổi. [Thử lại] | Couldn't save the transaction. Your balance hasn't changed. [Try again] |
| Server lỗi khi đọc | Chưa tải được giao dịch. [Thử lại] | Couldn't load transactions. [Try again] |
| Validation: thiếu | Chọn danh mục. | Choose a category. |
| Validation: sai khoảng | Nhập số tiền lớn hơn 0. | Enter an amount above 0. |
| Validation: vượt giới hạn | Số tiền tối đa {{max}}. | The maximum amount is {{max}}. |
| Đăng nhập sai | Email hoặc mật khẩu không đúng. | Incorrect email or password. |
| Hết phiên | Phiên đăng nhập đã hết hạn. [Đăng nhập lại] | Your session expired. [Sign in again] |
| Rate limit | Thử quá nhiều lần. Thử lại sau {{minutes}} phút. | Too many attempts. Try again in {{minutes}} min. |
| Thiếu quyền OS | Cần quyền thông báo để nhắc ngân sách. [Mở Cài đặt] | Notifications are off, so budget alerts can't reach you. [Open Settings] |
| Không tìm thấy | Không tìm thấy ví này. Có thể ví đã bị xóa. | This wallet wasn't found. It may have been deleted. |
| Xung đột (sửa trên 2 máy) | Giao dịch đã được sửa ở nơi khác. [Tải lại] | This transaction was changed elsewhere. [Reload] |
| Không rõ (phương án cuối) | Có lỗi xảy ra. [Thử lại] + mã lỗi nhỏ bên dưới | Something went wrong. [Try again] |

Lỗi không rõ chỉ là fallback (`errors.unknown`). Mỗi mã lỗi backend ổn định (`WALLET_NOT_FOUND`...) cần câu riêng ở client; không bao giờ hiển thị nguyên `message` từ server.

Lỗi inline ở field: đặt ngay dưới field, 1 câu, nói cách sửa ("Nhập số tiền lớn hơn 0"), không "Số tiền không hợp lệ".

## 5. Toast

- Thành công: "Đã lưu", "Đã xóa giao dịch", "Đã sao chép". Bỏ "thành công", bỏ "!".
- Có hoàn tác thì thêm nút [Hoàn tác] và giữ toast đủ lâu.
- Chỉ hiện sau khi server xác nhận. Optimistic UI phải có đường rollback kèm toast lỗi.
- Không dùng toast cho thông tin quan trọng/lỗi liên quan tiền (toast tự biến mất): dùng banner hoặc dialog.

## 6. Confirm dialog

Ưu tiên **hoàn tác** thay vì hỏi xác nhận. Chỉ dùng dialog khi không hoàn tác được hoặc hậu quả lớn.

**Xóa/không hoàn tác**
- Title: hành động + đối tượng, dạng câu hỏi ngắn. "Xóa giao dịch này?"
- Body: hậu quả cụ thể bằng số, 1-2 câu. "Số dư ví Tiền mặt tăng 50.000 ₫. Không thể hoàn tác."
- Nút: [Xóa giao dịch] (destructive) [Giữ lại]. Không "Có/Không", không "Hủy" cho nhánh an toàn vì "Hủy" mơ hồ (hủy xóa hay hủy dialog?).
- Xóa ví: nói số giao dịch bị ảnh hưởng. "Xóa ví Techcombank và 124 giao dịch trong ví. Không thể hoàn tác."

**Thoát khi chưa lưu**
- "Bỏ thay đổi?" / "Giao dịch chưa được lưu." [Bỏ thay đổi] [Tiếp tục sửa]

**Hành động nhạy cảm (đăng xuất, xóa tài khoản)**
- Nói hệ quả thật ("Dữ liệu trên máy này sẽ bị xóa") và chỉ yêu cầu gõ/biometric nếu backend thật sự yêu cầu.

## 7. Draft-confirmation (AI/tự động gợi ý)

Nguyên tắc kiến trúc của app: AI/automation chỉ gợi ý, user xác nhận mới ghi. Copy phải làm user *thấy* điều đó.

- Nhãn trạng thái: "Chờ xác nhận" (không "Đã ghi", không "Hoàn tất").
- Hiển thị trường đã parse ở dạng dễ đối chiếu: "50.000 ₫ · Ăn uống · Hôm nay · Ví Tiền mặt".
- Nút: [Lưu] [Sửa] [Bỏ]. Chỉ "Đã lưu" sau khi server xác nhận.
- Thiếu/mơ hồ một trường: nói đúng trường đó. "Chưa rõ danh mục. Chọn danh mục để lưu."
- Không nói "AI đã tự động ghi giao dịch cho bạn" khi thực ra chưa ghi.
- Trùng giao dịch nghi vấn (webhook ngân hàng): "Giống giao dịch 50.000 ₫ lúc 12:03. [Vẫn lưu] [Bỏ]".

## 8. Trạng thái ngân sách

Chỉ số liệu, không phán xét, không khuyên.

| Trạng thái | VI | EN |
|---|---|---|
| Bình thường | Còn 1.200.000 ₫ đến 31/10 | 1,200,000 ₫ left until Oct 31 |
| Cảnh báo (≥ 80%) | Ăn uống đã dùng 80% ngân sách tháng này | You've used 80% of this month's Food budget |
| Vượt | Ăn uống vượt 150.000 ₫ | Food is 150,000 ₫ over budget |
| Chưa đặt | Chưa đặt ngân sách. [Đặt ngân sách] | No budget set. [Set budget] |

Màu/biểu tượng không đứng một mình (a11y): luôn có chữ hoặc số kèm theo. Ngân sách thuộc một ví/một loại tiền: ghi rõ tiền tệ của ví, không gộp nhiều loại tiền.

## 9. Push notification

- Title = chủ thể + con số; body = một dòng hành động hoặc ngữ cảnh. Không emoji, không "Này bạn!", không thúc giục.
- Dùng số thật. Không dùng "Có cập nhật mới".
- Render ở backend theo ngôn ngữ user chọn. Cùng bộ quy tắc, cùng glossary.
- Không đưa thông tin nhạy cảm vào push (số dư đầy đủ, tên người nhận) trừ khi user bật tùy chọn; push hiện trên màn hình khóa.

Ví dụ: "Ăn uống đã dùng 90%" / "Còn 120.000 ₫ đến hết tháng." — "Food budget at 90%" / "120,000 ₫ left this month."
Ví dụ giao dịch webhook: "Chi 50.000 ₫" / "Chờ bạn chọn danh mục." — "Spent 50,000 ₫" / "Waiting for a category."

## 10. Onboarding và xin quyền

- Màn chào: một lời hứa cụ thể, không slogan. "Biết tiền đi đâu" / "Ghi thu chi, đặt ngân sách theo danh mục." [Bắt đầu]
- Xin quyền: **vì sao trước, việc user làm sau**. "Mở app bằng Face ID thay cho mật khẩu." [Bật Face ID] [Để sau]. Không "Chúng tôi cần quyền... để mang lại trải nghiệm tốt nhất".
- Nút từ chối trung tính: "Để sau", không "Không, cảm ơn" hay chữ làm user thấy có lỗi.
- Sau khi bị từ chối ở OS: giải thích cách bật lại, nút [Mở Cài đặt].
- Nội dung nhạy cảm về tiền/dữ liệu: nói rõ, luôn hiển thị, không giấu trong tooltip.

## 11. Setting và toggle

- Label nêu *thứ được bật*, không nêu hành động: "Ẩn số dư", không "Bật ẩn số dư".
- Helper (nếu cần): hệ quả khi bật, 1 câu. "Số dư hiển thị dạng ••••."
- Không giải thích cách thao tác ("Chạm để bật").

## 12. AI chat

Áp dụng cho cả phản hồi do LLM render (T3) và chuỗi cố định của UI chat. Prompt cho model nằm trong `llm-runtime-prompt.md`.

- Trả lời đi thẳng vào dữ liệu. Không mở bài ("Chắc chắn rồi!", "Dưới đây là...") và không kết bài ("Hy vọng giúp ích...", "Cần gì cứ hỏi nhé").
- Số liệu đến từ T2 (đã tính sẵn), model chỉ diễn đạt. Không để model tự tính hoặc làm tròn.
- ≤ 2 câu + dữ liệu. Danh sách chỉ khi ≥ 3 mục cùng loại.
- Không tự xưng (mặc định), không "Là một AI...", không xin lỗi dài.
- Từ chối (6 mẫu refusal): nói điều không làm được + điều làm được. "Chưa trả lời được câu này. Thử hỏi về chi tiêu, ngân sách hoặc ví." Không giải thích chính sách dài.
- Hỏi lại: một câu hỏi, kèm chip lựa chọn. "Ghi vào ví nào?" [Tiền mặt] [Techcombank]
- Không khuyên đầu tư/tài chính cá nhân hóa. Nêu số và so sánh theo mốc user tự đặt.
- Lỗi AI service: dùng bảng lỗi ở mục 4, không "AI đang gặp sự cố, vui lòng thử lại sau".
- Giữ đủ dấu tiếng Việt trong mọi phản hồi và khi echo lại input của user.

## 13. Loading, placeholder, a11y

- Đang tải: "Đang tải...". Nếu lâu và có việc cụ thể: "Đang đọc sao kê...". Không "Vui lòng chờ trong giây lát".
- Placeholder cho ví dụ thật mà user có thể gõ, không hướng dẫn thao tác: search giao dịch → "Tìm theo tên, ghi chú, số tiền" thay cho "Tìm kiếm". Placeholder biến mất khi gõ nên không đặt thông tin thiết yếu ở đó.
- `accessibilityLabel` mô tả nội dung/hành động, không mô tả hình dạng, và đọc đủ số tiền: "Chi 50.000 đồng, Ăn uống, hôm nay". Label a11y cũng phải vào locale file.
