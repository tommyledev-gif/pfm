# Quy tắc i18n cho locale file

Giả định: client dùng i18next (v4 plural, JSON), mobile (Expo) và web (Next.js) dùng chung quy ước key. Nếu đổi sang ICU MessageFormat/Lingui thì phần plural và placeholder đổi cú pháp, các nguyên tắc giữ nguyên.

## Mục lục
1. Quy trình viết hai ngôn ngữ
2. Đặt key
3. Placeholder và ghép chuỗi
4. Plural
5. Tiền, ngày, số
6. Lỗi từ backend và AI service
7. Dữ liệu user chèn vào chuỗi
8. Chuỗi nằm ngoài locale file
9. Kiểm thử

## 1. Quy trình viết hai ngôn ngữ

- Viết **VI native trước** (user chính), rồi **EN native từ cùng ý định**. Không dịch từng chữ, không để model dịch VI→EN→VI.
- Mỗi key mới đi kèm ngữ cảnh cho người/ model sau: nơi hiển thị, giới hạn độ dài, ý nghĩa placeholder. Lưu trong key `"_note"` cạnh nhóm key (lint bỏ qua key bắt đầu bằng `_`) hoặc trong PR description.
- VI và EN phải có **cùng tập key, cùng tập placeholder** (lint kiểm tra). Plural khác nhau theo ngôn ngữ (mục 4).
- Thêm ngôn ngữ thứ ba về sau: bắt đầu từ ý định + glossary, không từ bản dịch của bản dịch.

## 2. Đặt key

- Dạng `feature.screen.element[.state]`: `wallet.empty.title`, `wallet.empty.cta`, `transaction.delete.confirm.body`.
- Đặt theo vai trò, không theo nội dung chữ. `wallet.empty.title`, không `no_wallet_yet`: chữ đổi thì key không phải đổi.
- Hậu tố slot rõ ràng để lint áp giới hạn độ dài: `.title`, `.body`, `.cta`/`.button`, `.label`, `.placeholder`, `.toast`, `.chip`, `.hint`.
- **Một key = một ngữ cảnh.** Không dùng lại "Xóa" của nút cho "Xóa" của menu nếu nghĩa/độ dài khác; từ đồng âm khác nghĩa ("Tháng" là nhãn lịch vs tiêu đề) cũng tách key. Chung chuỗi chỉ khi cùng ngữ cảnh thật sự (`common.action.save`).
- Không dùng chính chuỗi tiếng Anh làm key.
- Key phải ổn định: đổi tên key là breaking change với bản dịch và analytics.

## 3. Placeholder và ghép chuỗi

- **Không ghép chuỗi** từ nhiều key hay nối bằng `+`/template literal. Thứ tự từ khác nhau giữa VI và EN. Một câu hoàn chỉnh = một key.
  - ✗ `t('spent') + ' ' + amount + ' ' + t('on') + ' ' + category`
  - ✓ `"transaction.row.summary": "Chi {{amount}} cho {{category}}"`
- Placeholder đặt tên theo nghĩa: `{{amount}}`, `{{wallet}}`, `{{date}}`, không `{{0}}`, `{{x}}`.
- Giá trị truyền vào đã được **format sẵn** (tiền, ngày: mục 5). Không bỏ logic format vào chuỗi.
- Không chứa HTML/Markdown trong chuỗi. In đậm/link dùng `<Trans>` với `components`; lint kiểm tra thẻ `<0>`…`</0>` khớp giữa VI và EN.
- Giữ `skipOnVariables` mặc định (true) của i18next để giá trị do user nhập chứa `{{...}}` không bị nội suy ngược.

## 4. Plural

- CLDR: tiếng Việt chỉ có category `other`. Tiếng Anh có `one` và `other`.
- VI: chỉ viết `_other`. Không viết `_one`, không viết cặp "ví/các ví".
- EN: viết đủ `_one` và `_other`. Không tự viết `count === 1 ? 'wallet' : 'wallets'`.
- Ví dụ i18next v4:

```json
// vi.json
"wallet.count_other": "{{count}} ví"
// en.json
"wallet.count_one": "{{count}} wallet",
"wallet.count_other": "{{count}} wallets"
```
- Trường hợp 0 là tình huống UI riêng (empty state), không nhồi vào plural: dùng key `wallet.empty.*` và điều kiện trong component.
- Số thứ tự ("thứ 1") dùng ordinal riêng, không dùng cardinal.

## 5. Tiền, ngày, số

- API trả tiền dạng **số nguyên đơn vị nhỏ nhất** hoặc decimal string; không float. Client chuyển sang giá trị format bằng `Intl.NumberFormat(locale, { style: 'currency', currency })` với currency của ví (ngân sách và ví gắn một loại tiền).
- VND không có phần thập phân; USD có 2 chữ số. Để `Intl` quyết định, không `toFixed` tay.
- Không dùng `parseFloat` để xử lý số tiền user nhập (keypad dùng token reducer). Copy chỉ nhận giá trị đã format.
- Ngày/giờ: `Intl.DateTimeFormat` và `Intl.RelativeTimeFormat` theo locale user, **múi giờ theo ngữ cảnh** (habit dùng `local_date` theo timezone của habit, không UTC). "Hôm nay/Hôm qua" tính theo timezone của user, không của server.
- Không hardcode "đ", "VNĐ", "₫" trước/sau số trong locale file; lint báo ERROR.

## 6. Lỗi từ backend và AI service

- Backend/AI service trả **mã lỗi ổn định** (`WALLET_NOT_FOUND`, `RATE_LIMITED`), không trả câu hiển thị. Client map `errors.<CODE>` → chuỗi đã dịch, kèm `errors.unknown` làm fallback.
- Không hiển thị `message` thô từ server (có thể lộ chi tiết nội bộ, sai ngôn ngữ).
- Tham số động của lỗi (`retryAfterSeconds`, `max`) đi qua field riêng trong response để client đưa vào placeholder.
- Không đưa token, email đầy đủ, số tài khoản vào chuỗi lỗi, toast, hay log.
- Mã lỗi nhỏ ở cuối màn lỗi (cho support) là request id ngẫu nhiên, không phải dữ liệu user.

## 7. Dữ liệu user chèn vào chuỗi

- Tên ví, tên danh mục, ghi chú là dữ liệu không tin cậy và độ dài bất kỳ. Chuỗi phải đúng cả khi tên dài 60 ký tự, chứa emoji, hoặc là `{{amount}}`.
- Cắt dài bằng ellipsis ở cuối (tên) hoặc giữa (mã), cắt ở tầng UI, không cắt trong locale file.
- React tự escape; không dùng `dangerouslySetInnerHTML` với chuỗi i18n. Push/notification là plain text.
- Test với tên ví tiếng Việt có dấu tổ hợp (NFD) để chắc chắn so sánh/ cắt không làm vỡ ký tự: chuẩn hóa NFC khi lưu.

## 8. Chuỗi nằm ngoài locale file

Những thứ sau cũng là copy, dễ bị bỏ sót:

- **Dữ liệu seed trong DB** (tên danh mục mặc định "Ăn uống", tên ví mặc định "Tiền mặt"): hoặc lưu `name_key` và dịch ở client, hoặc seed theo locale user lúc đăng ký. Chọn một cách; mix hai ngôn ngữ trong cùng danh sách là bug. Danh mục user tự tạo không bao giờ dịch.
- **Push notification** render ở backend: cần bản template và `users.locale`.
- **System prompt và output của AI service** (T3): xem `llm-runtime-prompt.md`.
- **accessibilityLabel**, tiêu đề tab/screen của Expo Router, title của share sheet, nội dung export `.xlsx`, tên file tải về.
- **Permission rationale** của OS (`Info.plist` / `app.json`): có bản dịch riêng theo ngôn ngữ OS, không theo ngôn ngữ app.

## 9. Kiểm thử

- Chạy `python scripts/lint_copy.py <thư mục locales>` trước khi merge. ERROR chặn merge.
- Pseudo-localization hoặc chuỗi cực dài (+50%) để thấy chỗ vỡ layout trước khi user thấy.
- Chuyển ngôn ngữ giữa chừng: màn đang mở có cập nhật không, có giữ nguyên dữ liệu user nhập không.
- Snapshot test cho các màn có chuỗi động (plural, tiền) ở cả `vi` và `en`.
