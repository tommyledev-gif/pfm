# Translations: Categories, transaction history, notifications, family members

> Scope: the management screens reached from Settings (`/categories`, `/audit-logs`, `/notifications`, `/users`) and the category picker/quick-create components in `src/features/categories/` that transaction and budget forms render. 157 rows (106 own keys, 51 reusing common or nav keys). Conventions, `common.*` and `nav.*` keys: [translations.md](./translations.md).
> Line numbers: `develop` @ 548bc94, except Notifications (`notifications.tsx`, `NotificationRow.tsx`, `use-mark-notifications-read-mutations.ts`), which were taken from the working tree on 2026-10-29 because those files had uncommitted edits (mark-as-read rework). Re-check them after that work is committed.

## Categories: route `/categories`

Entry: Settings › Danh mục. Two type tabs, the user's own categories above the system ones, a FAB and an edit/create sheet.

### Screen (`mobile/app/(app)/categories.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.txType.expense` | Chi tiêu | (common) | categories.tsx:24 | Type tab |
| `common.txType.income` | Thu nhập | (common) | categories.tsx:25 | Type tab |
| `categories.empty.expense` | Chưa có danh mục chi tiêu. | No spending categories yet. | categories.tsx:29 | Shown with [Tạo danh mục] |
| `categories.empty.income` | Chưa có danh mục thu nhập. | No income categories yet. | categories.tsx:30 | |
| `categories.section.own` | Của bạn | Yours | categories.tsx:63 | Section header, pairs with "Default" (glossary: system category) |
| `common.label.default` | Mặc định | (common) | categories.tsx:64 | Section header of system categories |
| `nav.title.categories` | Danh mục | (common) | categories.tsx:86 | Screen title |
| `common.action.createCategory` | Tạo danh mục | (common) | categories.tsx:130 | Empty-state button |
| `common.action.createCategory` | Tạo danh mục | (common) | categories.tsx:137 | a11y, FAB |

### Category row (`mobile/src/features/categories/components/CategoryListItem.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `categories.row.deleteA11y` | `Xóa danh mục ${category.name}` | Delete category {{name}} | CategoryListItem.tsx:52 | a11y, trash button. `{{name}}` is user data |
| `categories.delete.title` | Xóa danh mục? | Delete this category? | CategoryListItem.tsx:63 | Same key as CategoryFormModal.tsx:205 |
| `categories.delete.bodyNamed` | `"${category.name}" sẽ bị xóa.` | "{{name}}" will be deleted. | CategoryListItem.tsx:64 | Body says nothing about the category's transactions; confirm with backend what happens to them before adding a consequence line (patterns §6) |
| `categories.delete.confirm` | Xóa danh mục | Delete category | CategoryListItem.tsx:65 | Destructive confirm button |
| `common.action.keep` | Giữ lại | (common) | CategoryListItem.tsx:66 | |

### Category form sheet (`mobile/src/features/categories/components/CategoryFormModal.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `categories.form.nameRequired` | Vui lòng nhập tên danh mục | Enter a category name. | CategoryFormModal.tsx:111 | Inline field error. VI breaks the skill ("Vui lòng", no period); proposed VI: "Nhập tên danh mục." |
| `categories.form.titleEdit` | Sửa danh mục | Edit category | CategoryFormModal.tsx:141 | Sheet title |
| `categories.form.titleNew` | Danh mục mới | New category | CategoryFormModal.tsx:141 | Sheet title; same key as use-category-picker.tsx:80 |
| `common.field.icon` | Biểu tượng | (common) | CategoryFormModal.tsx:143 | |
| `common.field.name` | Tên | (common) | CategoryFormModal.tsx:153 | |
| `categories.form.namePlaceholder` | vd: Đi chợ | e.g. Groceries | CategoryFormModal.tsx:157 | placeholder; same key as CategoryQuickCreateForm.tsx:111 |
| `common.field.type` | Loại | (common) | CategoryFormModal.tsx:165 | Label while creating |
| `categories.form.typeLocked` | Loại + ` (khóa sau khi tạo)` | Type (can't change later) | CategoryFormModal.tsx:165 | refactor: label and suffix are concatenated in JSX; one key for the editing state, VI "Loại (khóa sau khi tạo)". The same suffix exists in BudgetFormModal.tsx:153 and TransactionFormModal.tsx:130: candidate for a common key |
| `common.txType.expenseShort` | Chi | (common) | CategoryFormModal.tsx:174 | Type chip (ternary `t === "expense" ? "Chi" : "Thu"`) |
| `common.txType.incomeShort` | Thu | (common) | CategoryFormModal.tsx:174 | Type chip |
| `categories.form.saveFailed` | Không thể lưu danh mục | Couldn't save the category. Try again. | CategoryFormModal.tsx:181 | Fallback behind the server `message`; also shown when delete or icon upload fails (one `activeError`). Map codes first (`CATEGORY_ALREADY_EXISTS`, `CATEGORY_IN_USE`, `ICON_UPLOAD_*`, see translations-errors.md). Proposed VI: "Chưa lưu được danh mục. Thử lại." |
| `common.action.cancel` | Hủy | (common) | CategoryFormModal.tsx:185 | |
| `common.action.save` | Lưu | (common) | CategoryFormModal.tsx:187 | Editing |
| `common.action.create` | Tạo | (common) | CategoryFormModal.tsx:187 | Creating |
| `categories.form.delete` | Xóa danh mục | Delete category | CategoryFormModal.tsx:198 | Text button at the foot of the edit sheet; opens the confirm |
| `categories.delete.title` | Xóa danh mục? | Delete this category? | CategoryFormModal.tsx:205 | |
| `common.confirm.cannotUndo` | Hành động này không thể hoàn tác. | (common) | CategoryFormModal.tsx:206 | This dialog passes no labels, so it shows ConfirmDialog's defaults "Xóa"/"Hủy". Pass `categories.delete.confirm` + `common.action.keep` like CategoryListItem does |

### Category picker list (`mobile/src/features/categories/components/CategoryPickerList.tsx`)

Rendered inside the picker panel of the transaction, budget and filter forms.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `categories.picker.createNamed` | `Tạo “${query}”` | Create “{{name}}” | CategoryPickerList.tsx:55 | Row shown when the search found no exact match; `{{name}}` is what the user typed |
| `categories.picker.createNew` | Tạo danh mục mới | Create new category | CategoryPickerList.tsx:55 | Same row, empty search |
| `common.field.searchCategories` | Tìm danh mục | (common) | CategoryPickerList.tsx:75 | placeholder |
| `common.empty.noMatchingCategories` | Không có danh mục nào khớp. | (common) | CategoryPickerList.tsx:103 | |
| `categories.picker.empty` | Chưa có danh mục nào. | No categories yet. | CategoryPickerList.tsx:103 | |

### Quick create form (`mobile/src/features/categories/components/CategoryQuickCreateForm.tsx`)

The "new category" form inside the picker panel.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `categories.quickCreate.typeExpense` | Khoản chi | Spending | CategoryQuickCreateForm.tsx:28 | Type tab. VI differs from the Categories screen tabs ("Chi tiêu"); consider unifying VI on `common.txType.expense` |
| `categories.quickCreate.typeIncome` | Khoản thu | Income | CategoryQuickCreateForm.tsx:29 | Type tab; same remark with `common.txType.income` |
| `common.field.chooseIcon` | Chọn biểu tượng | (common) | CategoryQuickCreateForm.tsx:77 | Title of the emoji grid step |
| `common.action.back` | Quay lại | (common) | CategoryQuickCreateForm.tsx:79 | Text action leaving the emoji grid |
| `categories.quickCreate.nameAndIcon` | Tên và biểu tượng | Name and icon | CategoryQuickCreateForm.tsx:97 | Field group label |
| `categories.quickCreate.changeIconA11y` | Đổi biểu tượng | Change icon | CategoryQuickCreateForm.tsx:103 | a11y, when an icon is set |
| `common.field.chooseIcon` | Chọn biểu tượng | (common) | CategoryQuickCreateForm.tsx:103 | a11y, when no icon is set |
| `categories.form.namePlaceholder` | vd: Đi chợ | e.g. Groceries | CategoryQuickCreateForm.tsx:111 | placeholder |
| `categories.quickCreate.removeIcon` | Bỏ biểu tượng | Remove icon | CategoryQuickCreateForm.tsx:123 | Text button |
| `categories.quickCreate.iconOptional` | Biểu tượng không bắt buộc. | Icon is optional. | CategoryQuickCreateForm.tsx:126 | Hint |
| `common.field.type` | Loại | (common) | CategoryQuickCreateForm.tsx:131 | |
| `categories.quickCreate.createFailed` | Không thể tạo danh mục | Couldn't create the category. Try again. | CategoryQuickCreateForm.tsx:136 | Fallback behind the server `message` (`CATEGORY_ALREADY_EXISTS` first). Proposed VI: "Chưa tạo được danh mục. Thử lại." |
| `common.action.cancel` | Hủy | (common) | CategoryQuickCreateForm.tsx:140 | |
| `common.action.createCategory` | Tạo danh mục | (common) | CategoryQuickCreateForm.tsx:142 | |

### Picker panel (`mobile/src/features/categories/components/use-category-picker.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.chooseCategory` | Chọn danh mục | (common) | use-category-picker.tsx:33 | Default panel title; hosts can pass their own |
| `categories.form.titleNew` | Danh mục mới | New category | use-category-picker.tsx:80 | Panel title while the quick-create form is open |
| `categories.picker.clearSelection` | Bỏ chọn | Clear selection | use-category-picker.tsx:95 | Footer button |
| `categories.picker.confirmCount` | `Chọn (${draft.length})` | Choose ({{count}}) | use-category-picker.tsx:97 | Footer confirm, multi-select with a selection. Bare number in brackets, no plural form needed |
| `categories.picker.confirm` | Chọn | Choose | use-category-picker.tsx:97 | Footer confirm. Not `common.action.choose` (that one is an empty field's placeholder) |

## Transaction history: route `/audit-logs`

Entry: Settings › Nhật ký giao dịch. Read-only log of creates, edits and deletes, grouped by day.

### Screen (`mobile/app/(app)/audit-logs.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.title.auditLogs` | Nhật ký giao dịch | (common) | audit-logs.tsx:93 | Screen title |
| `auditLogs.subtitle` | Lịch sử tạo, sửa và xóa giao dịch | Created, edited and deleted transactions | audit-logs.tsx:93 | Screen subtitle |
| `auditLogs.fallback.category` | Danh mục | Category | audit-logs.tsx:127 | Value shown when the logged category id is not in the cache any more |
| `auditLogs.fallback.wallet` | Ví | Wallet | audit-logs.tsx:128 | Same, for a wallet |

### Log entry (`mobile/src/features/audit-logs/components/AuditLogRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `auditLogs.action.create` | Tạo | Created | AuditLogRow.tsx:13 | Badge on the entry |
| `auditLogs.action.update` | Sửa | Edited | AuditLogRow.tsx:14 | Badge |
| `auditLogs.action.delete` | Đã xóa | Deleted | AuditLogRow.tsx:15 | Badge |
| `common.field.amount` | Số tiền | (common) | AuditLogRow.tsx:27 | Changed-field label |
| `common.field.category` | Danh mục | (common) | AuditLogRow.tsx:28 | Changed-field label |
| `common.field.date` | Ngày | (common) | AuditLogRow.tsx:29 | Changed-field label |
| `common.field.note` | Ghi chú | (common) | AuditLogRow.tsx:30 | Changed-field label |
| `common.field.wallet` | Ví | (common) | AuditLogRow.tsx:31 | Changed-field label |
| `common.field.type` | Loại | (common) | AuditLogRow.tsx:32 | Changed-field label |
| `common.field.location` | Vị trí | (common) | AuditLogRow.tsx:33 | Changed-field label |
| `auditLogs.field.locationNote` | Ghi chú vị trí | Location note | AuditLogRow.tsx:34 | Changed-field label |
| `common.txType.incomeShort` | Thu | (common) | AuditLogRow.tsx:77 | Value of a changed `type`. Bug to fix in the same pass: anything not "income" prints "Chi", so a transfer reads as spending; add `common.txType.transfer` |
| `common.txType.expenseShort` | Chi | (common) | AuditLogRow.tsx:77 | Same |
| `auditLogs.row.noChanges` | Không có thay đổi được ghi nhận | No changes recorded | AuditLogRow.tsx:114 | |
| `auditLogs.row.change` | `${FIELD_LABEL[field]}: ` + before + `  →  ` + after | {{field}}: {{from}} → {{to}} | AuditLogRow.tsx:127 | refactor: built from three Text nodes (lines 127-131); VI "{{field}}: {{from}} → {{to}}". The new value is bold, so render with `<Trans>` (`<0>{{to}}</0>`) |
| `auditLogs.row.deletedAt` | Đã xóa lúc {formatTime} · {formatDateShort} | Deleted at {{time}} · {{date}} | AuditLogRow.tsx:148 | refactor: text plus two inline expressions; VI "Đã xóa lúc {{time}} · {{date}}" |

### Items diff (`mobile/src/features/audit-logs/components/AuditItemsDiff.tsx`)

Shown when an edit changed the transaction's items.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.adjustment.tax` | Thuế | (common) | AuditItemsDiff.tsx:24 | |
| `common.adjustment.fee` | Phí | (common) | AuditItemsDiff.tsx:24 | |
| `common.adjustment.discount` | Giảm giá | (common) | AuditItemsDiff.tsx:24 | |
| `common.adjustment.other` | Khác | (common) | AuditItemsDiff.tsx:24 | Only a fallback: an "other" line shows its own label |
| `auditLogs.items.summary` | `${lines.count ?? 0} món · ${formatCurrency(lines.items_total ?? 0, currency)}` | one: "{{count}} item · {{amount}}" · other: "{{count}} items · {{amount}}" | AuditItemsDiff.tsx:35 | VI `_other`: "{{count}} món · {{amount}}" |
| `auditLogs.items.label` | Các món: | Items: | AuditItemsDiff.tsx:40 | Label before the before → after summary; same `<Trans>` treatment as `auditLogs.row.change` |
| `auditLogs.items.hide` | Ẩn các món | Hide items | AuditItemsDiff.tsx:46 | Toggle |
| `auditLogs.items.show` | Xem các món | Show items | AuditItemsDiff.tsx:46 | Toggle |
| `auditLogs.items.before` | Trước | Before | AuditItemsDiff.tsx:50 | List heading |
| `auditLogs.items.after` | Sau | After | AuditItemsDiff.tsx:51 | List heading (diacritic-free, missed by the scan) |
| `auditLogs.items.none` | Không có món | No items | AuditItemsDiff.tsx:65 | |

### Empty state (`mobile/src/features/audit-logs/components/AuditLogsEmptyState.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `auditLogs.empty.title` | Chưa có thay đổi nào | No changes yet | AuditLogsEmptyState.tsx:23 | |
| `auditLogs.empty.body` | Mỗi lần tạo, sửa hoặc xóa giao dịch đều được ghi ở đây. | Every transaction you create, edit or delete is listed here. | AuditLogsEmptyState.tsx:24 | |
| `auditLogs.empty.cta` | Đến trang Giao dịch | Go to Transactions | AuditLogsEmptyState.tsx:26 | Opens the Transactions tab; "Transactions" is the tab name (`nav.tab.transactions`) |

## Notifications: route `/notifications`

Entry: the bell on Home. Each row's **title and body come from the server** (`notifications.title` / `.body`, rendered once when the row is created: `budget_exceeded` in English today, `access_request`, `wallet_invite`, `wallet_member_joined` in Vietnamese). They are not in this table; how they get translated (client-side rendering by `type`) is in [translations-errors.md](./translations-errors.md) and spec.md.

### Screen (`mobile/app/(app)/notifications.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.label.all` | Tất cả | (common) | notifications.tsx:31 | Filter tab |
| `notifications.filter.unread` | Chưa đọc | Unread | notifications.tsx:32 | Filter tab |
| `notifications.error.loadFailed` | Chưa tải được thông báo. | Couldn't load notifications. | notifications.tsx:140 | Shown with [Thử lại] |
| `common.action.retry` | Thử lại | (common) | notifications.tsx:142 | |
| `notifications.search.noResults` | Không tìm thấy thông báo | No notifications found | notifications.tsx:147 | Search empty state, title |
| `common.empty.tryAnotherKeyword` | Thử từ khóa khác. | (common) | notifications.tsx:148 | |
| `notifications.empty.unread` | Không có thông báo chưa đọc. | No unread notifications. | notifications.tsx:154 | Positive empty, no CTA |
| `notifications.empty.all` | Chưa có thông báo. | No notifications yet. | notifications.tsx:154 | |
| `nav.title.notifications` | Thông báo | (common) | notifications.tsx:162 | Screen title |
| `notifications.markAllRead.a11y` | Đánh dấu mọi thông báo đã đọc | Mark all notifications as read | notifications.tsx:171 | a11y (new in the working tree, not in the raw scan) |
| `notifications.markAllRead.button` | Đánh dấu đã đọc | Mark all read | notifications.tsx:174 | Header text button (new in the working tree) |
| `notifications.search.placeholder` | Tìm thông báo | Search notifications | notifications.tsx:183 | placeholder |

### Mark-as-read mutations (`mobile/src/features/notifications/api/use-mark-notifications-read-mutations.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `notifications.markAllRead.failed` | Chưa đánh dấu được. Thử lại sau. | Couldn't mark them as read. Try again later. | use-mark-notifications-read-mutations.ts:9 | toast (warning); file is new and uncommitted |

### Notification row (`mobile/src/features/notifications/components/NotificationRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `notifications.row.a11y` | `${notification.title}. ${notification.body}` | {{title}}. {{body}} | NotificationRow.tsx:64 | a11y, read row. refactor: one template with a conditional prefix becomes two keys; VI "{{title}}. {{body}}" |
| `notifications.row.a11yUnread` | `${unread ? "Chưa đọc. " : ""}${notification.title}. ${notification.body}` | Unread. {{title}}. {{body}} | NotificationRow.tsx:64 | a11y, unread row; VI "Chưa đọc. {{title}}. {{body}}" |

## Family members: route `/users` (admin only)

Entry: Settings › Thành viên gia đình. Invite, approve or reject access requests, resend invites, sign a member out everywhere. The super-admin "delete accounts" section at the top of this screen (`DeleteAccountsSection`) lives in `src/features/security/` and is in translations-settings.md.

### Screen (`mobile/app/(app)/users.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `users.title` | Thành viên | Members | users.tsx:69 | Screen title. The Settings row that opens it is "Thành viên gia đình" (`nav.title.members`, "Family members"); consider one name for both |
| `users.subtitle.count` | `${list.length} người` | one: {{count}} person · other: {{count}} people | users.tsx:69 | VI `_other`: "{{count}} người" |
| `users.search.placeholder` | Tìm theo tên hoặc email | Search by name or email | users.tsx:76 | placeholder; shown from 6 members |
| `users.section.header` | `${section.title} · ${section.data.length}` | {{status}} · {{count}} | users.tsx:108 | refactor: status label + count joined in code; `{{status}}` is a `users.status.*` value. No words of its own, same in VI |
| `users.invite.cta` | Mời thành viên | Invite member | users.tsx:124 | a11y, FAB |

### Member row (`mobile/src/features/users/components/UserListItem.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.status.awaitingApproval` | Chờ duyệt | (common) | UserListItem.tsx:27 | Status `requested` (access request), also the section header |
| `users.status.pending` | Chờ kích hoạt | Awaiting activation | UserListItem.tsx:28 | Invited or approved, not activated yet (glossary order: Chờ duyệt → Chờ kích hoạt → Đang dùng) |
| `users.status.active` | Đang dùng | Active | UserListItem.tsx:29 | |
| `users.status.disabled` | Đã khóa | Locked | UserListItem.tsx:30 | Same word as the `ACCOUNT_DISABLED` copy ("This account is locked.") in translations-auth.md and translations-errors.md |
| `common.role.admin` | Quản trị | (common) | UserListItem.tsx:35 | Tag on admin rows |
| `users.row.selfTitle` | `${displayName} (bạn)` | {{name}} (you) | UserListItem.tsx:51 | Own row |
| `users.row.a11y` | `${displayName}, ${STATUS_LABEL[user.status]}` | {{name}}, {{status}} | UserListItem.tsx:70 | a11y. refactor: template with a conditional admin suffix becomes two keys |
| `users.row.a11yAdmin` | `${displayName}, ${STATUS_LABEL[user.status]}, ${ADMIN_LABEL}` | {{name}}, {{status}}, admin | UserListItem.tsx:70 | a11y; VI "{{name}}, {{status}}, quản trị" |

### Approve request (`mobile/src/features/users/components/ApproveRequestButton.tsx`, `mobile/src/features/users/access-request-errors.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `users.request.notWaiting` | Yêu cầu này không còn chờ duyệt. | This request is no longer awaiting approval. | access-request-errors.ts:3 | toast (info) for `ACCESS_REQUEST_HANDLED` / `NOT_FOUND`; used by approve and reject. Same sentence is the backend message (translations-errors.md) |
| `users.approve.toast` | `Đã duyệt. Email kích hoạt đã gửi tới ${email}.` | Approved. Activation email sent. | ApproveRequestButton.tsx:27 | toast. The skill keeps emails out of toasts; EN drops it, so VI must drop it too (same placeholder set): proposed VI "Đã duyệt. Đã gửi email kích hoạt." |
| `users.approve.failed` | Chưa duyệt được. Thử lại. | Couldn't approve. Try again. | ApproveRequestButton.tsx:34 | toast; fallback behind the server `message` |
| `users.approve.a11y` | `Duyệt yêu cầu của ${email}` | Approve request from {{email}} | ApproveRequestButton.tsx:46 | a11y |
| `users.approve.button` | Duyệt yêu cầu | Approve request | ApproveRequestButton.tsx:51 | Also rendered under an `access_request` notification |

### Reject request (`mobile/src/features/users/components/RejectRequestButton.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `users.reject.button` | Từ chối | Reject | RejectRequestButton.tsx:18 | Row button and the dialog's destructive button (lines 68, 74) |
| `users.reject.title` | Từ chối yêu cầu? | Reject this request? | RejectRequestButton.tsx:19 | Confirm title |
| `common.action.keep` | Giữ lại | (common) | RejectRequestButton.tsx:20 | |
| `users.reject.toast` | Đã từ chối yêu cầu | Request rejected | RejectRequestButton.tsx:21 | toast |
| `users.reject.failed` | Chưa từ chối được. Thử lại. | Couldn't reject. Try again. | RejectRequestButton.tsx:22 | toast |
| `users.reject.body` | `${email} sẽ không nhận được email báo. Người này có thể gửi lại yêu cầu.` | {{email}} won't get an email about this. They can send a new request. | RejectRequestButton.tsx:27 | Confirm body |
| `users.reject.a11y` | `Từ chối yêu cầu của ${email}` | Reject request from {{email}} | RejectRequestButton.tsx:63 | a11y |

### Resend invite (`mobile/src/features/users/components/ResendInviteButton.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `users.resend.toast` | Đã gửi lại lời mời | Invitation resent | ResendInviteButton.tsx:45 | toast |
| `users.resend.failed` | Không gửi lại được lời mời | Couldn't resend the invitation. Try again. | ResendInviteButton.tsx:46 | toast; fallback behind `INVITE_RESEND_COOLDOWN` / server `message`. Proposed VI: "Chưa gửi lại được lời mời. Thử lại." |
| `users.resend.wait` | `Gửi lại sau ${formatWait(waitMs)}` | Resend in {{time}} | ResendInviteButton.tsx:63 | Disabled button with a live countdown; `{{time}}` is "m:ss" |
| `users.resend.button` | Gửi lại lời mời | Resend invitation | ResendInviteButton.tsx:63 | |

### Sign a member out everywhere (`mobile/src/features/users/components/RevokeSessionsButton.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `users.revokeSessions.button` | Đăng xuất mọi thiết bị | Sign out everywhere | RevokeSessionsButton.tsx:19 | Same VI as the Security screen row (RevokeAllSessionsRow.tsx:12, translations-settings.md): candidate for a common key |
| `users.revokeSessions.title` | Đăng xuất mọi thiết bị? | Sign out everywhere? | RevokeSessionsButton.tsx:20 | Confirm title |
| `common.action.signOut` | Đăng xuất | (common) | RevokeSessionsButton.tsx:21 | Confirm button. The dialog passes no `cancelLabel`, so it shows "Hủy"; glossary's sign-out confirm uses `common.action.keep` |
| `users.revokeSessions.notFound` | Không tìm thấy người dùng. | This account wasn't found. | RevokeSessionsButton.tsx:22 | toast on 404 (glossary: "account" for a user) |
| `users.revokeSessions.offline` | Cần kết nối mạng để đăng xuất mọi thiết bị. | Connect to the internet to sign out everywhere. | RevokeSessionsButton.tsx:23 | toast (warning); same VI in use-revoke-all-sessions-mutation.ts:16 |
| `users.revokeSessions.failed` | Chưa đăng xuất được mọi thiết bị. Thử lại. | Couldn't sign out everywhere. Try again. | RevokeSessionsButton.tsx:24 | toast |
| `users.revokeSessions.body` | `Đăng xuất ${email} khỏi mọi thiết bị? Người này sẽ phải đăng nhập lại bằng mật khẩu.` | Signs {{email}} out on every device. They'll need their password to sign in again. | RevokeSessionsButton.tsx:27 | Confirm body; the title already asks, so EN states the effect |
| `users.revokeSessions.toast` | `Đã đăng xuất ${email} khỏi mọi thiết bị.` | Member signed out everywhere | RevokeSessionsButton.tsx:28 | toast. Email dropped (skill: no email in toasts); proposed VI "Đã đăng xuất thành viên khỏi mọi thiết bị" |

### Invite member sheet (`mobile/src/features/users/components/InviteUserModal.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `users.invite.title` | Mời thành viên | Invite member | InviteUserModal.tsx:45 | Sheet title |
| `users.invite.body` | Người được mời nhận email để kích hoạt tài khoản. | They'll get an email to activate their account. | InviteUserModal.tsx:46 | |
| `users.invite.emailLabel` | Email | Email | InviteUserModal.tsx:48 | Diacritic-free, missed by the scan |
| `users.invite.emailPlaceholder` | name@example.com | name@example.com | InviteUserModal.tsx:52 | placeholder; locale-neutral, could stay a constant |
| `users.invite.roleLabel` | Vai trò | Role | InviteUserModal.tsx:59 | Glossary: "Vai trò" |
| `common.role.admin` | Quản trị | (common) | InviteUserModal.tsx:64 | Role chip |
| `common.role.member` | Thành viên | (common) | InviteUserModal.tsx:64 | Role chip |
| `users.invite.failed` | Chưa gửi được lời mời. Thử lại. | Couldn't send the invitation. Try again. | InviteUserModal.tsx:71 | Fallback behind the server `message` (`EMAIL_ALREADY_EXISTS` first). Same VI as wallet-member-copy.ts:40 (shared-wallet invite) |
| `common.action.cancel` | Hủy | (common) | InviteUserModal.tsx:75 | |
| `users.invite.submit` | Gửi lời mời | Send invitation | InviteUserModal.tsx:77 | Same VI as WalletInviteForm.tsx:134 |

### Empty and error states (`mobile/src/features/users/components/UsersEmptyState.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `users.error.title` | Không tải được danh sách thành viên | Couldn't load members | UsersEmptyState.tsx:28 | |
| `users.error.body` | Kiểm tra kết nối mạng rồi thử lại. | Check your connection and try again. | UsersEmptyState.tsx:29 | |
| `common.action.retry` | Thử lại | (common) | UsersEmptyState.tsx:30 | |
| `users.empty.title` | Chưa có thành viên nào | No members yet | UsersEmptyState.tsx:42 | |
| `users.empty.body` | Người được mời nhận email để kích hoạt tài khoản riêng. | Each person you invite gets an email to activate their own account. | UsersEmptyState.tsx:43 | |
| `users.invite.cta` | Mời thành viên | Invite member | UsersEmptyState.tsx:45 | Button |

## Not translated

| Source | Text | Reason |
|---|---|---|
| AuditLogRow.tsx:45, :66, :141 | `—` | Empty-value glyph inside a data line, not copy. The skill bans "—" in sentences only; an en dash "–" or blank would also do |
| AuditLogRow.tsx:129, AuditItemsDiff.tsx:42 | `  →  ` | Arrow between old and new value; becomes part of `auditLogs.row.change` |
| AuditItemsDiff.tsx:69, :74 | ` × ${quantity}`, `−` / `+` | Symbols around formatted numbers |
| audit-logs.tsx:69-70, notifications.tsx:130 | `dayLabelVi()`, `formatDateViShort()` | Day headers ("Hôm nay", "Hôm qua", "06 Th09, 2026") come from `lib/format-date.ts`, covered in translations-shared.md (`format.*`) |
| UserListItem.tsx:46, :53 | `user.email.split("@")[0]`, `@${username} · ${email}` | User data only |
| CategoryListItem.tsx:30, CategoryPickerList.tsx | `category.name` | User data. System categories (`user_id` null) are seed data translated by `system_key`, see translations-errors.md |
| NotificationRow.tsx:74, :79 | `notification.title`, `notification.body` | Server-rendered text, see translations-errors.md |
| ResendInviteButton.tsx:17 | `${minutes}:${seconds}` | Countdown digits, fed into `users.resend.wait` |
