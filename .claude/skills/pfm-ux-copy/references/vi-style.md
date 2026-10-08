# Văn phong tiếng Việt cho UI

Nguồn: nguyên tắc UX writing quốc tế (Smashing, Google, Mailchimp, Wikipedia "Signs of AI writing") áp vào tiếng Việt, cộng với copy đang có trong app. Phần tiếng Việt cụ thể là phán đoán, chưa kiểm chứng với user thật: nếu user beta phản hồi ngược lại thì sửa file này.

## Mục lục
1. Câu Việt tự nhiên trong UI
2. Từ và cấu trúc cấm
3. Particle cuối câu (nhé/nha/ạ)
4. Dấu câu và định dạng
5. Bảng before/after

## 1. Câu Việt tự nhiên trong UI

- **Bỏ chủ ngữ.** Mệnh lệnh và trạng thái không cần "Bạn": "Tạo ví để ghi giao dịch", không "Bạn hãy tạo ví để có thể ghi giao dịch".
- **Chủ động, bỏ "được/bị" kiểu dịch.** "Giao dịch đã được tạo" → "Đã tạo giao dịch". Giữ "bị" khi nghĩa tiêu cực thật ("Giao dịch bị từ chối").
- **Bỏ "thành công"** khi thành công là mặc định: "Đã lưu", không "Lưu thành công". Chỉ giữ khi có thể thành công một phần ("Đã nhập 38/40 giao dịch").
- **Bỏ "các/những/của bạn"** khi không phân biệt gì: "Xem giao dịch", không "Xem các giao dịch của bạn". Chỉ giữ "của bạn" khi cần tách với dữ liệu người khác (ví chia sẻ).
- **Từ thuần Việt hơn Hán-Việt trang trọng**: làm/tạo/mở/vào thay cho thực hiện/khởi tạo/truy cập/thao tác. "Không vào được" thay cho "Truy cập thất bại".
- **Câu ngắn.** Body ≤ 2 câu, mỗi câu lý tưởng ≤ 12 âm tiết, tối đa 20. Câu dài hơn thường chứa 2 ý.
- **Nói điều được phép thay vì liệt kê điều cấm**: "Chỉ dùng chữ và số", không "Không dùng ký tự đặc biệt". Tránh phủ định kép. Phủ định trực tiếp thì ổn: "Chưa có ví", "Không tìm thấy giao dịch".
- **Từ mượn tiếng Anh**: giữ khi user nói hàng ngày (app, email, PIN, Face ID, OK). Dịch khi là jargon: OTP → "mã xác thực 6 số", sync → "đồng bộ", backup → "sao lưu", export → "xuất file", dashboard → "tổng quan". Token, session, API không bao giờ lên UI.
- **Phân biệt các nút "rút lui"**: *Hủy* (dừng một quá trình đang chạy/đang nhập), *Xóa* (xóa dữ liệu), *Bỏ qua* (không làm bước này), *Đóng* (đóng thông báo/sheet), *Quay lại* (về màn trước, không mất gì), *Giữ lại* (cặp với Xóa trong confirm).

## 2. Từ và cấu trúc cấm

Cột mức khớp với `scripts/lint_copy.py` (ERROR = chặn, WARN = xem lại).

### Mở/đóng kiểu chatbot (ERROR)
Chắc chắn rồi / Tất nhiên / Dưới đây là / Tuyệt vời / Rất vui được giúp / Hy vọng điều này giúp ích / Nếu cần thêm... hãy cho mình biết / Là một AI...

### Giả thân thiện, xin lỗi dài (ERROR)
Oops / Ôi / Úi / Rất tiếc / Xin lỗi vì sự bất tiện / Chúng tôi xin lỗi / Vui lòng / Hãy cùng / Quý khách / Quý vị

### Từ marketing rỗng
- ERROR: hành trình, đồng hành, nâng tầm, bứt phá, đột phá, kiến tạo, làm chủ tài chính, tự do tài chính, tương lai tài chính
- WARN: thông minh, tối ưu, toàn diện, mượt mà, tiện lợi, dễ dàng, nhanh chóng, hiệu quả, chuyên nghiệp, khám phá, trải nghiệm

Nếu muốn dùng một từ WARN, hỏi: nó có thể bị thay bằng một con số hoặc một việc cụ thể không? "Ghi chi tiêu trong 5 giây" thắng "ghi chi tiêu nhanh chóng", nhưng chỉ khi con số đó đúng với sản phẩm. Không chứng minh được thì bỏ.

### Cấu trúc "mùi AI"
- Gạch dài "—" nối ý (ERROR). Thay bằng dấu chấm, hai chấm, hoặc tách câu.
- "Không chỉ... mà còn..." (ERROR). Nói thẳng điều có.
- Bộ ba tính từ/lợi ích: "nhanh chóng, tiện lợi và an toàn". Một ví dụ cụ thể đáng giá hơn ba tính từ chung chung.
- "Dù bạn là... hay..." (WARN); "để giúp bạn", "giúp bạn", "cho phép bạn" (WARN): nói app làm gì, đừng nói app "giúp".
- "một cách + tính từ" (WARN): "một cách dễ dàng" → bỏ hoặc đổi thành động từ.
- "Bạn có thể..." / "Hãy..." đầu câu (WARN).
- Lặp một ý hai lần bằng hai cách nói (title và body nói cùng một điều).
- Dấu "!" (WARN một lần, ERROR từ hai lần), emoji (ERROR).

### Hành chính/dịch máy (WARN)
thực hiện, tiến hành, khởi tạo, thao tác, đã được, thành công, hệ thống, sự cố, "Đã xảy ra lỗi" trơn, "chúng tôi" (app tự xưng).

### Lộ thông tin bảo mật
"Sai mật khẩu" hoặc "Email không tồn tại" riêng lẻ cho phép dò tài khoản. Dùng "Email hoặc mật khẩu không đúng".

## 3. Particle cuối câu (nhé / nha / nè / ạ)

Mặc định **cấm** trong toàn bộ UI. Trong tiếng Việt, "nhé" tự nhiên khi hai người đối thoại trực tiếp, nhưng khi app nói "Nhớ lưu giao dịch nhé" thì nghe như bot cố tỏ ra thân thiện, và với app tiền thì giảm độ tin cậy. LLM thêm "nhé" như phản xạ.

Đây là default, không phải chân lý. Nếu muốn giọng ấm hơn cho một bề mặt cụ thể (ví dụ onboarding), ghi rõ trong brief của bề mặt đó, giới hạn ≤ 1 lần mỗi màn, và chạy lint với `--allow-particles`. Không dùng particle ở: lỗi, tiền, xóa, bảo mật.

## 4. Dấu câu và định dạng

- Title, nút, label, tab, placeholder, chip, toast dạng cụm từ: **không chấm cuối**.
- Body là câu đầy đủ: **có chấm cuối** (khớp copy hiện tại: "Chưa có giao dịch nào.").
- Dấu hỏi chỉ cho câu hỏi thật (confirm dialog): "Xóa giao dịch này?".
- "..." chỉ ở placeholder và trạng thái đang tải ("Tìm giao dịch...", "Đang tải..."). Không dùng "..." để gợi cảm xúc.
- "–" (en dash) chỉ cho khoảng giá trị ("01/10 – 31/10"). Không dùng "—".
- Số: chữ số cho mọi số trong UI ("3 ví", không "ba ví").
- Tiền: luôn qua `Intl.NumberFormat('vi-VN', { style: 'currency', currency })` rồi truyền vào placeholder. VND ra dạng "1.250.000 ₫". Không viết tay "đ", "VNĐ", "k", "tr".
- Ngày: qua `Intl.DateTimeFormat` / `Intl.RelativeTimeFormat`; "Hôm nay", "Hôm qua" cho khoảng gần. Không hardcode "dd/mm".
- Unicode NFC, đủ dấu. Chuỗi VI từ 4 âm tiết trở lên mà không có chữ có dấu nào gần như chắc chắn đã bị mất dấu.

## 5. Bảng before/after

Số trong ngoặc là số quy tắc ở SKILL.md.

| Trước (giọng AI) | Vấn đề | Sau |
|---|---|---|
| Khởi đầu tài chính thông minh | Slogan rỗng, không nói app làm gì (9, test thuộc về) | **Biết tiền đi đâu** / Ghi thu chi, đặt ngân sách theo danh mục. |
| Thử tìm kiếm với từ khóa khác hoặc điều chỉnh lại tiêu chí lọc để xem các giao dịch liên quan | 2 hành động, danh hóa, mục đích thừa (2, 4) | **Không tìm thấy giao dịch** / Thử từ khóa khác. [Xóa bộ lọc] |
| Bạn chưa có ví nào — giao dịch cần một ví để được lưu vào. Tạo ví trước, rồi quay lại nhắn cho mình nhé | Gạch dài, giải thích điều hiển nhiên, 3 câu, "nhé" (3, 8, 9) | **Chưa có ví. Tạo ví để ghi giao dịch.** [Tạo ví] |
| Giao dịch của bạn đã được tạo thành công! | Bị động, "thành công", "!" (4, 8) | Đã lưu giao dịch |
| Bạn có chắc chắn muốn xóa giao dịch này không? | Dịch máy, thường đi kèm nút Có/Không (6) | **Xóa giao dịch này?** Số dư ví Tiền mặt tăng 50.000 ₫. [Xóa giao dịch] [Giữ lại] |
| Oops! Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau. | "Oops", "Vui lòng", không nói lỗi gì (8, 10) | **Chưa lưu được giao dịch.** Số dư chưa thay đổi. [Thử lại] |
| Hãy cùng khám phá các tính năng tuyệt vời của ứng dụng! | Từ rỗng, "Hãy cùng", "!" (9) | (xóa; nếu cần một dòng: "Thêm giao dịch đầu tiên") |
| Bạn sắp vượt ngân sách ăn uống rồi nhé! | Mơ hồ, làm nũng (5, 8) | Ăn uống: đã dùng 90%, còn 120.000 ₫ |
| Chúc mừng! Bạn đã chi tiêu hợp lý trong tháng này! | Phán xét, chúc mừng giả (quy tắc riêng cho app tiền) | Tháng 10: chi 8.450.000 ₫, ít hơn tháng 9 là 620.000 ₫ |
| Vui lòng nhập số tiền hợp lệ | "Vui lòng", "hợp lệ" mơ hồ (8, 10) | Nhập số tiền lớn hơn 0 |
| Thao tác thất bại. Vui lòng kiểm tra kết nối mạng của bạn. | Hành chính, "thao tác" (4, 10) | Không có kết nối mạng. [Thử lại] |
| Đăng nhập thất bại: mật khẩu không chính xác | Lộ thông tin tài khoản | Email hoặc mật khẩu không đúng |
| Chúng tôi cần quyền truy cập thông báo để có thể gửi cho bạn các nhắc nhở hữu ích | Dài, "chúng tôi", "hữu ích" (7, 9) | Bật thông báo để nhận nhắc khi sắp vượt ngân sách. [Bật thông báo] [Để sau] |
| Dưới đây là tổng quan chi tiêu của bạn trong tháng này: | Mở bài kiểu chatbot (9) | Tháng này chi 8.450.000 ₫. Ăn uống cao nhất: 3.200.000 ₫. |
| Quản lý tài chính cá nhân của bạn một cách dễ dàng và hiệu quả | Bộ ba rỗng, "một cách" (9) | (bỏ; app đã tự giải thích bằng màn hình) |
