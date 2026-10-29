# Translation table: mobile language switch (VI → EN)

> Companion to [spec.md](./spec.md). Every user-visible string in `mobile/app/` and `mobile/src/` as of 2026-10-29 (`develop` @ 548bc94), its current Vietnamese text, the proposed English text and the proposed i18n key.
> EN copy follows `.claude/skills/pfm-ux-copy/` (SKILL.md, `patterns.md`, `glossary.md`, `i18n-rules.md`). VI is quoted verbatim from the code, including copy that breaks the skill today (flagged in Notes, not rewritten).
> How the inventory was built: a TypeScript-AST scan of every `.ts`/`.tsx` under `mobile/app` and `mobile/src` (string literals, template literals, JSX text containing Vietnamese letters; comments excluded), plus a second pass for diacritic-free UI strings ("Xong", "Thu", "Chi", "Email", "Passkey"...), then a file-by-file read of every source file to classify each string and catch sentences built from fragments. 1,588 literals in 307 files; `mobile/pfm/` (stray scaffold) ignored. Line numbers are from the working tree on 2026-10-29, which had uncommitted edits in a few files (notifications, `OfflineBanner.tsx`, `TopBar.tsx`, `HomeSnapshotCard.tsx`); re-run the scan before migrating a file (spec.md §8, `check-i18n` script).

## Files

| File | Covers | Rows |
|---|---|---|
| [translations.md](./translations.md) (this file) | Conventions, `common.*` and `nav.*` keys shared by several screens | 125 |
| [translations-auth.md](./translations-auth.md) | Login, request access, reset password, add account, saved accounts and account switching | 103 |
| [translations-home.md](./translations-home.md) | Home tab: snapshot card, onboarding card, pending sync, future transactions | 56 |
| [translations-transactions.md](./translations-transactions.md) | Transactions tab, transaction form, items, location, filters, sort, import/export, offline outbox | 259 |
| [translations-ai-chat.md](./translations-ai-chat.md) | Assistant tab (recording + analysis modes), pending screen, proposal cards, image capture, phrases | 246 |
| [translations-budget-wizard.md](./translations-budget-wizard.md) | Budget wizard (launched from the Assistant) | 129 |
| [translations-insights.md](./translations-insights.md) | Insights tab: spending, budgets, analytics answers, reports | 109 |
| [translations-wallets.md](./translations-wallets.md) | Wallets screen, wallet form, shared wallets, members, invitations | 172 |
| [translations-manage.md](./translations-manage.md) | Categories, transaction history (audit logs), notifications, family members (users) | 157 |
| [translations-settings.md](./translations-settings.md) | Settings tab, preferences (incl. the new language picker), edit profile, security (sessions, passkeys, PIN, app lock), change password, developer | 216 |
| [translations-shared.md](./translations-shared.md) | Shared components and `components/ui`, `lib/` helpers, stores, theme, app update, debug console | 171 |
| [translations-errors.md](./translations-errors.md) | Backend `error_code` → client copy, network/offline errors, notifications, server-rendered text, seed data, OS permission strings | 117 |

Rows count every occurrence (a reused key appears once per place it is used): 1,848 rows, about 1,390 distinct keys.

## Conventions

### Row format

```
| Key | VI (current) | EN (proposed) | Source | Notes |
```

- **Key**: dotted, camelCase segments, `feature.screen.element[.state]`, named by role, not by wording (`i18n-rules.md` §2). Namespaces: `common`, `nav`, `errors`, `auth`, `accounts`, `home`, `onboarding`, `transactions`, `chat`, `pending`, `budgetWizard`, `insights`, `reports`, `analytics`, `budgets`, `wallets`, `sharedWallets`, `categories`, `auditLogs`, `notifications`, `users`, `settings`, `userSettings`, `profile`, `security`, `developer`, `ui`, `format`, `appUpdate`, `debug`.
- **VI (current)**: verbatim from the source. Template literals keep the code's `${…}`; the VI locale value is the same text with each `${expr}` replaced by the named `{{placeholder}}` used in the EN column.
- **EN (proposed)**: i18next v4 syntax. Placeholders are named by meaning (`{{amount}}`, `{{wallet}}`, `{{date}}`, `{{count}}`) and receive values already formatted by `formatCurrency` / the date helpers. Plurals are written `one: … · other: …` and become `key_one` / `key_other` in `en.json`; VI keeps only `key_other`.
- **`(common)`** in the EN column: the row reuses a key defined in the common table below; nothing new to translate. **`(same key)`**: reuses a key defined elsewhere in the same area file.
- **Source**: `FileName.tsx:line`; the full path is in the section heading.
- **Notes**: only when needed: `a11y` (accessibilityLabel/Hint), `placeholder`, `toast`, length limits, a skill violation in the current VI with a proposed VI fix, or `refactor:` when the code builds the sentence from fragments (the fragments collapse into one key; all fragment lines are listed).

### What is in and out

- In: JSX text, titles, labels, buttons, placeholders, `accessibilityLabel` / `accessibilityHint`, toasts, dialogs, empty states, validation and error copy, copy constants (`*-copy.ts`, `*-dialogs.ts`), calendar/month names, enum labels.
- Out (listed at the end of the area file under "Not translated" with the reason): code comments, log/debug-only strings, `testID`s, parsing vocabularies that read the user's own input (e.g. `draft-from-text.ts` "triệu", "nghìn"), emoji search keywords, user data (wallet/category names typed by the user).

### EN style (from the skill)

- Sentence case everywhere, including titles, tabs and buttons ("Add transaction"). Proper nouns keep their capitals: Budgest, Google Maps, Face ID, PIN, Android, the phone's "Settings" app.
- No "!", emoji, em dash "—", "please", "successfully", "Oops", "Sorry", "we/our", marketing words. En dash only in ranges.
- Buttons: verb + object, ≤ 3 words. Delete/remove confirms pair "[Delete <thing>]" with "[Keep]". Never Yes/No.
- Errors: what failed + what to do + the money/data state. "Couldn't save the transaction. Your balance hasn't changed." Only say the balance is unchanged where the VI already guarantees it.
- Toasts: short past tense, no period ("Transaction deleted", "Copied").
- Titles, labels, placeholders, chips, toasts: no trailing period. Body sentences: period.
- Glossary terms: wallet (never "account" for a wallet), transaction, income, spending (not "expenses"), transfer, category, budget, currency, item, tax/fee/discount, items total, transaction history (not "audit log"), account (user account only), username, display name, access request, approve/reject, signed-in device, change password, forgot password, app PIN, app lock, signed out (saved account needing the password again), passkey, saved place, saved phrase, shared wallet, owner, can record, view only, invitation, leave, card colour, admin, default, pending (AI draft), sign in / sign out (not log in/out).

## Common keys

Shared by two or more screens. `Used at` is collected automatically for strings with one meaning everywhere; for words whose meaning depends on context ("Ví", "Danh mục", "Xóa", "Tạo"...) each area file decides per row. Plural rows list both EN forms; `vi.json` has only `_other`.

### Actions (buttons, a11y labels of buttons)

| Key | VI (current) | EN (proposed) | Used at | Notes |
|---|---|---|---|---|
| `common.action.cancel` | Hủy / Huỷ | Cancel | ConfirmDialog.tsx:35, SingleDatePickerModal.tsx:54, AmountPromptModal.tsx:60, EditMessageModal.tsx:51, EditTransactionModal.tsx:237, AddBudgetRowModal.tsx:157, EditAmountModal.tsx:70, FixedCostsModal.tsx:158, BudgetFormModal.tsx:140, CategoryFormModal.tsx:185, CategoryQuickCreateForm.tsx:140, identity-check.ts:16, LogoutGuardDialog.tsx:25, ImportPreviewModal.tsx:61, TransactionFormModal.tsx:161, use-location-step.tsx:194, InviteUserModal.tsx:75, WalletFormModal.tsx:205, biometric-vault.ts:35 | Only for abandoning a form/sheet being filled in (glossary). "Huỷ" is an old spelling: VI locale value is "Hủy". |
| `common.action.close` | Đóng | Close | CategoryPickerDrawer.tsx:50, Drawer.tsx:184, MonthYearWheelSheet.tsx:51, MonthYearWheelSheet.tsx:57, ExpandableFab.tsx:137, EditHistoryDialog.tsx:56, TransactionHistoryDrawer.tsx:137, AddBudgetRowModal.tsx:93, WizardProgressHeader.tsx:65, CategoryTransactionsDialog.tsx:116, pin-copy.ts:23, FutureTransactionsDialog.tsx:54, use-location-step.tsx:181 |  |
| `common.action.retry` | Thử lại | Try again | notifications.tsx:142, RetryImageButton.tsx:28, TransactionHistoryDrawer.tsx:171, use-consult-actions.ts:90, WizardStepResult.tsx:145, SpendingTab.tsx:97, DeleteAccountsSection.tsx:24, DeviceSessionsSection.tsx:24, PasskeyProviderHelp.tsx:44, PendingSyncActionsSheet.tsx:102, TransactionLocationPanel.tsx:78, UsersEmptyState.tsx:30, WalletMembersSheet.tsx:119 |  |
| `common.action.keep` | Giữ lại | Keep | account-copy.ts:10, ChatInputBar.tsx:158, WizardBackConfirmDialog.tsx:39, CategoryListItem.tsx:66, DeleteAccountsSection.tsx:27, DeviceSessionsSection.tsx:22, PasskeysSection.tsx:180, pin-copy.ts:27, TransactionTypeChips.tsx:42, RejectRequestButton.tsx:20, WalletMembersSheet.tsx:168 | Safe branch of every delete/remove confirm (glossary, decided 14/10/2026). |
| `common.action.save` | Lưu | Save | EditMessageModal.tsx:53, EditTransactionModal.tsx:238, TransactionActionCard.tsx:252, EditAmountModal.tsx:72, BudgetFormModal.tsx:142, CategoryFormModal.tsx:187, EditProfileForm.tsx:35, TransactionFormModal.tsx:163, use-location-step.tsx:201, WalletActiveActions.tsx:102, WalletFormModal.tsx:207 |  |
| `common.action.delete` | Xóa | Delete | see area files (meaning depends on context) | Button/menu "Xóa" only. "Xóa" as the calculator backspace or emoji clear is a different key (ui.*). |
| `common.action.back` | Quay lại | Back | pending.tsx:96, request-access.tsx:16, ScreenHeader.tsx:63, SavedAccountLogin.tsx:19, password-reset-copy.ts:21, AddBudgetRowModal.tsx:111, WizardProgressHeader.tsx:43, CategoryQuickCreateForm.tsx:79 |  |
| `common.action.create` | Tạo | Create | see area files (meaning depends on context) | Primary button of a create form. "Tạo" as an audit-log action label is auditLogs.action.create ("Created"). |
| `common.action.edit` | Sửa | Edit | see area files (meaning depends on context) | Button/menu only. "Sửa" as an audit-log action is auditLogs.action.update ("Edited"). |
| `common.action.apply` | Áp dụng | Apply | DateRangePickerModal.tsx:144, MonthYearWheelSheet.tsx:75, SingleDatePickerModal.tsx:55, CategoryFilterModal.tsx:72, SortDrawerModal.tsx:52 |  |
| `common.action.choose` | Chọn | Choose | see area files (meaning depends on context) | Placeholder of an empty picker field. |
| `common.action.discard` | Bỏ | Discard | see area files (meaning depends on context) | Draft-confirmation [Lưu]/[Sửa]/[Bỏ] (patterns §7). |
| `common.action.add` | Thêm | Add | see area files (meaning depends on context) |  |
| `common.action.done` | Xong | Done | see area files (meaning depends on context) |  |
| `common.action.skip` | Bỏ qua | Skip | PendingReviewCard.tsx:108, ImportPreviewModal.tsx:86, ImportPreviewModal.tsx:120 |  |
| `common.action.continue` | Tiếp tục | Continue | ImageAttachButton.tsx:92, LoginForm.tsx:52 |  |
| `common.action.later` | Để sau | Not now | ImageAttachButton.tsx:93, ImageAttachButton.tsx:106 |  |
| `common.action.gotIt` | Đã hiểu | Got it | OfflineInfoSheet.tsx:54, ConfidencePopup.tsx:48 |  |
| `common.action.seeAll` | Xem tất cả | See all | PendingConfirmationsSection.tsx:84, SnapshotColumnParts.tsx:38, HomePendingSyncSection.tsx:64 |  |
| `common.action.openSettings` | Mở Cài đặt | Open Settings | ImageAttachButton.tsx:105, PasskeyProviderHelp.tsx:28, TransactionLocationPanel.tsx:80 | Opens the phone's Settings app; "Settings" capitalised as the OS app name. |
| `common.action.clearSearch` | Xóa tìm kiếm | Clear search | SearchField.tsx:44, PhraseSuggestions.tsx:127, PlaceSearch.tsx:76, TransactionsSearchField.tsx:53 |  |
| `common.action.clearFilters` | Xóa bộ lọc | Clear filters | BudgetRangeRow.tsx:26, TransactionsEmptyStates.tsx:111 |  |
| `common.action.clearFilter` | Xóa lọc | Clear filters | DateRangePickerModal.tsx:143, CategoryFilterModal.tsx:71 | Glossary proposes "Xóa bộ lọc" in VI too; merge into common.action.clearFilters when VI is normalised. |
| `common.action.signIn` | Đăng nhập | Sign in | see area files (meaning depends on context) |  |
| `common.action.signOut` | Đăng xuất | Sign out | see area files (meaning depends on context) |  |
| `common.action.saveAnyway` | Vẫn lưu | Save anyway | TransactionActionCard.tsx:252, StaleEditDialog.tsx:31 |  |
| `common.action.max` | Tối đa | Max | AmountPromptModal.tsx:72, ItemsEditorPanel.tsx:172, ItemsEditorPanel.tsx:203 |  |
| `common.action.sort` | Sắp xếp | Sort | SortDrawerModal.tsx:49, TransactionsHeader.tsx:114 |  |
| `common.action.createWallet` | Tạo ví | Create wallet | wallets.tsx:257, CreateWalletButton.tsx:15, RecordingEmptyState.tsx:52, SpendingEmptyState.tsx:33, NoTransactionsOfTypeState.tsx:39, TransactionsEmptyStates.tsx:49 |  |
| `common.action.addTransaction` | Thêm giao dịch | Add transaction | transactions.tsx:259, shared-wallets.tsx:204, SpendingEmptyState.tsx:38, NoTransactionsOfTypeState.tsx:45, TransactionsEmptyStates.tsx:55 |  |
| `common.action.createBudget` | Tạo ngân sách | Create budget | BudgetsEmptyState.tsx:54, onboarding-steps.ts:28, onboarding-steps.ts:30 |  |
| `common.action.createCategory` | Tạo danh mục | Create category | categories.tsx:130, categories.tsx:137, CategoryQuickCreateForm.tsx:142 |  |
| `common.action.chooseCategory` | Chọn danh mục | Choose category | CategoryPickerDrawer.tsx:38, CategorySelectField.tsx:45, use-category-picker.tsx:33, TransactionKeypadFooter.tsx:132 |  |
| `common.action.openInMaps` | Mở trên Google Maps | Open in Google Maps | LocationMap.tsx:35, TransactionLocationPanel.tsx:120 |  |
| `common.action.setDefault` | Đặt mặc định | Set as default | WalletActiveActions.tsx:68, WalletListItem.tsx:68, WalletListItem.tsx:87 |  |
| `common.action.showPassword` | Hiện mật khẩu | Show password | LoginForm.tsx:50, password-reset-copy.ts:17 |  |
| `common.action.hidePassword` | Ẩn mật khẩu | Hide password | LoginForm.tsx:51, password-reset-copy.ts:18 |  |
| `common.action.manualEntry` | Nhập thủ công | Enter manually | ChatModeHeader.tsx:60, ManualEntryButton.tsx:12, OfflineManualEntryDialog.tsx:6 |  |
| `common.action.moreOptions` | Tùy chọn khác | More options | ChatModeHeader.tsx:45, ChatModeHeader.tsx:99 |  |

### Field labels

| Key | VI (current) | EN (proposed) | Used at | Notes |
|---|---|---|---|---|
| `common.field.wallet` | Ví | Wallet | see area files (meaning depends on context) | Field/column label for one wallet. The Wallets screen title/tab is nav.title.wallets ("Wallets"). |
| `common.field.category` | Danh mục | Category | see area files (meaning depends on context) | Field label. The Categories screen/row is nav.title.categories. |
| `common.field.amount` | Số tiền | Amount | TransactionHistoryDrawer.tsx:23, message-copy.ts:8, AuditLogRow.tsx:27, AdjustmentRow.tsx:135, AdjustmentRow.tsx:140 |  |
| `common.field.date` | Ngày | Date | see area files (meaning depends on context) | Field label. "Ngày" as the Day period chip is home.period.day. |
| `common.field.note` | Ghi chú | Note | TransactionHistoryDrawer.tsx:26, AuditLogRow.tsx:30 |  |
| `common.field.type` | Loại | Type | EditTransactionChoices.tsx:69, TransactionHistoryDrawer.tsx:28, AuditLogRow.tsx:32, CategoryFormModal.tsx:165, CategoryQuickCreateForm.tsx:131, TransactionFormModal.tsx:171, WalletFormModal.tsx:171 |  |
| `common.field.location` | Vị trí | Location | AuditLogRow.tsx:33, TransactionExtrasRow.tsx:63 |  |
| `common.field.name` | Tên | Name | CategoryFormModal.tsx:153, WalletFormModal.tsx:163 |  |
| `common.field.icon` | Biểu tượng | Icon | CategoryFormModal.tsx:143, WalletFormModal.tsx:153 |  |
| `common.field.fromWallet` | Từ ví | From wallet | EditTransactionChoices.tsx:102, use-proposal-wallets.ts:67, TransactionFormModal.tsx:116, TransactionWalletFields.tsx:83 |  |
| `common.field.toWallet` | Đến ví | To wallet | EditTransactionChoices.tsx:111, EditTransactionChoices.tsx:120, use-proposal-wallets.ts:73, TransactionFormModal.tsx:122, TransactionWalletFields.tsx:93, TransactionWalletFields.tsx:104 |  |
| `common.field.time` | Thời gian | Time | TransactionsFilterBar.tsx:84, SharedActivityHeader.tsx:91 |  |
| `common.field.quantity` | Số lượng | Quantity | ItemRow.tsx:115, QuantityStepper.tsx:43 |  |
| `common.field.unitPrice` | Đơn giá | Unit price | ItemRow.tsx:121, ItemRow.tsx:126 |  |
| `common.field.lineAmount` | Thành tiền | Amount | ItemRow.tsx:133, ItemRow.tsx:138 | Glossary: line amount of one item. |
| `common.field.total` | Tổng | Total | FixedCostsModal.tsx:281, ItemsTotalsPanel.tsx:31 |  |
| `common.field.items` | Các món | Items | ItemsEntryRow.tsx:32, TransactionItemsSection.tsx:31 |  |
| `common.field.username` | Tên đăng nhập | Username | EditProfileForm.tsx:29, UsernameClaimField.tsx:15 |  |
| `common.field.identifier` | Email hoặc tên đăng nhập | Email or username | LoginForm.tsx:46, password-reset-copy.ts:9, WalletInviteForm.tsx:84, WalletInviteForm.tsx:94 |  |
| `common.field.newPassword` | Mật khẩu mới | New password | password-reset-copy.ts:14, ChangePasswordForm.tsx:14 |  |
| `common.field.confirmNewPassword` | Nhập lại mật khẩu mới | Re-enter new password | password-reset-copy.ts:16, ChangePasswordForm.tsx:16 |  |
| `common.field.searchCategories` | Tìm danh mục | Search categories | CategoryPickerDrawer.tsx:52, CategoryPickerList.tsx:75, CategoryFilterModal.tsx:76 | Placeholder. |
| `common.field.chooseIcon` | Chọn biểu tượng | Choose icon | use-icon-picker.tsx:36, CategoryQuickCreateForm.tsx:77, CategoryQuickCreateForm.tsx:103 |  |

### Enumerations (types, statuses)

| Key | VI (current) | EN (proposed) | Used at | Notes |
|---|---|---|---|---|
| `common.txType.expense` | Chi tiêu | Spending | see area files (meaning depends on context) | Glossary: EN "spending", never "expenses". |
| `common.txType.income` | Thu nhập | Income | see area files (meaning depends on context) |  |
| `common.txType.transfer` | Chuyển khoản | Transfer | see area files (meaning depends on context) |  |
| `common.txType.expenseShort` | Chi | Spending | see area files (meaning depends on context) | Short chip/section label; EN has no shorter natural form. |
| `common.txType.incomeShort` | Thu | Income | see area files (meaning depends on context) |  |
| `common.walletType.cash` | Tiền mặt | Cash | WalletFormModal.tsx:25, WalletListItem.tsx:18, WalletsGroupedList.tsx:12, WalletStackCard.tsx:28 |  |
| `common.walletType.bank` | Ngân hàng | Bank | WalletFormModal.tsx:26, WalletListItem.tsx:19, WalletsGroupedList.tsx:13, WalletStackCard.tsx:29 |  |
| `common.walletType.e_wallet` | Ví điện tử | E-wallet | WalletFormModal.tsx:27, WalletListItem.tsx:20, WalletsGroupedList.tsx:14, WalletStackCard.tsx:30 |  |
| `common.walletType.other` | Khác | Other | see area files (meaning depends on context) |  |
| `common.adjustment.tax` | Thuế | Tax | AuditItemsDiff.tsx:24, AdjustmentRow.tsx:15 |  |
| `common.adjustment.fee` | Phí | Fee | AuditItemsDiff.tsx:24, AdjustmentRow.tsx:16 |  |
| `common.adjustment.discount` | Giảm giá | Discount | AuditItemsDiff.tsx:24, AdjustmentRow.tsx:17 |  |
| `common.adjustment.other` | Khác | Other | see area files (meaning depends on context) |  |
| `common.adjustment.group` | Thuế, phí, giảm giá | Tax, fees, discounts | ItemsEditorPanel.tsx:179, ItemsEditorPanel.tsx:183 |  |
| `common.label.all` | Tất cả | All | notifications.tsx:31, BudgetFilterChips.tsx:20, TransactionsHeader.tsx:23 |  |
| `common.label.default` | Mặc định | Default | see area files (meaning depends on context) |  |
| `common.label.sharedWallet` | Ví chung | Shared wallet | see area files (meaning depends on context) | Tag/label. The Wallets screen tab is wallets.view.shared ("Shared"). |
| `common.label.yourWallets` | Ví của bạn | Your wallets | see area files (meaning depends on context) |  |
| `common.role.member` | Thành viên | Member | see area files (meaning depends on context) |  |
| `common.role.admin` | Quản trị | Admin | InviteUserModal.tsx:64, UserListItem.tsx:35 |  |
| `common.status.pending` | Chờ xác nhận | Pending | pending.tsx:101, ChatModeHeader.tsx:61, PendingConfirmationsSection.tsx:78 | Glossary: draft from AI waiting for the user. |
| `common.status.awaitingReply` | Chờ trả lời | Awaiting reply | InviteeLookupRow.tsx:16, RolePill.tsx:35, WalletMemberRow.tsx:80 |  |
| `common.status.awaitingApproval` | Chờ duyệt | Awaiting approval | LoginCandidateViews.tsx:18, UserListItem.tsx:27 |  |
| `common.status.pendingSync` | Chờ đồng bộ | Waiting to sync | HomePendingSyncSection.tsx:19, PendingSyncSection.tsx:10 |  |
| `common.status.notEntered` | Chưa nhập | Not set | AdjustmentRow.tsx:78, ItemRow.tsx:76 |  |
| `common.budget.spent` | Đã chi | Spent | BudgetFigures.tsx:44, HomeSnapshotCard.tsx:169 |  |
| `common.budget.left` | Còn lại | Left | BudgetFigures.tsx:47, HomeSnapshotCard.tsx:175 |  |
| `common.budget.over` | Vượt | Over | BudgetStatusList.tsx:80, BudgetFigures.tsx:47, BudgetListRow.tsx:108 |  |
| `common.budget.nearLimit` | Sắp vượt | Near limit | BudgetFilterChips.tsx:21, HomeSnapshotCard.tsx:217 |  |

### Dates

| Key | VI (current) | EN (proposed) | Used at | Notes |
|---|---|---|---|---|
| `common.date.today` | Hôm nay | Today | TransactionKeypadFooter.tsx:38, calendar-theme.ts:16, format-date.ts:86 |  |
| `common.date.yesterday` | Hôm qua | Yesterday | format-date.ts:87 |  |
| `common.date.thisMonth` | Tháng này | This month | BudgetFormModal.tsx:177, BudgetsTab.tsx:175 |  |

### Counts (plurals: VI `_other` only, EN `_one` + `_other`)

| Key | VI (current) | EN (proposed) | Used at | Notes |
|---|---|---|---|---|
| `common.count.categories` | ${categoryIds.length} danh mục / 1 danh mục | one: {{count}} category · other: {{count}} categories | shared-wallets.tsx:105, shared-wallets.tsx:106, TransactionsFilterBar.tsx:57, TransactionsFilterBar.tsx:58 | VI: "{{count}} danh mục". The code's separate "1 danh mục" branch disappears. |
| `common.count.transactions` | (new) | one: {{count}} transaction · other: {{count}} transactions | see area files (meaning depends on context) | VI: "{{count}} giao dịch". Replaces every `${n} giao dịch` concatenation. |
| `common.count.items` | (new) | one: {{count}} item · other: {{count}} items | see area files (meaning depends on context) | VI: "{{count}} món" (glossary). |
| `common.count.wallets` | (new) | one: {{count}} wallet · other: {{count}} wallets | see area files (meaning depends on context) | VI: "{{count}} ví". |
| `common.count.days` | (new) | one: {{count}} day · other: {{count}} days | see area files (meaning depends on context) | VI: "{{count}} ngày". |
| `common.count.months` | (new) | one: {{count}} month · other: {{count}} months | see area files (meaning depends on context) | VI: "{{count}} tháng". |

### Shared sentences

| Key | VI (current) | EN (proposed) | Used at | Notes |
|---|---|---|---|---|
| `common.empty.noWallet` | Chưa có ví. Tạo ví để ghi giao dịch. | No wallet yet. Create one to log transactions. | index.tsx:222, RecordingEmptyState.tsx:46, reply-fanout.ts:17, NoTransactionsOfTypeState.tsx:35, TransactionsEmptyStates.tsx:45, WalletCarousel.tsx:185 | patterns.md §3. |
| `common.empty.tryAnotherKeyword` | Thử từ khóa khác. | Try another keyword. | notifications.tsx:148, ChatSearchResults.tsx:48, TransactionsEmptyStates.tsx:109 |  |
| `common.empty.noMatchingCategories` | Không có danh mục nào khớp. | No matching categories. | CategoryPickerDrawer.tsx:56, CategoryPickerList.tsx:103 |  |
| `common.confirm.cannotUndo` | Hành động này không thể hoàn tác. | This can't be undone. | BudgetFormModal.tsx:204, CategoryFormModal.tsx:206 | VI could shorten to "Không thể hoàn tác." (patterns §6). |
| `common.validation.chooseCategory` | Vui lòng chọn danh mục | Choose a category. | BudgetFormModal.tsx:99, use-transaction-form.ts:153 | VI breaks the skill ("Vui lòng"); proposed VI: "Chọn danh mục." |
| `common.validation.enterAmount` | Nhập số tiền. | Enter an amount. | EditTransactionModal.tsx:179, AdjustmentRow.tsx:69 |  |
| `common.validation.enterIdentifier` | Nhập email hoặc tên đăng nhập. | Enter your email or username. | LoginForm.tsx:54, password-reset-copy.ts:35 |  |
| `common.loading` | Đang tải | Loading | ScreenLoader.tsx:83, ItemsEntryRow.tsx:28 |  |
| `common.brand` | Budgest | Budgest | see area files (meaning depends on context) | Product name, never translated; kept out of locale files (constant). |

### Navigation (tabs, screen titles that double as menu rows)

| Key | VI (current) | EN (proposed) | Used at | Notes |
|---|---|---|---|---|
| `nav.tab.home` | Trang chủ | Home | BottomNav.tsx:33 |  |
| `nav.tab.transactions` | (new) | Transactions | see area files (meaning depends on context) | BottomNav "Giao dịch". |
| `nav.tab.assistant` | Trợ lý | Assistant | see area files (meaning depends on context) |  |
| `nav.tab.insights` | Phân tích | Insights | see area files (meaning depends on context) | Glossary open decision #3 (Phân tích / Tổng quan / Thống kê) applies to EN too. |
| `nav.tab.settings` | Cài đặt | Settings | see area files (meaning depends on context) |  |
| `nav.title.wallets` | Ví | Wallets | see area files (meaning depends on context) | Wallets screen title (app/(app)/wallets.tsx). |
| `nav.title.categories` | Danh mục | Categories | see area files (meaning depends on context) |  |
| `nav.title.auditLogs` | Nhật ký giao dịch | Transaction history | settings.tsx:69, audit-logs.tsx:93 | Glossary: EN avoids "audit log". |
| `nav.title.security` | Bảo mật | Security | settings.tsx:75, security.tsx:17 |  |
| `nav.title.userSettings` | Cài đặt người dùng | Preferences | settings.tsx:78, user-settings.tsx:26 |  |
| `nav.title.developer` | Nhà phát triển | Developer | settings.tsx:91, developer.tsx:28 |  |
| `nav.title.changePassword` | Đổi mật khẩu | Change password | change-password.tsx:11, ChangePasswordForm.tsx:17, ChangePasswordRow.tsx:7 |  |
| `nav.title.addAccount` | Thêm tài khoản | Add account | add-account.tsx:11, LoginForm.tsx:41 |  |
| `nav.title.notifications` | Thông báo | Notifications | see area files (meaning depends on context) |  |
| `nav.title.members` | Thành viên gia đình | Family members | settings.tsx:84 |  |
| `nav.title.switchAccount` | Chuyển tài khoản | Switch account | AccountSwitchDialog.tsx:22, AccountSwitchRow.tsx:11 |  |

