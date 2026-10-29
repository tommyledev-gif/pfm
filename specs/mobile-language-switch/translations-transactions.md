# Translations: Transactions

> Scope: the Transactions tab (`app/(app)/(tabs)/transactions.tsx`) and `src/features/transactions/` (list, header, filters, sort, empty states, transaction form with keypad and wallet fields, items editor, location step, offline sync, import/export, save errors). Home-only pieces (`Home*`, `FutureTransactions*`) are in [translations-home.md](./translations-home.md). 259 rows (every raw-extracted string, one row per occurrence) plus 8 "Not translated" entries. Conventions: [translations.md](./translations.md).

Shared pieces used here but defined elsewhere: `TRANSACTION_KIND_LABELS` ("Chi" / "Thu" / "Chuyển khoản", `src/lib/constants.ts`, feeds the form's type control and the pending-sync row title), the date helpers `dayLabelVi` / `formatDateViShort` (list day headers), `ConfirmDialog` default labels, `amount.spoken` / `amount.notice` / `amount.problem` (`src/lib/use-amount-expression.ts`): see [translations-shared.md](./translations-shared.md).

## Transactions tab: list screen

### `mobile/app/(app)/(tabs)/transactions.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `format.monthYear` | Tháng ${now.getMonth() + 1}, ${now.getFullYear()} | October 2026 | transactions.tsx:129 | refactor: build with the locale's month-year formatter (`Intl.DateTimeFormat(locale, { month: "long", year: "numeric" })`), not a key; VI keeps "Tháng 10, 2026" via the VI format helper. Owned by translations-shared.md |
| `common.action.addTransaction` | Thêm giao dịch | (common) | transactions.tsx:259 | a11y label of the FAB |

### `mobile/src/features/transactions/components/TransactionsHeader.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.label.all` | Tất cả | (common) | TransactionsHeader.tsx:23 | Type tab |
| `common.txType.expense` | Chi tiêu | (common) | TransactionsHeader.tsx:24 | Type tab: "Spending" |
| `common.txType.income` | Thu nhập | (common) | TransactionsHeader.tsx:25 | Type tab |
| `transactions.typeTab.transfer` | Chuyển | Transfers | TransactionsHeader.tsx:26 | Tab narrowing the list to transfers; VI is a short form of "Chuyển khoản" |
| `transactions.header.incomeInPeriod` | Tổng thu | Income in {{period}} | TransactionsHeader.tsx:95, :150 | refactor: code joins `${label} ${periodLabel.toLowerCase()}`. VI value: "Tổng thu {{period}}". Pass a mid-sentence period ("tháng 10, 2026" / "October 2026"); drop the `.toLowerCase()` (it would lowercase EN month names) |
| `transactions.header.spendingInPeriod` | Tổng chi | Spending in {{period}} | TransactionsHeader.tsx:100, :150 | refactor: as above. VI value: "Tổng chi {{period}}" |
| `nav.tab.transactions` | Giao dịch | (common) | TransactionsHeader.tsx:110 | Screen title = tab label |
| `common.action.sort` | Sắp xếp | (common) | TransactionsHeader.tsx:114 | a11y label of the sort icon button |
| `transactions.header.sortHint` | Sắp xếp giao dịch | Sorts the transactions | TransactionsHeader.tsx:115 | a11y hint |
| `transactions.header.export` | Xuất Excel | Export to Excel | TransactionsHeader.tsx:128 | a11y label of the export icon button |
| `transactions.header.exportHint` | Xuất ra Excel | Saves the list as an Excel file | TransactionsHeader.tsx:129 | a11y hint |
| `common.count.transactions` | giao dịch | (common) | TransactionsHeader.tsx:161 | refactor: `{matchedCount} giao dịch` → one plural key: "{{count}} transaction" / "{{count}} transactions" |

### `mobile/src/features/transactions/components/TransactionsSearchField.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.search.placeholder` | Tìm theo ghi chú... | Search by note... | TransactionsSearchField.tsx:48 | placeholder |
| `common.action.clearSearch` | Xóa tìm kiếm | (common) | TransactionsSearchField.tsx:53 | a11y |

### `mobile/src/features/transactions/components/TransactionsFilterBar.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.field.wallet` | Ví | (common) | TransactionsFilterBar.tsx:52 | Pill label kept when the filtered wallet was deleted elsewhere |
| `common.count.categories` | 1 danh mục | (common) | TransactionsFilterBar.tsx:57 | refactor: the separate "1 danh mục" branch becomes the plural key |
| `common.count.categories` | ${categoryIds.length} danh mục | (common) | TransactionsFilterBar.tsx:58 | Plural: "{{count}} category" / "{{count}} categories" |
| `common.field.wallet` | Ví | (common) | TransactionsFilterBar.tsx:70 | Wallet filter pill |
| `transactions.filter.clearWallet` | Bỏ lọc ví | Clear wallet filter | TransactionsFilterBar.tsx:73 | a11y label of the pill's × |
| `transactions.filter.datePill` | Thời gian | Dates | TransactionsFilterBar.tsx:84 | Date-range pill. Not `common.field.time`: EN "Time" would read as a clock time. Same pill in shared wallets (SharedActivityHeader.tsx:91) |
| `transactions.filter.clearDate` | Bỏ lọc thời gian | Clear date filter | TransactionsFilterBar.tsx:88 | a11y; also SharedActivityHeader.tsx:94 |
| `common.field.category` | Danh mục | (common) | TransactionsFilterBar.tsx:93 | Category filter pill |
| `transactions.filter.clearCategory` | Bỏ lọc danh mục | Clear category filter | TransactionsFilterBar.tsx:96 | a11y; also SharedActivityHeader.tsx:102 |

### `mobile/src/features/transactions/components/WalletFilterModal.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.walletFilter.title` | Lọc theo ví | Filter by wallet | WalletFilterModal.tsx:46 | Drawer title |
| `transactions.walletFilter.all` | Tất cả ví | All wallets | WalletFilterModal.tsx:50 | |

### `mobile/src/features/transactions/components/CategoryFilterModal.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.title.categories` | Danh mục | (common) | CategoryFilterModal.tsx:69 | Drawer title of a multi-select: plural "Categories" |
| `common.action.clearFilter` | Xóa lọc | (common) | CategoryFilterModal.tsx:71 | |
| `common.action.apply` | Áp dụng | (common) | CategoryFilterModal.tsx:72 | |
| `common.field.searchCategories` | Tìm danh mục | (common) | CategoryFilterModal.tsx:76 | placeholder |
| `transactions.categoryFilter.noMatch` | Không có danh mục khớp. | No matching categories. | CategoryFilterModal.tsx:78 | Same meaning as `common.empty.noMatchingCategories` ("Không có danh mục nào khớp."); merge once VI is normalised |
| `common.txType.expenseShort` | Chi | (common) | CategoryFilterModal.tsx:82 | Section header |
| `common.txType.incomeShort` | Thu | (common) | CategoryFilterModal.tsx:91 | Section header |

### `mobile/src/features/transactions/components/SortDrawerModal.tsx`, `mobile/src/features/transactions/sort.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.sort` | Sắp xếp | (common) | SortDrawerModal.tsx:49 | Drawer title |
| `transactions.sort.reset` | Đặt lại | Reset | SortDrawerModal.tsx:51 | |
| `common.action.apply` | Áp dụng | (common) | SortDrawerModal.tsx:52 | |
| `transactions.sort.recent` | Mới nhất trước | Newest first | sort.ts:22 | |
| `transactions.sort.oldest` | Cũ nhất trước | Oldest first | sort.ts:23 | |
| `transactions.sort.highest` | Số tiền cao nhất | Highest amount | sort.ts:24 | |
| `transactions.sort.lowest` | Số tiền thấp nhất | Lowest amount | sort.ts:25 | |

### `mobile/src/features/transactions/other-currencies.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.otherCurrencies.one` | Có thêm ${others[0]} | Also in {{currency}} | other-currencies.ts:11 | Under a one-currency total (header, day headers). `{{currency}}` is the ISO code |
| `transactions.otherCurrencies.count` | Có thêm ${others.length} loại tiền khác | one: Also in {{count}} other currency · other: Also in {{count}} other currencies | other-currencies.ts:12 | VI value: "Có thêm {{count}} loại tiền khác" (`_other` only) |

### `mobile/src/features/transactions/components/TransactionsEmptyStates.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.empty.none.title` | Chưa có giao dịch nào | No transactions yet | TransactionsEmptyStates.tsx:43 | |
| `common.empty.noWallet` | Chưa có ví. Tạo ví để ghi giao dịch. | (common) | TransactionsEmptyStates.tsx:45 | |
| `common.action.createWallet` | Tạo ví | (common) | TransactionsEmptyStates.tsx:49 | |
| `common.action.addTransaction` | Thêm giao dịch | (common) | TransactionsEmptyStates.tsx:55 | |
| `transactions.empty.shortcut.aiEyebrow` | Ghi bằng AI | Log with AI | TransactionsEmptyStates.tsx:65 | Shortcut tile to the Assistant |
| `transactions.empty.shortcut.aiExample` | Nhắn “Cà phê 50k” | Send “Coffee 50k” | TransactionsEmptyStates.tsx:66 | The quoted text is an example the user types; keep it something the extractor understands in EN (see spec open question on EN chat input) |
| `nav.title.categories` | Danh mục | (common) | TransactionsEmptyStates.tsx:71 | Eyebrow of the tile that opens Categories |
| `transactions.empty.shortcut.categories` | Tuỳ chỉnh danh mục | Edit categories | TransactionsEmptyStates.tsx:72 | VI spelling "Tuỳ" → "Tùy" when normalised |
| `transactions.empty.filtered.title` | Không tìm thấy giao dịch | No transactions found | TransactionsEmptyStates.tsx:108 | patterns.md §3 |
| `common.empty.tryAnotherKeyword` | Thử từ khóa khác. | (common) | TransactionsEmptyStates.tsx:109 | |
| `common.action.clearFilters` | Xóa bộ lọc | (common) | TransactionsEmptyStates.tsx:111 | |
| `transactions.empty.filtered.suggestions` | Gợi ý từ ghi chú gần đây | From your recent notes | TransactionsEmptyStates.tsx:119 | Header over note chips |

### `mobile/src/features/transactions/components/NoTransactionsOfTypeState.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.empty.type.expense` | Chưa có khoản chi nào | No spending yet | NoTransactionsOfTypeState.tsx:9 | |
| `transactions.empty.type.income` | Chưa có khoản thu nào | No income yet | NoTransactionsOfTypeState.tsx:10 | |
| `transactions.empty.type.transfer` | Chưa có lần chuyển tiền nào | No transfers yet | NoTransactionsOfTypeState.tsx:11 | |
| `common.empty.noWallet` | Chưa có ví. Tạo ví để ghi giao dịch. | (common) | NoTransactionsOfTypeState.tsx:35 | |
| `common.action.createWallet` | Tạo ví | (common) | NoTransactionsOfTypeState.tsx:39 | |
| `common.action.addTransaction` | Thêm giao dịch | (common) | NoTransactionsOfTypeState.tsx:45 | |

### `mobile/src/features/transactions/components/TransactionsListStates.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.empty.onlyFuture` | Chưa có giao dịch nào tính đến hôm nay. | No transactions up to today. | TransactionsListStates.tsx:26 | Every row is dated ahead of today |

## Transaction form (create / edit sheet)

### `mobile/src/features/transactions/components/TransactionFormModal.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.field.fromWallet` | Từ ví | (common) | TransactionFormModal.tsx:116 | Wallet picker panel title (transfer) |
| `common.field.wallet` | Ví | (common) | TransactionFormModal.tsx:116 | Wallet picker panel title |
| `common.field.toWallet` | Đến ví | (common) | TransactionFormModal.tsx:122 | Destination picker panel title |
| `transactions.form.typeLocked` | Loại + " (khóa sau khi tạo)" | Type (locked once saved) | TransactionFormModal.tsx:130, :171 | refactor: `Loại{lockedSuffix}` is two fragments. Two keys: `common.field.type` ("Loại", create) and this one, VI value "Loại (khóa sau khi tạo)" (edit). Same suffix in BudgetFormModal.tsx:153, CategoryFormModal.tsx:165 |
| `transactions.form.editTitle` | Sửa giao dịch | Edit transaction | TransactionFormModal.tsx:159 | Sheet title; same text in chat EditTransactionModal.tsx:235 |
| `transactions.form.newTitle` | Giao dịch mới | New transaction | TransactionFormModal.tsx:159 | Sheet title |
| `common.action.cancel` | Hủy | (common) | TransactionFormModal.tsx:161 | |
| `common.action.save` | Lưu | (common) | TransactionFormModal.tsx:163 | Edit |
| `common.action.create` | Tạo | (common) | TransactionFormModal.tsx:163 | Create |
| `common.field.type` | Loại | (common) | TransactionFormModal.tsx:171 | See `transactions.form.typeLocked` |
| `transactions.form.delete` | Xóa giao dịch | Delete transaction | TransactionFormModal.tsx:224 | Button |
| `transactions.form.deleteConfirm.title` | Xóa giao dịch? | Delete this transaction? | TransactionFormModal.tsx:236 | |
| `transactions.form.deleteConfirm.body` | Hành động này không thể hoàn tác và sẽ điều chỉnh lại số dư ví. | The wallet balance is updated. This can't be undone. | TransactionFormModal.tsx:237 | Two ideas joined by "và" (rule 2). Proposed VI: "Số dư ví được tính lại. Không thể hoàn tác." The dialog falls back to ConfirmDialog's "Xóa" / "Hủy"; pass `transactions.form.delete` + `common.action.keep` (glossary: safe branch "Giữ lại") |

### `mobile/src/features/transactions/components/TransactionTypeChips.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.dropItems.title` | Bỏ ${itemCount} món? | one: Discard {{count}} item? · other: Discard {{count}} items? | TransactionTypeChips.tsx:39 | Switching to transfer with items. VI value: "Bỏ {{count}} món?" |
| `transactions.items.notOnTransfer` | Giao dịch chuyển tiền không có món. | Transfers can't have items. | TransactionTypeChips.tsx:40 | Same text as save-error-message.ts:11 (one key) |
| `transactions.dropItems.confirm` | Bỏ các món | Discard items | TransactionTypeChips.tsx:41 | |
| `common.action.keep` | Giữ lại | (common) | TransactionTypeChips.tsx:42 | |

### `mobile/src/features/transactions/components/TransactionWalletFields.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.form.walletsOffline` | Kết nối mạng để tải danh sách ví. | Connect to the internet to load wallets. | TransactionWalletFields.tsx:10 | Footer hint, no saved wallet list offline |
| `transactions.form.sameCurrencyOnly` | Chỉ hiện ví cùng loại tiền | Only wallets in the same currency | TransactionWalletFields.tsx:57 | Footer hint. Same text in chat EditTransactionChoices.tsx:96: share this key |
| `transactions.form.availableBalance` | Số dư khả dụng: ${formatCurrency(wallet.balance, wallet.currency)} | Available balance: {{balance}} | TransactionWalletFields.tsx:59 | refactor: the code appends the projection with a nested template; split into this key and the next |
| `transactions.form.availableBalanceAfter` | Số dư khả dụng: ${…} → ${formatCurrency(projectedBalance, wallet.currency)} sau giao dịch này | Available balance: {{balance}} → {{after}} after this transaction | TransactionWalletFields.tsx:59 | VI value: "Số dư khả dụng: {{balance}} → {{after}} sau giao dịch này" |
| `common.field.fromWallet` | Từ ví | (common) | TransactionWalletFields.tsx:83 | Field label (transfer) |
| `common.field.wallet` | Ví | (common) | TransactionWalletFields.tsx:83 | Field label |
| `common.action.choose` | Chọn | (common) | TransactionWalletFields.tsx:85 | Empty-field placeholder |
| `common.field.toWallet` | Đến ví | (common) | TransactionWalletFields.tsx:93 | |
| `common.action.choose` | Chọn | (common) | TransactionWalletFields.tsx:95 | |
| `common.field.toWallet` | Đến ví | (common) | TransactionWalletFields.tsx:104 | Disabled row title |
| `transactions.form.noTransferTarget` | Cần thêm một ví khác cùng đơn vị tiền tệ để chuyển khoản. | Add another wallet in the same currency to make a transfer. | TransactionWalletFields.tsx:105 | Glossary: "đơn vị tiền tệ" → "loại tiền". Proposed VI: "Cần thêm một ví cùng loại tiền để chuyển khoản." |

### `mobile/src/features/transactions/components/use-wallet-picker-panel.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.walletPicker.empty` | Chưa có ví. | No wallets yet. | use-wallet-picker-panel.tsx:67 | |

### `mobile/src/features/transactions/components/use-wallet-change-guard.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.walletChange.body.income` | Khi lưu, số dư ví ${original.name} giảm ${takenBack}, ví ${pending.name} tăng ${taken}. | On save, {{from}} goes down by {{oldAmount}} and {{to}} goes up by {{newAmount}}. | use-wallet-change-guard.ts:75 | Moving a saved income. VI value: "Khi lưu, số dư ví {{from}} giảm {{oldAmount}}, ví {{to}} tăng {{newAmount}}." Wallet names are user data (long-name safe) |
| `transactions.walletChange.body.expense` | Khi lưu, số dư ví ${original.name} tăng ${takenBack}, ví ${pending.name} giảm ${taken}. | On save, {{from}} goes up by {{oldAmount}} and {{to}} goes down by {{newAmount}}. | use-wallet-change-guard.ts:76 | Moving a saved expense |
| `transactions.walletChange.title` | Đổi sang ví ${pending.name}? | Move to {{wallet}}? | use-wallet-change-guard.ts:87 | VI value: "Đổi sang ví {{wallet}}?" |
| `transactions.walletChange.confirm` | Đổi ví | Change wallet | use-wallet-change-guard.ts:89 | |
| `transactions.walletChange.keep` | Giữ ví cũ | Keep old wallet | use-wallet-change-guard.ts:90 | Glossary: named safe branch |

### `mobile/src/features/transactions/components/TransactionKeypadFooter.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.date.today` | Hôm nay | (common) | TransactionKeypadFooter.tsx:38 | Date key. refactor: the other branches hand-build "24/09" / "24/09/25"; use the locale short-date formatter (EN "Sep 24" / "Sep 24, 25") |
| `transactions.keypad.chooseToWallet` | Chọn ví nhận | Choose receiving wallet | TransactionKeypadFooter.tsx:123 | Chip placeholder (transfer). Glossary: "ví nhận" |
| `common.action.chooseCategory` | Chọn danh mục | (common) | TransactionKeypadFooter.tsx:132 | Chip placeholder |
| `transactions.keypad.amountA11y` | Số tiền: ${amount.spoken} | Amount: {{amount}} | TransactionKeypadFooter.tsx:142 | a11y. `amount.spoken` is read in VI words today: needs an EN spoken form (translations-shared.md) |
| `transactions.keypad.notePlaceholder` | Ghi chú (không bắt buộc) | Note (optional) | TransactionKeypadFooter.tsx:160 | placeholder |
| `transactions.keypad.dateA11y` | Ngày giao dịch: ${formatDateShort(occurredAt)} | Transaction date: {{date}} | TransactionKeypadFooter.tsx:183 | a11y; `{{date}}` from the locale date formatter |

### `mobile/src/features/transactions/components/TransactionExtrasRow.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.field.location` | Vị trí | (common) | TransactionExtrasRow.tsx:63 | Row label |
| `common.action.add` | Thêm | (common) | TransactionExtrasRow.tsx:64 | Row value when empty |

### `mobile/src/features/transactions/components/use-transaction-form.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.form.error.wallet` | Vui lòng chọn ví | Choose a wallet. | use-transaction-form.ts:152 | Inline error. "Vui lòng" banned: proposed VI "Chọn ví." |
| `common.validation.chooseCategory` | Vui lòng chọn danh mục | (common) | use-transaction-form.ts:153 | |
| `transactions.form.error.toWallet` | Vui lòng chọn ví nhận | Choose a receiving wallet. | use-transaction-form.ts:154 | Proposed VI: "Chọn ví nhận." |
| `common.validation.enterAmount` | Vui lòng nhập số tiền | (common) | use-transaction-form.ts:157 | Current VI breaks the skill; the common key's VI "Nhập số tiền." replaces it |

### `mobile/src/features/transactions/components/StaleEditDialog.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.staleEdit.title` | Giao dịch đã được sửa ở nơi khác | This transaction was changed elsewhere | StaleEditDialog.tsx:27 | patterns.md §4 (conflict) |
| `transactions.staleEdit.body` | Lưu bản này sẽ thay bản kia. | Saving this version replaces the other one. | StaleEditDialog.tsx:28 | |
| `transactions.staleEdit.loadLatest` | Tải bản mới | Load latest | StaleEditDialog.tsx:30 | Same VI in NativeUpdateDialog.tsx:24 but a different meaning (app update): separate key there |
| `common.action.saveAnyway` | Vẫn lưu | (common) | StaleEditDialog.tsx:31 | |

### `mobile/src/features/transactions/items/save-error-message.ts`

Client copy branched on `error_code` for the form's inline error. Context-specific, so kept here rather than in the generic `errors.code.*` map of translations-errors.md. Every one is refused before a write, so "Your balance hasn't changed." is true.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `errors.saveTransactionFallback` | Không thể lưu giao dịch | Couldn't save the transaction. | save-error-message.ts:3 | Defined in translations-errors.md; today it is only the fallback after the raw server `message` |
| `transactions.saveError.ITEMS_TOTAL_MISMATCH` | Chưa lưu được. Tổng các món lệch số tiền giao dịch. Số dư chưa thay đổi. | Couldn't save. The items total doesn't match the transaction amount. Your balance hasn't changed. | save-error-message.ts:10 | |
| `transactions.items.notOnTransfer` | Giao dịch chuyển tiền không có món. | Transfers can't have items. | save-error-message.ts:11 | `ITEMS_NOT_ALLOWED`; same key as TransactionTypeChips.tsx:40 |
| `transactions.saveError.WALLET_CURRENCY_MISMATCH` | Chưa lưu được. Chỉ đổi sang ví cùng loại tiền. Số dư chưa thay đổi. | Couldn't save. Move it only to a wallet in the same currency. Your balance hasn't changed. | save-error-message.ts:14 | |
| `transactions.saveError.TRANSFER_WALLET_IMMUTABLE` | Chưa lưu được. Giao dịch chuyển tiền không đổi được ví. Số dư chưa thay đổi. | Couldn't save. A transfer's wallets can't be changed. Your balance hasn't changed. | save-error-message.ts:15 | |
| `transactions.saveError.WALLET_NOT_FOUND` | Chưa lưu được. Không tìm thấy ví đã chọn. Số dư chưa thay đổi. | Couldn't save. The selected wallet wasn't found. Your balance hasn't changed. | save-error-message.ts:16 | |

## Items editor

### `mobile/src/features/transactions/components/ItemsEntryRow.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.loading` | Đang tải | (common) | ItemsEntryRow.tsx:28 | Row value while the saved lines load |
| `common.count.items` | ${count} món | (common) | ItemsEntryRow.tsx:28 | Plural |
| `common.action.add` | Thêm | (common) | ItemsEntryRow.tsx:28 | Row value when there are no items |
| `common.field.items` | Các món | (common) | ItemsEntryRow.tsx:32 | Row label |
| `common.count.items` | ${lines.items.length} món | (common) | ItemsEntryRow.tsx:34 | Detail line |
| `transactions.items.entryA11yTotal` | Các món: ${lines.items.length} món, tổng ${total} | one: Items: {{count}} item, total {{total}} · other: Items: {{count}} items, total {{total}} | ItemsEntryRow.tsx:42 | a11y. VI value: "Các món: {{count}} món, tổng {{total}}" |
| `transactions.items.entryA11y` | Các món: ${summary} | Items: {{summary}} | ItemsEntryRow.tsx:42 | a11y; `{{summary}}` is one of the row values above |

### `mobile/src/features/transactions/components/ItemsEditorPanel.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.items.title` | Chi tiết món | Item details | ItemsEditorPanel.tsx:41 | Panel title (glossary refers to it) |
| `transactions.items.undoFallbackName` | món | item | ItemsEditorPanel.tsx:131 | Name used when a removed item had none; goes into `{{name}}` below |
| `transactions.items.removed` | Đã xóa ${name} | Deleted {{name}} | ItemsEditorPanel.tsx:133 | Undo row (glossary: Undo). `{{name}}` is user data |
| `transactions.items.max` | Tối đa + "món." | one: Up to {{count}} item. · other: Up to {{count}} items. | ItemsEditorPanel.tsx:172 | refactor: `Tối đa {TRANSACTION_ITEMS_MAX} món.` is three fragments. VI value: "Tối đa {{count}} món." |
| `transactions.items.add` | Thêm món | Add item | ItemsEditorPanel.tsx:174 | |
| `common.adjustment.group` | Thuế, phí, giảm giá | (common) | ItemsEditorPanel.tsx:179 | Entry row |
| `common.adjustment.group` | Thuế, phí, giảm giá | (common) | ItemsEditorPanel.tsx:183 | Section title |
| `transactions.adjustments.max` | Tối đa + "dòng." | one: Up to {{count}} line. · other: Up to {{count}} lines. | ItemsEditorPanel.tsx:203 | refactor: fragments. VI value: "Tối đa {{count}} dòng." |
| `transactions.adjustments.add` | Thêm dòng | Add line | ItemsEditorPanel.tsx:205 | |

### `mobile/src/features/transactions/components/ItemRow.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.items.unnamed` | Món chưa có tên | Unnamed item | ItemRow.tsx:28 | |
| `transactions.items.quantityOnly` | Số lượng ${item.quantity} | Quantity {{quantity}} | ItemRow.tsx:46 | Sub-line when quantity > 1 and no unit price |
| `common.action.delete` | Xóa | (common) | ItemRow.tsx:57 | Swipe action |
| `transactions.items.incomplete` | Điền tên, số lượng và thành tiền. | Enter the name, quantity and amount. | ItemRow.tsx:71 | Inline error |
| `common.status.notEntered` | Chưa nhập | (common) | ItemRow.tsx:76 | Missing amount |
| `transactions.items.nameLabel` | Tên món | Item name | ItemRow.tsx:98 | |
| `transactions.items.namePlaceholder` | vd: Sữa đặc | e.g. Condensed milk | ItemRow.tsx:104 | placeholder |
| `common.field.quantity` | Số lượng | (common) | ItemRow.tsx:115 | |
| `common.field.unitPrice` | Đơn giá | (common) | ItemRow.tsx:121 | |
| `common.field.unitPrice` | Đơn giá | (common) | ItemRow.tsx:126 | a11y |
| `common.field.lineAmount` | Thành tiền | (common) | ItemRow.tsx:133 | |
| `common.field.lineAmount` | Thành tiền | (common) | ItemRow.tsx:138 | a11y |
| `transactions.items.delete` | Xóa món | Delete item | ItemRow.tsx:143 | |

### `mobile/src/features/transactions/components/QuantityStepper.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.items.decrease` | Bớt một | Decrease quantity | QuantityStepper.tsx:30 | a11y |
| `common.field.quantity` | Số lượng | (common) | QuantityStepper.tsx:43 | a11y of the input |
| `transactions.items.increase` | Thêm một | Increase quantity | QuantityStepper.tsx:50 | a11y |

### `mobile/src/features/transactions/components/AdjustmentRow.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.adjustment.tax` | Thuế | (common) | AdjustmentRow.tsx:15 | Chip / row name |
| `common.adjustment.fee` | Phí | (common) | AdjustmentRow.tsx:16 | |
| `common.adjustment.discount` | Giảm giá | (common) | AdjustmentRow.tsx:17 | |
| `common.adjustment.other` | Khác | (common) | AdjustmentRow.tsx:18 | |
| `transactions.adjustments.direction.add` | Cộng thêm | Add | AdjustmentRow.tsx:22 | Direction chip for "Khác" |
| `transactions.adjustments.direction.subtract` | Trừ bớt | Subtract | AdjustmentRow.tsx:23 | |
| `common.action.delete` | Xóa | (common) | AdjustmentRow.tsx:55 | Swipe action |
| `transactions.adjustments.incompleteOther` | Chọn cộng hay trừ, ghi rõ và nhập số tiền. | Choose add or subtract, describe it and enter the amount. | AdjustmentRow.tsx:69 | Inline error, "Khác" line |
| `common.validation.enterAmount` | Nhập số tiền. | (common) | AdjustmentRow.tsx:69 | Inline error, fixed kinds |
| `common.status.notEntered` | Chưa nhập | (common) | AdjustmentRow.tsx:78 | |
| `transactions.adjustments.labelPlaceholder` | Ghi rõ, ví dụ Làm tròn | Describe it, e.g. Rounding | AdjustmentRow.tsx:126 | placeholder |
| `common.field.amount` | Số tiền | (common) | AdjustmentRow.tsx:135 | |
| `common.field.amount` | Số tiền | (common) | AdjustmentRow.tsx:140 | a11y |
| `transactions.adjustments.delete` | Xóa dòng | Delete line | AdjustmentRow.tsx:145 | |

### `mobile/src/features/transactions/components/ItemsTotalsPanel.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.field.total` | Tổng | (common) | ItemsTotalsPanel.tsx:31 | Glossary: lines total |
| `transactions.items.gapWithAmount` | Lệch ${gapText} so với số tiền giao dịch ${formatCurrency(amountCents, currency)}. | Off by {{gap}} from the transaction amount of {{amount}}. | ItemsTotalsPanel.tsx:39 | VI value (glossary): "Lệch {{gap}} so với số tiền giao dịch {{amount}}." |
| `transactions.items.gap` | Lệch ${gapText} so với số tiền giao dịch. | Off by {{gap}} from the transaction amount. | ItemsTotalsPanel.tsx:40 | No amount entered yet |
| `transactions.items.addDifference` | Ghi phần lệch | Add difference | ItemsTotalsPanel.tsx:43 | Adds a line for the gap |
| `transactions.items.useTotal` | Lấy theo tổng | Use total | ItemsTotalsPanel.tsx:44 | Sets the transaction amount to the total |
| `common.action.done` | Xong | (common) | ItemsTotalsPanel.tsx:48 | Returns to the form, never saves |

### `mobile/src/features/transactions/components/ItemsUndoRow.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.items.undo` | Hoàn tác | Undo | ItemsUndoRow.tsx:24 | Glossary: undo |

### `mobile/src/features/transactions/components/TransactionItemsSection.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.items.offlineCount` | món. Kết nối mạng để xem các món. | one: {{count}} item. Connect to the internet to see it. · other: {{count}} items. Connect to the internet to see them. | TransactionItemsSection.tsx:24 | refactor: `{itemCount} món. …` → one key. VI value: "{{count}} món. Kết nối mạng để xem các món." |
| `common.field.items` | Các món | (common) | TransactionItemsSection.tsx:31 | Section title |
| `transactions.items.itemsTotal` | Tổng các món | Items total | TransactionItemsSection.tsx:42 | Glossary: items total |

### `mobile/src/features/transactions/items/use-items-editor.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.items.problem.incomplete` | Điền đủ từng món trước khi lưu. | Complete every item before saving. | use-items-editor.ts:43 | Inline error on the form's items row |
| `transactions.items.problem.mismatch` | Tổng các món lệch số tiền giao dịch. | The items total doesn't match the transaction amount. | use-items-editor.ts:45 | |

## Location step

### `mobile/src/features/transactions/components/use-transaction-location.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.location.tileA11y` | Vị trí: ${shownPin.place_name ?? "chưa có tên khu vực"}. Mở bản đồ | Location: {{place}}. Opens the map | use-transaction-location.ts:140 | a11y. refactor: the fallback is a fragment; use the next key when there is no name. `{{place}}` is the stored place name (user data, see Not translated) |
| `transactions.location.tileA11yUnnamed` | "chưa có tên khu vực" (fallback inside the line above) | Location: no area name. Opens the map | use-transaction-location.ts:140 | VI value: "Vị trí: chưa có tên khu vực. Mở bản đồ" |
| `transactions.location.pinOnSave` | Ghim khi lưu | Pinned on save | use-transaction-location.ts:144 | Tile value when the Settings default pins on save |
| `transactions.location.add` | Thêm vị trí | Add location | use-transaction-location.ts:144 | Tile value |
| `transactions.location.add` | Thêm vị trí | Add location | use-transaction-location.ts:148 | a11y; same text in chat use-proposal-location.ts:94, :98 |

### `mobile/src/features/transactions/components/use-location-step.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.close` | Đóng | (common) | use-location-step.tsx:181 | |
| `transactions.location.edit` | Sửa vị trí | Edit location | use-location-step.tsx:183 | |
| `transactions.location.saveWithout` | Lưu không kèm vị trí | Save without location | use-location-step.tsx:194 | |
| `common.action.cancel` | Huỷ | (common) | use-location-step.tsx:194 | Old spelling, VI value "Hủy" |
| `transactions.location.unpin` | Bỏ ghim | Remove pin | use-location-step.tsx:194 | |
| `common.action.save` | Lưu | (common) | use-location-step.tsx:201 | |
| `common.action.done` | Xong | (common) | use-location-step.tsx:201 | |
| `transactions.location.viewTitle` | Vị trí giao dịch | Transaction location | use-location-step.tsx:215 | Panel title (view) |
| `transactions.location.pickTitle` | Ghim vị trí | Pin location | use-location-step.tsx:215 | Panel title (pick) |

### `mobile/src/features/transactions/components/TransactionLocationPanel.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.location.error.denied` | Budgest chưa được cấp quyền vị trí. Hãy cho phép trong Cài đặt rồi thử lại. | Budgest doesn't have location access. Allow it in Settings, then try again. | TransactionLocationPanel.tsx:38 | "Hãy" (WARN), passive "được cấp". Proposed VI: "Budgest chưa có quyền vị trí. Cho phép trong Cài đặt rồi thử lại." |
| `transactions.location.error.servicesOff` | Định vị (GPS) đang tắt. Bật định vị để ghim vị trí giao dịch. | Location (GPS) is off. Turn it on to pin this transaction. | TransactionLocationPanel.tsx:39 | |
| `transactions.location.error.unavailable` | Chưa lấy được vị trí hiện tại. Thử lại ở nơi thoáng hơn. | Couldn't get your location. Try again somewhere more open. | TransactionLocationPanel.tsx:40 | |
| `transactions.location.locating` | Đang xác định vị trí… | Finding your location… | TransactionLocationPanel.tsx:67 | |
| `common.action.retry` | Thử lại | (common) | TransactionLocationPanel.tsx:78 | |
| `common.action.openSettings` | Mở Cài đặt | (common) | TransactionLocationPanel.tsx:80 | |
| `transactions.location.naming` | Đang tìm khu vực… | Finding the area… | TransactionLocationPanel.tsx:112 | |
| `transactions.location.noAreaName` | Chưa có tên khu vực (cần mạng) — vẫn lưu toạ độ | No area name (needs internet). Coordinates are still saved. | TransactionLocationPanel.tsx:112 | Em dash banned. Proposed VI: "Chưa có tên khu vực (cần mạng). Vẫn lưu toạ độ." |
| `common.action.openInMaps` | Mở trên Google Maps | (common) | TransactionLocationPanel.tsx:120 | |
| `transactions.location.noteLabel` | Ghi chú địa điểm | Place note | TransactionLocationPanel.tsx:124 | |
| `transactions.location.noteEmpty` | Chưa có ghi chú cho địa điểm này. | No note for this place. | TransactionLocationPanel.tsx:125 | |
| `transactions.location.adjustHint` | · Chạm hoặc kéo ghim để chỉnh lại | {{coords}} · Tap or drag the pin to adjust | TransactionLocationPanel.tsx:130 | refactor: `{formatCoordinates(coords)} · Chạm…` → one key. VI value: "{{coords}} · Chạm hoặc kéo ghim để chỉnh lại" |
| `transactions.location.notePlaceholder` | Ghi chú về địa điểm: đường đi, cổng, tầng… (không bắt buộc) | Note about the place: directions, gate, floor… (optional) | TransactionLocationPanel.tsx:134 | placeholder |

### `mobile/src/features/transactions/components/PlaceSearch.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.place.searchPlaceholder` | Tìm địa chỉ, tên đường | Search address or street | PlaceSearch.tsx:70 | placeholder |
| `common.action.clearSearch` | Xóa tìm kiếm | (common) | PlaceSearch.tsx:76 | a11y |
| `transactions.place.unnamed` | Vị trí chưa có tên | Unnamed place | PlaceSearch.tsx:95 | Saved-place chip |
| `transactions.place.savedHeader` | Đã ghim trước đây | Saved places | PlaceSearch.tsx:108 | Glossary: saved place |
| `transactions.place.unnamed` | Vị trí chưa có tên | Unnamed place | PlaceSearch.tsx:119 | Result row |
| `transactions.place.removeSaved` | Xóa nơi đã ghim | Delete saved place | PlaceSearch.tsx:131 | a11y (glossary button) |
| `transactions.place.resultsHeader` | Kết quả | Results | PlaceSearch.tsx:138 | |
| `transactions.place.searching` | Đang tìm… | Searching… | PlaceSearch.tsx:142 | |
| `transactions.place.searchFailed` | Chưa tìm được địa điểm. Kiểm tra mạng rồi thử lại. | Couldn't search places. Check your connection and try again. | PlaceSearch.tsx:146 | |
| `transactions.place.noResults` | Không tìm thấy địa điểm. Thử thêm tên quận, thành phố. | No places found. Try adding a district or city. | PlaceSearch.tsx:149 | |

### `mobile/src/features/transactions/components/LocationMap.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.openInMaps` | Mở trên Google Maps | (common) | LocationMap.tsx:35 | Fallback when no map key |

## Offline sync (outbox)

### `mobile/src/features/transactions/components/use-save-or-queue.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.sync.queued` | Đã lưu trên máy, sẽ đồng bộ khi có mạng. | Saved on this phone. Syncs when you're online. | use-save-or-queue.ts:13 | toast (info). The queue is real, so the promise is allowed (skill: app-money rules) |
| `transactions.sync.queueFull` | Có quá nhiều giao dịch chờ đồng bộ. Hãy kết nối mạng để đồng bộ trước. | Too many transactions are waiting to sync. Connect to sync them first. | use-save-or-queue.ts:14 | toast (warning). "Hãy" (WARN). Proposed VI: "Có quá nhiều giao dịch chờ đồng bộ. Kết nối mạng để đồng bộ trước." |

### `mobile/src/features/transactions/components/PendingSyncSection.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.status.pendingSync` | Chờ đồng bộ | (common) | PendingSyncSection.tsx:10 | Section title |

### `mobile/src/features/transactions/components/PendingSyncRow.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.sync.status.waiting` | Đang chờ | Waiting | PendingSyncRow.tsx:16 | |
| `transactions.sync.status.sending` | Đang gửi | Sending | PendingSyncRow.tsx:17 | |
| `transactions.sync.status.failed` | Lỗi: ${item.error_message ?? ""} | Error: {{message}} | PendingSyncRow.tsx:21 | `error_message` is the raw server `message`, persisted in the outbox: it stays in the language it was received in. Store `error_code` (already in `markFailed`) and render through translations-errors.md at display time |

### `mobile/src/features/transactions/components/PendingSyncActionsSheet.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.sync.discard.title` | Bỏ giao dịch chưa đồng bộ này? | Discard this unsynced transaction? | PendingSyncActionsSheet.tsx:22 | |
| `transactions.sync.discard.body` | Giao dịch sẽ bị xoá khỏi máy và không được gửi lên tài khoản. | It's removed from this phone and never sent to your account. | PendingSyncActionsSheet.tsx:23 | "tài khoản" here is the user account (glossary-correct) |
| `transactions.sync.discard.maybeSent` | Giao dịch có thể đã được lưu lên tài khoản. Hãy kiểm tra danh sách sau khi đồng bộ. | It may already be saved to your account. Check the list after syncing. | PendingSyncActionsSheet.tsx:24 | "Hãy" (WARN). Proposed VI: "Giao dịch có thể đã lưu lên tài khoản. Kiểm tra danh sách sau khi đồng bộ." |
| `common.action.discard` | Bỏ | (common) | PendingSyncActionsSheet.tsx:25 | Confirm button |
| `transactions.sync.sendingHint` | Đang gửi — chờ một chút để sửa hoặc bỏ. | Sending. Wait a moment to edit or discard it. | PendingSyncActionsSheet.tsx:27 | Em dash banned. Proposed VI: "Đang gửi. Chờ một chút để sửa hoặc bỏ." |
| `common.action.retry` | Thử lại | (common) | PendingSyncActionsSheet.tsx:79 | |
| `common.action.edit` | Sửa | (common) | PendingSyncActionsSheet.tsx:81 | |
| `common.action.discard` | Bỏ | (common) | PendingSyncActionsSheet.tsx:88 | |

### `mobile/src/features/transactions/outbox/flush-report.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.sync.synced` | Đã đồng bộ ${n} giao dịch. | one: Synced {{count}} transaction · other: Synced {{count}} transactions | flush-report.ts:10 | toast. VI value: "Đã đồng bộ {{count}} giao dịch" (toast: no period) |
| `transactions.sync.failed` | ${n} giao dịch không thể đồng bộ — vui lòng kiểm tra. | one: {{count}} transaction couldn't sync. Check the list. · other: {{count}} transactions couldn't sync. Check the list. | flush-report.ts:11 | toast. Em dash and "vui lòng" banned. Proposed VI: "{{count}} giao dịch chưa đồng bộ được. Kiểm tra danh sách." |
| `transactions.sync.replayDiffers` | Giao dịch này đã được lưu trước đó; thay đổi sau không được áp dụng. Hãy sửa trong danh sách. | This transaction was already saved, without your later changes. Edit it in the list. | flush-report.ts:12 | toast. Passives, "Hãy". Proposed VI: "Giao dịch đã lưu trước đó, chưa gồm thay đổi sau. Sửa trong danh sách." |
| `transactions.sync.serverError` | Lỗi máy chủ | The server had a problem | flush-report.ts:13 | Stored as the failed item's message (flush-outbox.ts:62), then shown after "Lỗi: " |

### `mobile/src/features/transactions/outbox/classify-send-error.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `errors.saveTransactionFallback` | Không thể lưu giao dịch | Couldn't save the transaction. | classify-send-error.ts:15 | Defined in translations-errors.md |

## Import / export

### `mobile/src/features/transactions/use-transaction-io.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.export.failed` | Không xuất được tệp | Couldn't export the file | use-transaction-io.tsx:45 | toast (error); today only the fallback after the raw server `message` |
| `transactions.import.wrongType` | Chỉ hỗ trợ tệp .xlsx | Choose an .xlsx file | use-transaction-io.tsx:66 | toast (error) |
| `transactions.import.tooLarge` | Tệp vượt quá giới hạn 5MB | File is over {{limit}} | use-transaction-io.tsx:72 | toast. VI value: "Tệp vượt quá giới hạn {{limit}}"; `{{limit}}` from `IMPORT_MAX_UPLOAD_BYTES` |
| `transactions.import.readFailed` | Không đọc được tệp | Couldn't read the file | use-transaction-io.tsx:85 | toast (error) |
| `transactions.import.expired` | Phiên nhập đã hết hạn. Chọn lại tệp. | This import expired. Choose the file again. | use-transaction-io.tsx:99 | toast. EN avoids "session" (glossary: no session on UI) |

### `mobile/src/features/transactions/api/use-export-transactions-mutation.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.export.shareUnavailable` | Thiết bị này không hỗ trợ chia sẻ tệp. | This phone can't share files. | use-export-transactions-mutation.ts:44 | Thrown as a plain Error; `getErrorMessage` replaces non-HTTP errors with the fallback, so it never shows today. Show it once keyed |
| `transactions.export.shareTitle` | Xuất giao dịch | Export transactions | use-export-transactions-mutation.ts:49 | Android share-sheet title |

### `mobile/src/features/transactions/components/ImportPreviewModal.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.done` | Xong | (common) | ImportPreviewModal.tsx:58 | |
| `common.action.cancel` | Hủy | (common) | ImportPreviewModal.tsx:61 | |
| `transactions.import.confirm` | Nhập ${validCount} dòng | one: Import {{count}} row · other: Import {{count}} rows | ImportPreviewModal.tsx:63 | VI value: "Nhập {{count}} dòng" |
| `transactions.import.nothingToImport` | Không có dòng nào | No rows to import | ImportPreviewModal.tsx:63 | Disabled button |
| `transactions.import.preview.title` | Xem trước khi nhập | Review before import | ImportPreviewModal.tsx:79 | |
| `transactions.import.preview.body` | Chưa có gì được lưu. Kiểm tra … dòng bên dưới rồi xác nhận. | one: Nothing is saved yet. Check the {{count}} row below, then confirm. · other: Nothing is saved yet. Check the {{count}} rows below, then confirm. | ImportPreviewModal.tsx:81 | refactor: `Chưa có gì được lưu. Kiểm tra {total} dòng bên dưới rồi xác nhận.` (2 fragments) → one key. VI value: "Chưa lưu gì. Kiểm tra {{count}} dòng bên dưới rồi xác nhận." (drops passive "được") |
| `transactions.import.preview.toImport` | Sẽ nhập | To import | ImportPreviewModal.tsx:85 | Count tile |
| `transactions.import.summary.skipped` | Bỏ qua | Skipped | ImportPreviewModal.tsx:86 | Count tile. Not `common.action.skip`: a count, not a button |
| `transactions.import.preview.errors` | Lỗi | Errors | ImportPreviewModal.tsx:87 | Count tile |
| `transactions.import.preview.total` | Tổng: + amount | Total: {{amount}} | ImportPreviewModal.tsx:91 | refactor: `Tổng: {formatCurrency(…)}` → one key, VI value "Tổng: {{amount}}" |
| `transactions.import.preview.errorRows` | Dòng bị lỗi — sửa trong file rồi tải lại | Rows with errors: fix the file and upload it again | ImportPreviewModal.tsx:96 | Em dash banned. Proposed VI: "Dòng bị lỗi: sửa trong file rồi tải lại" |
| `transactions.import.preview.duplicates` | Đã nhập trước đó — sẽ bỏ qua | Already imported: will be skipped | ImportPreviewModal.tsx:101 | Em dash banned. Proposed VI: "Đã nhập trước đó, sẽ bỏ qua" |
| `transactions.import.result.title` | Đã nhập xong | Import finished | ImportPreviewModal.tsx:117 | |
| `transactions.import.summary.imported` | Đã nhập | Imported | ImportPreviewModal.tsx:119 | Count tile |
| `transactions.import.summary.skipped` | Bỏ qua | Skipped | ImportPreviewModal.tsx:120 | Count tile |
| `transactions.import.summary.failed` | Thất bại | Failed | ImportPreviewModal.tsx:121 | Count tile |
| `transactions.import.result.failedRows` | Dòng không tạo được | Rows not imported | ImportPreviewModal.tsx:123 | |
| `transactions.import.issueRow` | Dòng + " — " + reason | Row {{row}}: {{reason}} | ImportPreviewModal.tsx:172 | refactor: `Dòng {issue.row} — {issue.reason}` → one key, VI value "Dòng {{row}}: {{reason}}" (drops the em dash). `{{reason}}` is backend text: needs a per-row reason code (translations-errors.md) |
| `transactions.import.more` | và + dòng nữa | one: and {{count}} more row · other: and {{count}} more rows | ImportPreviewModal.tsx:176 | refactor: `và {hidden} dòng nữa` → one key, VI value "và {{count}} dòng nữa" |

## Not translated

| Source | Text | Reason |
|---|---|---|
| draft-from-text.ts:16 | triệu | Parsing vocabulary for the user's own typed amount ("1 triệu"), not shown. Whether EN input ("1.2m", "50k" already work; "thousand", "million" do not) gets its own vocabulary is a separate decision (spec open question) |
| draft-from-text.ts:17 | nghìn | Same |
| draft-from-text.ts:18 | ngàn | Same |
| draft-from-text.ts:20 | củ | Same (slang for million) |
| TransactionsHeader.tsx:139 (JSX comment) | Nhập Excel | Inside a commented-out import button; translate (`transactions.header.import`, EN "Import from Excel") only if the button comes back |
| location/place-name.ts, use-place-search.ts | place names ("Quận 1, TP. Hồ Chí Minh") | Reverse-geocoded by the OS in the phone's language, then saved with the transaction: user data, never re-translated |
| use-export-transactions-mutation.ts:35 | `transactions_<from>_<to>.xlsx` | File name and the workbook's sheet/column names come from the backend and are already English |
| ImportPreviewModal.tsx:172 | `{{reason}}` values | Backend-rendered import row reasons; handled with error codes in translations-errors.md |
