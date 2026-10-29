# Translations: errors, server-rendered text, seed data, OS strings

> Scope: everything the mobile UI shows that is **not** a literal in `mobile/app` or `mobile/src`: backend `error_code`s, text the backend or AI service renders and stores, seeded system categories, and the OS permission strings in `mobile/app.json`. Conventions: [translations.md](./translations.md). Design and phasing: [spec.md](./spec.md) §5.6–5.9.
> 117 rows: 8 app-wide `errors.*` keys, 72 backend codes (§3), 11 validation-reason rows (§4), 8 notification rows, 14 system categories, 4 OS strings; plus the server-text inventory (§7).

## 1. How the client picks an error string

One resolver replaces `getErrorMessage(error, fallback)` (`mobile/src/lib/api-envelope.ts:44`), which today shows the server's `message` whenever there is one:

1. No answer from the server (`isNetworkError`) → `errors.network`.
2. A screen-specific map for this code exists (login, transaction save, access requests...) → that key. These live in the area files: [translations-auth.md](./translations-auth.md) (`login-error.ts`, password reset), [translations-transactions.md](./translations-transactions.md) (`items/save-error-message.ts`, outbox), [translations-manage.md](./translations-manage.md) (`access-request-errors.ts`), [translations-ai-chat.md](./translations-ai-chat.md) (image capture), [translations-budget-wizard.md](./translations-budget-wizard.md).
3. `errors.code.<ERROR_CODE>` below exists → that key, with placeholders filled from `details`.
4. Otherwise the caller's own fallback key (`budgets.form.saveError`, `wallets.form.error.saveFailed`, ...), and if none, `errors.unknown`.

The server `message` is **never** shown, in either language (`i18n-rules.md` §6). It stays in the API for logs and old app builds, so the backend does not have to change for the client switch.

## 2. App-wide error keys

Defined here; the network/offline/session ones are listed with their sources in [translations-shared.md](./translations-shared.md) ("Errors and session").

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `errors.unknown` | (none today: the caller's fallback or the raw server `message`) | Something went wrong. Try again. | new | Last fallback. Proposed VI: "Có lỗi xảy ra. Thử lại." (patterns §4) |
| `errors.network` | Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại. | Can't reach the server. Check your connection and try again. | constants.ts:36 | Rows in translations-shared.md. VI has "Vui lòng"; proposed VI: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." |
| `errors.needsConnection` | Cần kết nối mạng để thực hiện thao tác này. | Connect to the internet to do this. | constants.ts:37 | translations-shared.md |
| `errors.offlineRefresh` | Đang ngoại tuyến — chưa thể làm mới. | You're offline. Can't refresh yet. | constants.ts:38 | translations-shared.md |
| `errors.offlineNoData` | Chưa có dữ liệu đã lưu cho mục này. Kết nối mạng để tải. | Nothing saved here yet. Connect to load it. | constants.ts:47 | translations-shared.md |
| `errors.sessionExpired` | Phiên đăng nhập đã hết hạn. | Your session expired. | session-store.ts:27 | translations-shared.md |
| `errors.tooManyAttempts` | Thử quá nhiều lần. Thử lại sau 15 phút. | Too many attempts. Try again in {{minutes}} min. | password-reset-copy.ts:47, ChangePasswordForm.tsx:24 | `RATE_LIMITED` on password screens. VI value "Thử quá nhiều lần. Thử lại sau {{minutes}} phút." |
| `errors.saveTransactionFallback` | Không thể lưu giao dịch | Couldn't save the transaction. | save-error-message.ts:3, classify-send-error.ts:15 | Proposed VI: "Chưa lưu được giao dịch." (patterns §4) |

## 3. Backend error codes (`errors.code.*`)

VI (current) is the backend `message` today (`backend/internal/common/`); it is what users see now through `getErrorMessage`. Many are lower-case log fragments or break the skill, so the Notes give the VI value proposed for `vi.json`. EN follows patterns.md §4. HTTP status in brackets.

### Auth and accounts

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `errors.code.INVALID_CREDENTIALS` | email hoặc mật khẩu không đúng | Incorrect email or password. | errors.go:188 | [401] Login screen uses its own key (`auth.loginError.INVALID_CREDENTIALS`, "username or password"). Proposed VI: "Email hoặc mật khẩu không đúng." |
| `errors.code.ACCOUNT_NOT_ACTIVATED` | tài khoản này chưa được kích hoạt | This account isn't activated. Open the invite email to activate it. | errors.go:189 | [401] Same wording as login-error.ts |
| `errors.code.ACCOUNT_DISABLED` | tài khoản này đã bị vô hiệu hóa | This account is locked. Contact your admin. | errors.go:191 | [401] Proposed VI: "Tài khoản đã bị khóa. Liên hệ admin." (as login-error.ts) |
| `errors.code.ACCOUNT_AWAITING_APPROVAL` | Yêu cầu tạo tài khoản đang chờ admin duyệt. | Your access request is awaiting admin approval. | access_request.go:37 | [401] |
| `errors.code.UNAUTHENTICATED` | yêu cầu xác thực | Your session expired. Sign in again. | errors.go:193 | [401] Normally absorbed by the refresh interceptor; shown only if it leaks. Proposed VI: "Phiên đăng nhập đã hết hạn. Đăng nhập lại." |
| `errors.code.TOKEN_EXPIRED` | liên kết mời đã hết hạn | This invite link has expired. Ask your admin for a new one. | errors.go:186 | [410] Proposed VI: "Liên kết mời đã hết hạn. Nhờ admin gửi lại." |
| `errors.code.RATE_LIMITED` | quá nhiều yêu cầu, vui lòng thử lại sau | Too many attempts. Try again in a few minutes. | errors.go:187 | [429] Screens with a known window use `errors.tooManyAttempts`. Proposed VI: "Thử quá nhiều lần. Thử lại sau ít phút." |
| `errors.code.EMAIL_ALREADY_EXISTS` | đã tồn tại tài khoản với email này | This email already has an account. | errors.go:183 | [409] Proposed VI: "Email này đã có tài khoản." |
| `errors.code.USER_NOT_PENDING` | người dùng này không còn ở trạng thái chờ kích hoạt | This invitation is no longer waiting for activation. | errors.go:190 | [409] Proposed VI: "Lời mời này không còn chờ kích hoạt." |
| `errors.code.INVITE_RESEND_COOLDOWN` | vừa gửi lời mời gần đây, vui lòng đợi rồi thử lại | Invitation sent recently. Try again in {{minutes}} min. | errors.go:265 | [429] `{{minutes}}` from `details.available_at`. Proposed VI: "Vừa gửi lời mời. Thử lại sau {{minutes}} phút." |
| `errors.code.WEAK_PASSWORD` | Mật khẩu cần ít nhất ${MinPasswordLength} ký tự. / Mật khẩu mới cần ít nhất … / Mật khẩu tối đa ${MaxPasswordBytes} ký tự không dấu. | Use {{min}} to {{max}} characters. | auth_service.go:76, password_change.go:36, password_reset_service.go:116, password.go:19 | [400] One code, two causes. Client validates length first (`auth.password.tooShort`), so this is a backstop. Backend task: add `details.reason` (`too_short` / `too_long`) to pick `auth.password.tooShort` vs a too-long key. VI: "Dùng {{min}} đến {{max}} ký tự." |
| `errors.code.PASSWORD_MISMATCH` | mật khẩu và xác nhận mật khẩu không khớp | The two passwords don't match. | errors.go:192 | [400] Proposed VI: "Hai mật khẩu chưa khớp." |
| `errors.code.WRONG_CURRENT_PASSWORD` | Mật khẩu hiện tại không đúng. | Current password is incorrect. | password.go:43 | [400] |
| `errors.code.SAME_PASSWORD` | Mật khẩu mới trùng mật khẩu hiện tại. | The new password is the same as the current one. | password.go:44 | [400] |
| `errors.code.RESET_CODE_INVALID` | Mã không đúng hoặc đã hết hạn. | The code is wrong or has expired. | password_reset.go:37 | [400] The reset screen uses `auth.resetPassword.codeInvalid` (same text) |
| `errors.code.USERNAME_TAKEN` | Tên đăng nhập đã có người dùng. | This username is taken. | access_request.go:33 | [409] |
| `errors.code.USERNAME_ALREADY_SET` | Tài khoản đã có tên đăng nhập. | This account already has a username. | access_request.go:34 | [409] |
| `errors.code.INVALID_USERNAME` | (one of the six reasons in §4) | This username can't be used. | access_request.go:42 | [400] Fallback when no reason is sent. Proposed VI: "Tên đăng nhập này chưa dùng được." |
| `errors.code.INVALID_FULL_NAME` | (one of the three reasons in §4) | This name can't be used. | access_request.go:52 | [400] Fallback. Proposed VI: "Tên này chưa dùng được." |
| `errors.code.ADMIN_NOT_FOUND` | Không có admin nào dùng email này. | No admin uses this email. | access_request.go:35 | [422] Same as `auth.requestAccess.ADMIN_NOT_FOUND` |
| `errors.code.ACCESS_REQUEST_HANDLED` | Yêu cầu này không còn chờ duyệt. | This request is no longer awaiting approval. | access_request.go:36 | [409] Same as `users.request.notWaiting` |
| `errors.code.PASSKEYS_UNAVAILABLE` | Chưa dùng được passkey. Đăng nhập bằng mật khẩu. | Passkeys aren't available. Sign in with your password. | passkey.go:36 | [503] |
| `errors.code.PASSKEY_FAILED` | Không xác minh được passkey. Thử lại. | Couldn't verify the passkey. Try again. | passkey.go:40 | [401] Same text as `security.passkeys.signInFailed` |
| `errors.code.PASSKEY_NOT_FOUND` | Không tìm thấy passkey này. | This passkey wasn't found. | passkey.go:41 | [404] |
| `errors.code.PASSKEY_LIMIT` | Đã đủ ${MaxPasskeysPerUser} passkey. Xóa bớt một passkey để thêm mới. | You already have {{max}} passkeys. Delete one to add another. | passkey.go:42 | [409] `{{max}}` client constant (no `details` today). VI: "Đã đủ {{max}} passkey. Xóa bớt một passkey để thêm mới." |

### Wallets, categories, budgets, transactions

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `errors.code.FORBIDDEN` | bạn không có quyền thực hiện hành động này | You don't have access to this. | errors.go:184 | [403] Proposed VI: "Tài khoản này không có quyền làm việc này." |
| `errors.code.NOT_FOUND` | không tìm thấy tài nguyên | This item wasn't found. It may have been deleted. | errors.go:185 | [404] Proposed VI: "Không tìm thấy mục này. Có thể đã bị xóa." |
| `errors.code.WALLET_ACCESS_DENIED` | bạn không có quyền truy cập ví này | You don't have access to this wallet. | errors.go:194 | [403] Proposed VI: "Không có quyền với ví này." |
| `errors.code.WALLET_NOT_FOUND` | không tìm thấy ví | This wallet wasn't found. It may have been deleted. | errors.go:195 | [404] patterns §4. Proposed VI: "Không tìm thấy ví này. Có thể ví đã bị xóa." |
| `errors.code.CURRENCY_LOCKED` | không thể đổi đơn vị tiền tệ khi ví đã có giao dịch | This wallet has transactions, so its currency can't change. | errors.go:214 | [409] Glossary "loại tiền". Proposed VI: "Ví đã có giao dịch nên không đổi được loại tiền." |
| `errors.code.CATEGORY_ACCESS_DENIED` | bạn không có quyền truy cập danh mục này | You don't have access to this category. | errors.go:196 | [403] |
| `errors.code.CATEGORY_NOT_FOUND` | không tìm thấy danh mục | This category wasn't found. It may have been deleted. | errors.go:197 | [404] |
| `errors.code.CATEGORY_ALREADY_EXISTS` | a ${categoryType} category named ${name} already exists | A category with this name already exists. | category_service.go:75 | [409] Server message is English today. Proposed VI: "Đã có danh mục tên này." |
| `errors.code.CATEGORY_IN_USE` | danh mục này đang được một ngân sách sử dụng | A budget uses this category. Delete the budget first. | errors.go:198 | [409] Proposed VI: "Danh mục đang có ngân sách. Xóa ngân sách trước." |
| `errors.code.BUDGET_ACCESS_DENIED` | bạn không có quyền truy cập ngân sách này | You don't have access to this budget. | errors.go:199 | [403] |
| `errors.code.BUDGET_NOT_FOUND` | không tìm thấy ngân sách | This budget wasn't found. It may have been deleted. | errors.go:200 | [404] |
| `errors.code.BUDGET_ALREADY_EXISTS` | danh mục này đã có một ngân sách đang hoạt động | This category already has a budget. | errors.go:201 | [409] Proposed VI: "Danh mục này đã có ngân sách." |
| `errors.code.INVALID_CATEGORY_TYPE` | chỉ có thể đặt ngân sách cho danh mục chi tiêu | Budgets work with spending categories only. | errors.go:202 | [422] Proposed VI: "Chỉ đặt ngân sách cho danh mục chi tiêu." |
| `errors.code.TRANSACTION_ACCESS_DENIED` | bạn không có quyền truy cập giao dịch này | You don't have access to this transaction. | errors.go:203 | [403] |
| `errors.code.TRANSACTION_NOT_FOUND` | không tìm thấy giao dịch | This transaction wasn't found. It may have been deleted. | errors.go:204 | [404] |
| `errors.code.INSUFFICIENT_BALANCE` | Số dư không đủ | Not enough balance in this wallet. | errors.go:205 | [409] Also in translations-ai-chat.md (use-confirm-proposal.ts:65). Refused before any write. Proposed VI: "Số dư ví không đủ." |
| `errors.code.CATEGORY_TYPE_MISMATCH` | loại giao dịch phải khớp với loại danh mục | This category doesn't match the transaction type. Choose another. | errors.go:206 | [422] Proposed VI: "Danh mục không khớp loại giao dịch. Chọn danh mục khác." |
| `errors.code.TRANSFER_SAME_WALLET` | ví nguồn và ví nhận phải khác nhau | Choose two different wallets. | errors.go:207 | [422] Proposed VI: "Chọn hai ví khác nhau." |
| `errors.code.TRANSFER_CURRENCY_MISMATCH` | chỉ chuyển được giữa hai ví cùng đơn vị tiền tệ | Transfers only work between wallets with the same currency. | errors.go:208 | [422] Proposed VI: "Chỉ chuyển giữa hai ví cùng loại tiền." |
| `errors.code.TRANSFER_CATEGORY_IMMUTABLE` | không thể đổi danh mục của giao dịch chuyển khoản | A transfer's category can't be changed. | errors.go:209 | [422] |
| `errors.code.TRANSFER_WALLET_IMMUTABLE` | không thể đổi ví của giao dịch chuyển khoản | A transfer's wallets can't be changed. | errors.go:210 | [422] Transaction form uses its own copy (save-error-message.ts) |
| `errors.code.WALLET_CURRENCY_MISMATCH` | chỉ đổi được sang ví cùng đơn vị tiền tệ | Move it only to a wallet with the same currency. | errors.go:211 | [422] Transaction form uses its own copy |
| `errors.code.ITEMS_TOTAL_MISMATCH` | Tổng các món chưa khớp số tiền giao dịch. | The items total doesn't match the transaction amount. | errors.go:243 | [422] `details` carries the figures; the form uses its own copy |
| `errors.code.ITEMS_NOT_ALLOWED` | Giao dịch chuyển tiền không có món. | Transfers can't have items. | errors.go:212 | [422] |
| `errors.code.TRANSACTION_CHANGED` | Giao dịch đã được sửa ở nơi khác. | This transaction was changed elsewhere. | errors.go:213 | [409] Normally shown as the stale-edit dialog |
| `errors.code.INVALID_INPUT` | (field-specific; English log text such as "malformed request body", or VI for images and names) | Some details aren't right. Check them and try again. | errors.go:233 | [400] Client validates first; backstop only. Proposed VI: "Có thông tin chưa đúng. Kiểm tra rồi thử lại." Image and name cases: §4 |
| `errors.code.ICON_UPLOAD_UNAVAILABLE` | chức năng tải ảnh biểu tượng chưa được cấu hình | Icon upload isn't available. Choose an emoji instead. | errors.go:218 | [503] Proposed VI: "Chưa tải được ảnh biểu tượng. Chọn emoji thay thế." |
| `errors.code.ICON_UPLOAD_FAILED` | không thể tải ảnh biểu tượng lên, vui lòng thử lại | Couldn't upload the icon. Try again. | errors.go:219 | [502] Proposed VI: "Chưa tải được ảnh biểu tượng. Thử lại." |
| `errors.code.NOTIFICATION_ACCESS_DENIED` | bạn không có quyền truy cập thông báo này | You don't have access to this notification. | errors.go:215 | [403] |
| `errors.code.NOTIFICATION_NOT_FOUND` | không tìm thấy thông báo | This notification wasn't found. | errors.go:216 | [404] |

### Shared wallets

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `errors.code.WALLET_MEMBER_USER_NOT_FOUND` | không tìm thấy tài khoản này | No account with this email or username. | errors_wallet_members.go:32 | [404] Proposed VI: "Không có tài khoản nào dùng email hoặc tên đăng nhập này." |
| `errors.code.WALLET_MEMBER_NOT_FOUND` | người này không có trong ví | This person isn't in the wallet. | errors_wallet_members.go:33 | [404] |
| `errors.code.WALLET_MEMBER_EXISTS` | người này đã được mời vào ví | This person is already invited. | errors_wallet_members.go:34 | [409] |
| `errors.code.WALLET_MEMBER_LIMIT` | ví đã đủ 10 người | This wallet already has {{max}} people. | errors_wallet_members.go:35 | [409] VI: "Ví đã đủ {{max}} người." |
| `errors.code.WALLET_INVITATION_NOT_FOUND` | lời mời không còn hiệu lực | This invitation is no longer valid. | errors_wallet_members.go:36 | [404] Proposed VI: "Lời mời không còn hiệu lực." |

### Assistant, photos, budget wizard

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `errors.code.AI_SERVICE_UNAVAILABLE` | trợ lý AI tạm thời không khả dụng, vui lòng thử lại | The assistant isn't available right now. Try again. | errors.go:217 | [502] Proposed VI: "Trợ lý chưa trả lời được. Thử lại." |
| `errors.code.IMAGE_TOO_LARGE` | Ảnh quá lớn. Chọn ảnh khác. | This photo is too large. Choose another. | errors_ai_image.go:16 | [413] |
| `errors.code.UNSUPPORTED_IMAGE_TYPE` | Chỉ nhận ảnh PNG, JPEG hoặc WebP. | Use a PNG, JPEG or WebP image. | errors_ai_image.go:18 | [415] |
| `errors.code.AI_IMAGE_BUSY` | Chưa đọc được ảnh. Thử lại sau 1 phút. | Couldn't read the photo. Try again in {{minutes}} min. | errors_ai_image.go:25 | [503] `{{minutes}}` from `details.retry_after_seconds` (already done in the image hooks) |
| `errors.code.AI_IMAGE_DISABLED` | Đọc ảnh đang tạm dừng. | Photo reading is paused. | errors_ai_image.go:20 | [503] |
| `errors.code.DUPLICATE_CATEGORY_IN_REQUEST` | một danh mục xuất hiện nhiều lần trong yêu cầu | A category appears twice. Remove one. | errors.go:220 | [422] Proposed VI: "Một danh mục bị lặp. Bỏ bớt một dòng." |
| `errors.code.TOO_MANY_BUDGETS` | chỉ có thể tạo tối đa 20 ngân sách trong một lần | Up to {{max}} budgets at a time. | errors.go:221 | [422] VI: "Tạo tối đa {{max}} ngân sách mỗi lần." |
| `errors.code.DISPOSABLE_NONPOSITIVE` | Chi phí cố định và tiết kiệm đã vượt thu nhập. Kiểm tra lại các số này. | Fixed costs and savings are more than your income. Check these amounts. | errors.go:226 | [400] |
| `errors.code.DISPOSABLE_TOO_SMALL` | Số tiền còn lại quá nhỏ so với số danh mục đã chọn. Bỏ bớt vài danh mục. | What's left is too little for this many categories. Remove a few. | errors.go:227 | [400] |
| `errors.code.PLAN_VERSION_CONFLICT` | Ngân sách vừa được cập nhật ở thiết bị khác. Thử lại. | Your budgets were just updated on another device. Try again. | errors.go:228 | [409] |

### Never shown

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `errors.code.METHOD_NOT_ALLOWED` | (Fiber text) | (uses `errors.unknown`) | errors.go:158 | Programming error; no own key |
| `errors.code.REQUEST_ERROR` | (Fiber text) | (uses `errors.unknown`) | errors.go:159 | Programming error; no own key |

## 4. Validation reasons the server sends only as text

These reach the user today only as the server `message`. To translate them the backend adds a stable `details.reason`; until then the client shows the code-level fallback from §3 in EN and keeps showing the VI `message` in VI (spec.md §5.6, transitional rule).

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `errors.code.INVALID_USERNAME.empty` | Nhập tên đăng nhập. | Enter a username. | access_request.go:88 | reason `empty` |
| `errors.code.INVALID_USERNAME.length` | Tên đăng nhập dài 3 đến 30 ký tự. | Use 3 to 30 characters. | access_request.go:90 | reason `length` |
| `errors.code.INVALID_USERNAME.charset` | Chỉ dùng chữ không dấu, số, dấu chấm hoặc gạch dưới. | Use letters without accents, digits, dots or underscores. | access_request.go:92 | reason `charset` |
| `errors.code.INVALID_USERNAME.start` | Tên đăng nhập bắt đầu bằng chữ cái. | Start with a letter. | access_request.go:94 | reason `start` |
| `errors.code.INVALID_USERNAME.end` | Tên đăng nhập kết thúc bằng chữ hoặc số. | End with a letter or digit. | access_request.go:96 | reason `end` |
| `errors.code.INVALID_USERNAME.doubleSeparator` | Không đặt hai dấu chấm hoặc gạch dưới liền nhau. | Don't put two dots or underscores in a row. | access_request.go:99 | reason `double_separator` |
| `errors.code.INVALID_FULL_NAME.empty` | Nhập tên. | Enter a name. | profile_name.go:30 | Also INVALID_INPUT on profile save |
| `errors.code.INVALID_FULL_NAME.tooLong` | Tên tối đa 60 ký tự. | Use at most {{max}} characters. | profile_name.go:33 | VI: "Tên tối đa {{max}} ký tự." |
| `errors.code.INVALID_FULL_NAME.charset` | Tên chỉ gồm chữ, số, dấu cách và . , ' - | Use letters, digits, spaces and . , ' - only. | profile_name.go:37 | |
| `errors.code.IMAGE_MISSING` | Chưa chọn ảnh. | No photo selected. | image_upload.go:27 | Sent as INVALID_INPUT today; backend task: own code |
| `errors.code.IMAGE_UNREADABLE` | Không đọc được ảnh này. Chọn ảnh khác. | Couldn't open this photo. Choose another. | image_upload.go:36, :43; chat_image_handler.go:60, :67 | Sent as INVALID_INPUT today; backend task: own code |

## 5. Notifications (rendered by the backend, stored per row)

Today `notifications.title` / `.body` are rendered once, in one language, when the row is created, and the list mixes languages already: `budget_exceeded` is English, the other three types are Vietnamese. Decision (spec.md §5.7): the client renders title and body from `type` + structured params; the stored text stays as the fallback for unknown types and for rows created before params existed. Backend task: return a `params` object per row (new nullable JSONB column, filled at creation).

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `notifications.type.budget_exceeded.title` | Budget exceeded: %s (English today) | {{category}} is over budget | notification_service.go:128 | Proposed VI: "{{category}} vượt ngân sách". `{{category}}` translated via `system_key` (§6) |
| `notifications.type.budget_exceeded.body` | You've spent %s against a %s monthly limit for %s. (English today) | Spent {{spent}} of {{limit}}. | notification_service.go:129 | Proposed VI: "Đã chi {{spent}} trên hạn mức {{limit}}." The old "monthly" is wrong since budget cycles (v2 wizard) |
| `notifications.type.access_request.title` | Yêu cầu tạo tài khoản | Access request | access_request_service.go:81 | Admin only |
| `notifications.type.access_request.body` | requester.Email + " đã gửi yêu cầu tạo tài khoản Budgest." | {{email}} asked for a Budgest account. | access_request_service.go:81 | VI: "{{email}} đã gửi yêu cầu tạo tài khoản Budgest." Admin sees the requester's email by design |
| `notifications.type.wallet_invite.title` | Lời mời vào ví chung | Shared wallet invitation | wallet_member_service.go:101 | |
| `notifications.type.wallet_invite.body` | ${ownerName} mời bạn vào ví ${wallet.Name}. | {{owner}} invited you to {{wallet}}. | wallet_member_service.go:102 | VI: "{{owner}} mời bạn vào ví {{wallet}}." |
| `notifications.type.wallet_member_joined.title` | Thành viên mới trong ví | New wallet member | wallet_member_service.go:200 | |
| `notifications.type.wallet_member_joined.body` | ${name} đã tham gia ví ${wallet.Name}. | {{name}} joined {{wallet}}. | wallet_member_service.go:201 | VI: "{{name}} đã tham gia ví {{wallet}}." |

Push notifications: the app has none today (no `expo-notifications`). If push is added, the backend renders it and needs `users.locale` (spec.md §5.8).

## 6. Seed data: system categories

System categories (`user_id IS NULL`) carry a stable `system_key` (migration 019, 022). The client shows `categories.system.<system_key>` for them and the stored `name` for everything else; user-created categories are never translated (`i18n-rules.md` §8). Every DTO that embeds `category_name` also carries `category_id`, so the client resolves it from the cached categories list (spec.md §5.9).

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `categories.system.food` | Ăn uống | Food & drink | 019_categories_system_key.sql:55 | expense |
| `categories.system.transport` | Di chuyển | Transport | 019_categories_system_key.sql:56 | expense |
| `categories.system.entertainment` | Cafe & Giải trí | Coffee & entertainment | 019_categories_system_key.sql:57 | expense |
| `categories.system.shopping` | Mua sắm | Shopping | 019_categories_system_key.sql:58 | expense |
| `categories.system.health` | Sức khoẻ | Health | 019_categories_system_key.sql:59 | expense. VI old spelling; "Sức khỏe" if VI is ever normalised (needs a migration, not a key) |
| `categories.system.housing` | Nhà ở | Housing | 019_categories_system_key.sql:60 | expense |
| `categories.system.utilities` | Hoá đơn & Tiện ích | Bills & utilities | 019_categories_system_key.sql:61 | expense |
| `categories.system.salary` | Lương | Salary | 019_categories_system_key.sql:62 | income |
| `categories.system.bonus` | Thưởng | Bonus | 019_categories_system_key.sql:63 | income |
| `categories.system.investment` | Đầu tư | Investment | 019_categories_system_key.sql:64 | income |
| `categories.system.savings` | Tiết kiệm | Savings | 017_seed_savings_category.sql:8 | expense |
| `categories.system.children_education` | Con cái & Học tập | Kids & education | 019_categories_system_key.sql:72 | expense |
| `categories.system.other` | Chi khác | Other spending | 019_categories_system_key.sql:73 | expense |
| `categories.system.transfer` | Chuyển khoản | Transfer | 022_transaction_transfer.sql:47 | transfer; same word as `common.txType.transfer` |

The VI column is the DB value; `vi.json` repeats it so both languages go through one lookup.

## 7. Server-rendered text that is not an error (inventory, Phase 3)

Not translated by the client. Each surface keeps the language it was rendered in until the backend renders by locale (spec.md §5.8). Counts are Vietnamese string literals in the file (2026-10-29).

| Surface | Rendered in | Examples (VI) | Literals | Decision |
|---|---|---|---|---|
| Assistant reply lead-ins (recording mode) | `backend/internal/service/chat_service.go:73-188` | "Ghi vào ví nào?", "Kiểm tra lại %d giao dịch bên dưới trước khi lưu." | 8 | Phase 3: backend renders by `Accept-Language`. Stored chat bubbles keep their language |
| Photo reading replies | `chat_image_reply.go:14-30` | "Không đọc được khoản thu chi nào trong ảnh. Chụp lại rõ hơn." | 6 | Phase 3 |
| Analysis answers, period labels, follow-up chips, anomaly answers, consult routing | `analytics_template.go`, `analytics_period_label.go`, `analytics_followups.go`, `analytics_anomaly_template.go`, `analytics_anomaly_followups.go`, `consult_routing.go`, `consult_scenario.go`, `consult_anomaly.go`, `consult_day_guard.go` | "Chưa hiểu câu này. Thử:", "Tháng này tiêu bao nhiêu?", "Xem %d %s gần nhất" | ~130 | Phase 3. These are Go templates over computed numbers (no LLM), so an EN table per template is enough |
| Budget wizard notices and confidence text | `common/constants_budget.go`, `budget_wizard_service.go`, `budgetproposal/quantize.go` | (notice strings) | ~14 | Phase 3 |
| Import row reasons | `transaction_import_validation.go`, `transaction_import_rows.go`, `transaction_import_service.go`, `transaction_import_handler.go` | (per-row reason) | ~25 | Phase 3: return a reason code + params per row; client keys `transactions.import.reason.*` |
| AI service prompts and extraction | `ai-service/app/services/*.py`, `ai-service/app/nlu/*` | Vietnamese system prompts, VI NLU rules | n/a | Unchanged. Input understanding stays Vietnamese-first; EN input is Open Question 6 |
| Category suggestion (AI) | `ai-service/app/services/category_suggestion_service.py` | suggests a VI category name | n/a | Phase 3: pass locale so the suggested name matches the UI language |
| Emails (activation, access request, approval, password reset) | `smtp_email_templates.go` | "Kích hoạt tài khoản Budgest", "Mã đặt lại mật khẩu Budgest" | 30 | Out of scope (needs `users.locale`; invite emails go to people with no app setting yet) |
| Activation and approve web pages | `handler/activate_page_handler.go`, `handler/approve_access_page_handler.go` | (HTML pages) | 34 | Out of scope (web, opened from email) |

## 8. OS permission strings and app name (native, `mobile/app.json`)

Shown by Android/iOS, in the **phone's** language, not the app's (`i18n-rules.md` §8). Changing them needs a new APK (fingerprint), not OTA.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `native.permission.faceId` | Budgest dùng Face ID để xác minh trước khi chuyển sang tài khoản đã lưu. | Budgest uses Face ID to confirm it's you before switching to a saved account. | app.json:53 | iOS only (`expo-local-authentication`) |
| `native.permission.location` | Budgest dùng vị trí của bạn để ghim nơi tạo giao dịch lên bản đồ. | Budgest uses your location to pin where a transaction happened. | app.json:59 | `expo-location` |
| `native.permission.photos` | Budgest dùng ảnh được chọn làm ảnh đại diện, biểu tượng, hoặc để đọc hóa đơn thành giao dịch. | Budgest uses the photos you pick as your avatar, as icons, or to read receipts into transactions. | app.json:65 | `expo-image-picker` |
| `native.permission.camera` | Budgest dùng camera để chụp hóa đơn và đọc thành giao dịch. | Budgest uses the camera to photograph receipts and read them into transactions. | app.json:66 | `expo-image-picker` |

App name "Budgest" is the same in both languages. Per-OS-language permission strings would use Expo's `locales` config (`locales: { en: "./locales/native/en.json", vi: ... }`) in a later APK; Open Question 7.
