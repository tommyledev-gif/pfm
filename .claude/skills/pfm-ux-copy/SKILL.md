---
name: pfm-ux-copy
description: Viết và review mọi chuỗi chữ user nhìn thấy trong app Budgest/PFM (VI + EN) sao cho ngắn, tự nhiên, không lộ giọng AI. Gồm label, nút, title, empty state, error, toast, confirm dialog, draft-confirmation, onboarding, permission rationale, push notification, placeholder, locale JSON (vi.json/en.json, i18n key), và lời AI chat/AI service sinh ra. Dùng skill này bất cứ khi nào task có chữ hiển thị cho user, kể cả khi chỉ nói "thêm text", "viết copy", "đặt tên nút", "câu thông báo", "i18n", "locale", "microcopy", "UX writing", "empty state", "error message", "sửa câu này nghe như AI viết", hoặc khi code đang hardcode chuỗi tiếng Việt/Anh vào component. Không dùng cho docs kỹ thuật, spec, commit message, hay copy marketing/landing.
---

# PFM UX Copy

Viết chữ cho UI Budgest: user đang xử lý tiền trong vài giây, họ quét chứ không đọc. Copy tốt là copy mà user không nhận ra là có copy.

## Đọc file nào, khi nào

- Luôn: file này.
- Mọi chuỗi tiếng Việt: `references/vi-style.md` (từ cấm, mẫu câu, bảng before/after).
- Theo loại thành phần (nút, empty state, error, confirm, push, AI chat...): `references/patterns.md`.
- Đụng locale file, key, plural, placeholder, format tiền/ngày: `references/i18n-rules.md`.
- Trước khi đặt tên bất kỳ entity nào (ví, danh mục, ngân sách...): `references/glossary.md`.
- Viết/sửa system prompt cho AI service (T3 render): `references/llm-runtime-prompt.md`.
- Sau khi sửa locale file: chạy `python scripts/lint_copy.py <thư mục locales>`.

## Vì sao copy hay bị "AI"

Model viết để nghe hữu ích và ấm áp, không viết để user đọc xong trong 1 giây. Ba lỗi lặp đi lặp lại:

1. **Giải thích điều UI đã nói rồi.** "Giao dịch cần một ví để được lưu vào" (user vừa bị báo chưa có ví, họ biết).
2. **Nhồi 2-3 ý/hành động vào một chuỗi**, nối bằng "—", "và", "hoặc", "để".
3. **Giọng sai register**: slogan marketing ("Khởi đầu tài chính thông minh"), văn bản hành chính ("điều chỉnh lại tiêu chí lọc"), hoặc làm nũng ("...nhé").

Mọi quy tắc bên dưới là cách chặn ba lỗi này. Khi gặp tình huống chưa có quy tắc, quay về câu hỏi: *người đang đứng ở quầy thanh toán đọc câu này có hiểu và biết bấm gì trong 1 giây không?*

## Voice (cố định) và tone (đổi theo tình huống)

**Voice của Budgest:** người bạn rành tiền, nói ngắn, rõ, bình thản. Không hô khẩu hiệu, không khen, không dạy đời, không làm nũng, không giả vờ là con người.

**Tone đổi theo cảm xúc của user lúc đó** (nguyên tắc của Mailchimp: voice không đổi, tone đổi):

| Tình huống | Tone | Ví dụ |
|---|---|---|
| Hành động thường, thành công | Trung tính, 1-3 chữ | "Đã lưu" |
| Empty state | Chỉ đường, một dòng | "Chưa có ví. Tạo ví để ghi giao dịch." |
| Lỗi, nhất là liên quan tiền | Nghiêm, cụ thể, không đùa | "Chưa lưu được giao dịch. Số dư chưa thay đổi." |
| Không hoàn tác được (xóa, phạt) | Thẳng, nói rõ mất gì | "Xóa ví và 124 giao dịch trong ví. Không thể hoàn tác." |
| Chi tiêu vượt/sắp vượt | Số liệu, không phán xét | "Ăn uống vượt 150.000 ₫" |
| Cột mốc tích cực | Ấm hơn một nấc, vẫn ≤ 1 câu | "Đã đạt mục tiêu tiết kiệm tháng 10." |

## Quy trình

1. **Xác định bối cảnh** trước khi viết chữ nào: màn hình nào, user vừa làm gì, họ đang cảm thấy gì, hành động tiếp theo duy nhất là gì, ô chứa chữ rộng cỡ nào. Thiếu thông tin thì đưa assumption hợp lý nhất, ghi rõ, rồi viết luôn. Không hỏi lại nhiều lần.
2. **Viết VI native trước, rồi EN native từ cùng ý định.** Không dịch chữ-chữ từ ngôn ngữ này sang ngôn ngữ kia: dịch máy là nguồn gốc của "Bạn có chắc chắn muốn thực hiện thao tác này không?".
3. **Gọt** bằng bốn bài kiểm tra:
   - *Cut test*: xóa từng từ, nghĩa còn nguyên thì xóa luôn.
   - *Role-play test*: title/body là lời của app, nút/chip/placeholder là lời của user. Đọc to thành hội thoại thử, có ngượng miệng không?
   - *Test 20 phút*: chỉ nhìn title + nút, không đọc body, có hiểu chuyện gì đang xảy ra không?
   - *Test thuộc về*: câu này có thể dán vào app khác (MoMo, ngân hàng, app thời tiết) mà vẫn đúng không? Nếu có, nó quá chung chung.
4. **Kiểm tra** bằng checklist cuối file. Nếu có locale file, chạy lint.
5. **Trả kết quả** theo format ở mục "Output".

## 12 quy tắc

**1. Sự thật trước, hướng dẫn sau. Title và nút đứng độc lập được.**
User hay chỉ đọc title + nút. Đặt thông tin quan trọng ở đầu. Không mở bài kiểu "Rất tiếc,", "Hiện tại,", "Lưu ý:".

**2. Một chuỗi = một ý = một hành động tiếp theo.**
Nếu cần "hoặc" để nối hai hành động, tách hành động thứ hai thành nút/link.
- ✗ "Thử tìm kiếm với từ khóa khác hoặc điều chỉnh lại tiêu chí lọc để xem các giao dịch liên quan"
- ✓ "Không tìm thấy giao dịch" + "Thử từ khóa khác." + nút [Xóa bộ lọc]

**3. Cắt điều hiển nhiên.**
Nếu user vừa thấy hệ quả ngay trên màn hình, đừng giải thích lý do.
- ✗ "Bạn chưa có ví nào — giao dịch cần một ví để được lưu vào. Tạo ví trước, rồi quay lại nhắn cho mình nhé"
- ✓ "Chưa có ví. Tạo ví để ghi giao dịch." + nút [Tạo ví]

**4. Động từ, không danh hóa.**
"điều chỉnh lại tiêu chí lọc" → "đổi bộ lọc". "thực hiện việc xóa" → "xóa". "tiến hành đăng nhập" → "đăng nhập". Từ thuần Việt trước, Hán-Việt trang trọng sau.

**5. Cụ thể bằng số thật của user, không nói chung.**
- ✗ "Bạn sắp vượt ngân sách"
- ✓ "Ăn uống: còn 120.000 ₫ đến 31/10"
Số tiền, ngày, tên ví/danh mục đi vào qua placeholder đã format (xem i18n-rules).

**6. Nút nói đúng việc sẽ xảy ra. Cặp nút không dùng Có/Không.**
"Xóa giao dịch" / "Giữ lại", không phải "Có" / "Không". "Xác nhận" trơn và "OK" chỉ dùng khi dialog đã nói rõ chuyện gì. Không hứa điều không đảm bảo ("Gửi mã" chứ không phải "Nhận mã").

**7. Bỏ chủ ngữ, bỏ xưng hô thừa.**
Tiếng Việt không cần chủ ngữ ở câu mệnh lệnh/trạng thái. Không "Bạn có thể...", không "Chúng tôi...", không "Hãy...". App không tự xưng ("mình", "chúng tôi") trong UI. Trong AI chat, mặc định cũng bỏ chủ ngữ ("Chưa hiểu câu này"), chỉ dùng "mình" khi brief yêu cầu.

**8. Không tô vẽ cảm xúc.**
Cấm mặc định: "nhé/nha/nè/ạ" cuối câu, "!" , emoji, "Oops/Ôi", "Rất tiếc", "Vui lòng", "Chúc mừng!". Với app tiền, giọng thân mật giả tạo làm user nghi ngờ hơn là tin. Lỗi thì nói lỗi gì, không xin lỗi cả đoạn.

**9. Không từ rỗng, không cấu trúc "mùi AI".**
Từ rỗng: thông minh, tối ưu, toàn diện, mượt mà, hành trình, đồng hành, khám phá, trải nghiệm, làm chủ tài chính. Cấu trúc: gạch dài "—", "không chỉ... mà còn...", bộ ba tính từ/lợi ích, "Dù bạn là... hay...", "để giúp bạn...", "một cách + tính từ". Danh sách đầy đủ ở `vi-style.md`.

**10. Lỗi = chuyện gì + (vì sao, nếu biết) + làm gì. Luôn nói trạng thái tiền/dữ liệu.**
Không đổ lỗi user, không đùa, không "Đã xảy ra lỗi" trơn. Chỉ nói "Số dư chưa thay đổi" khi backend thật sự đảm bảo (transaction atomic). Xem bảng lỗi trong `patterns.md`.

**11. Một khái niệm = một từ.**
Ví là "ví", không lúc "ví" lúc "tài khoản" lúc "nguồn tiền". Tra `glossary.md`; từ mới phải thêm vào đó.

**12. Chữ không chứa dữ liệu định dạng.**
Tiền, ngày, số lượng đi qua `Intl` rồi mới vào placeholder. Không hardcode "đ", "VNĐ", "1/10". Không ghép chuỗi từ nhiều key. Plural theo CLDR (VI chỉ có `_other`).

## Quy tắc riêng cho app tiền

- **Draft-confirmation**: bản AI gợi ý phải trông là *chưa lưu* (nhãn "Chờ xác nhận", nút [Lưu]/[Sửa]/[Bỏ]). Chỉ hiện "Đã lưu" sau khi server xác nhận ghi xong.
- **Không phán xét, không khuyên**: "Bạn chi tiêu hợp lý!" và "Nên cắt giảm ăn uống" đều ngoài vai trò. Chỉ nêu số và so sánh với mốc user tự đặt.
- **Không hứa trong copy điều logic chưa đảm bảo**: "Giao dịch sẽ tự đồng bộ khi có mạng" chỉ viết khi offline queue có thật.
- **Không lộ thông tin bảo mật**: lỗi đăng nhập luôn là "Email hoặc mật khẩu không đúng", không nói cái nào sai. Không in token/email/số tài khoản vào toast hay log.
- **Dữ liệu user chèn vào câu** (tên ví, ghi chú) có thể dài hoặc chứa ký tự lạ: câu phải vẫn đúng khi tên ví dài 60 ký tự (cắt giữa, giữ đuôi) hoặc là "Ví {{amount}}".
- **Giữ đủ dấu tiếng Việt, Unicode NFC**, kể cả trong chip, push, tên mặc định của danh mục.

## Output

Khi viết mới, trả đúng cấu trúc này, không giải thích dài:

```json
{
  "wallet.empty.title": { "vi": "Chưa có ví", "en": "No wallets yet" },
  "wallet.empty.cta":   { "vi": "Tạo ví", "en": "Create wallet" }
}
```
- Key theo `feature.screen.element[.state]`, đặt theo vai trò, không theo nội dung chữ.
- Nếu có quyết định không hiển nhiên (chọn "Giữ lại" thay vì "Hủy"), thêm một dòng `note` ngắn. Không thì bỏ.
- Nếu chuỗi có placeholder hoặc giới hạn độ dài, ghi kèm: `{{count}} ví`, `max ~24 ký tự`.
- Ghi assumption ở cuối nếu có.

Khi review copy có sẵn, trả bảng: `Gốc | Vấn đề (số quy tắc) | Bản sửa`. Chỉ nêu vấn đề thật sự, không liệt kê mọi quy tắc.

## Checklist cuối

- [ ] Đọc xong title + nút đã hiểu chuyện gì và làm gì tiếp (test 20 phút)
- [ ] Mỗi chuỗi một ý; không "hoặc" nối hai hành động
- [ ] Không câu nào user đã biết rồi (quy tắc 3)
- [ ] Không "—", "!", emoji, "nhé", "Vui lòng", "Rất tiếc", từ rỗng
- [ ] Nút là việc sẽ xảy ra; cặp nút không Có/Không
- [ ] Lỗi nói chuyện gì + làm gì + trạng thái tiền
- [ ] Số liệu thật qua Intl, không hardcode tiền/ngày, không ghép chuỗi
- [ ] Thuật ngữ khớp glossary
- [ ] VI có đủ dấu, EN và VI cùng bộ placeholder, plural đúng CLDR
- [ ] Chuỗi vẫn đúng khi tên ví/danh mục dài
- [ ] `lint_copy.py` không còn ERROR
