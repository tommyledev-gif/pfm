# Translations: shared components and libraries

> Scope: `mobile/src/components/{shared,ui,debug}`, `mobile/src/lib/**`, `mobile/src/stores/**`, `mobile/src/theme/**`, `mobile/src/features/app-update/**`. 165 rows (124 new keys, 41 reuses of `common.*` / `nav.*`), plus the "Not translated" list at the end. Conventions: [translations.md](./translations.md). Line numbers are from the working tree on 2026-10-29 (`OfflineBanner.tsx` and `TopBar.tsx` had uncommitted edits that day; their current lines are used).

## Navigation

### `mobile/src/components/shared/BottomNav.tsx`

The bar is icon-only: each label is what a screen reader announces.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.tab.home` | Trang chủ | (common) | BottomNav.tsx:33 | a11y |
| `nav.tab.transactions` | Giao dịch | (common) | BottomNav.tsx:34 | a11y |
| `nav.tab.assistant` | Trợ lý | (common) | BottomNav.tsx:35 | a11y |
| `nav.tab.insights` | Phân tích | (common) | BottomNav.tsx:36 | a11y |
| `nav.tab.settings` | Cài đặt | (common) | BottomNav.tsx:37 | a11y |

### `mobile/src/components/shared/TopBar.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.tab.settings` | Cài đặt | (common) | TopBar.tsx:43 | a11y of the avatar button, which opens Settings |
| `nav.title.notifications` | (none today) | (common) | TopBar.tsx:28 | a11y gap: the bell button has no `accessibilityLabel`. Add one while migrating: VI "Thông báo", EN "Notifications" |

### `mobile/src/components/shared/ScreenHeader.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.back` | Quay lại | (common) | ScreenHeader.tsx:63 | a11y of the back chevron |

## Dialogs, sheets and toasts

### `mobile/src/components/shared/ConfirmDialog.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.delete` | Xóa | (common) | ConfirmDialog.tsx:34 | Default `confirmLabel`. Callers should pass "Xóa <thing>" / "Delete <thing>" (patterns §6) |
| `common.action.cancel` | Hủy | (common) | ConfirmDialog.tsx:35 | Default `cancelLabel`. Glossary (14/10/2026): the safe branch of a delete confirm is "Giữ lại" / "Keep"; switch the default to `common.action.keep` when migrating |

### `mobile/src/components/shared/Drawer.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.close` | Đóng | (common) | Drawer.tsx:184 | a11y of the dimmed backdrop |

### `mobile/src/components/shared/SheetHandle.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.sheetHandle.collapse` | Kéo xuống để thu nhỏ | Drag down to collapse | SheetHandle.tsx:45 | a11y, sheet expanded |
| `ui.sheetHandle.expand` | Kéo lên để mở rộng | Drag up to expand | SheetHandle.tsx:45 | a11y, sheet collapsed |

### `mobile/src/components/shared/Toast.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.toast.dismiss` | Đóng thông báo | Dismiss | Toast.tsx:15 | a11y of the toast's close button. "thông báo" here is the toast, not a Notification |

### `mobile/src/components/ui/ExpandableFab.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.close` | Đóng | (common) | ExpandableFab.tsx:137 | a11y while the FAB menu is open |

### `mobile/src/components/shared/ScreenLoader.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.loading` | Đang tải | (common) | ScreenLoader.tsx:83 | a11y default when no `label` is passed |

### `mobile/src/components/ui/AmountPromptModal.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.cancel` | Huỷ | (common) | AmountPromptModal.tsx:60 | Old spelling; VI locale value is "Hủy" |
| `common.action.done` | Xong | (common) | AmountPromptModal.tsx:61 | |
| `common.action.max` | Tối đa | (common) | AmountPromptModal.tsx:72 | Label beside the maximum amount, when the caller passes no `hint` |

## Category picking

### `mobile/src/components/shared/CategoryPickerDrawer.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.chooseCategory` | Chọn danh mục | (common) | CategoryPickerDrawer.tsx:38 | Default drawer title |
| `common.action.close` | Đóng | (common) | CategoryPickerDrawer.tsx:50 | |
| `common.field.searchCategories` | Tìm danh mục | (common) | CategoryPickerDrawer.tsx:52 | placeholder |
| `common.empty.noMatchingCategories` | Không có danh mục nào khớp. | (common) | CategoryPickerDrawer.tsx:56 | |

### `mobile/src/components/shared/CategorySelectField.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.categoryField.placeholder` | Chưa chọn danh mục | No category chosen | CategorySelectField.tsx:25 | Default placeholder of the empty box |
| `common.action.chooseCategory` | Chọn danh mục | (common) | CategorySelectField.tsx:45 | Link under an empty field |
| `ui.categoryField.change` | Đổi danh mục | Change category | CategorySelectField.tsx:45 | Link under a filled field |

## Date pickers and calendar

### `mobile/src/components/shared/DateRangePickerModal.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.dateRange.title` | Khoảng thời gian | Date range | DateRangePickerModal.tsx:124 | |
| `ui.dateRange.selected` | `${formatDateShort(start)}${end && end !== start ? `  –  ${formatDateShort(end)}` : ""}` | {{from}} – {{to}} | DateRangePickerModal.tsx:127 | Dates only; values from the locale date formatter (see "Formatting helpers"). One-day range shows `{{from}}` alone, no key needed |
| `ui.dateRange.pickStart` | Chọn ngày bắt đầu | Choose a start date | DateRangePickerModal.tsx:128 | |
| `ui.dateRange.maxHint` | Khoảng thời gian tối đa {MAX_RANGE_DAYS} ngày. | one: Up to {{count}} day. · other: Up to {{count}} days. | DateRangePickerModal.tsx:140 | refactor: JSX fragments "Khoảng thời gian tối đa" + "ngày." become one key. VI: "Khoảng thời gian tối đa {{count}} ngày." |
| `common.action.clearFilter` | Xóa lọc | (common) | DateRangePickerModal.tsx:143 | |
| `common.action.apply` | Áp dụng | (common) | DateRangePickerModal.tsx:144 | |

### `mobile/src/components/shared/SingleDatePickerModal.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.datePicker.title` | Chọn ngày | Choose date | SingleDatePickerModal.tsx:43 | |
| `common.action.cancel` | Hủy | (common) | SingleDatePickerModal.tsx:54 | |
| `common.action.apply` | Áp dụng | (common) | SingleDatePickerModal.tsx:55 | |

### `mobile/src/components/shared/MonthYearCalendar.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.calendar.pickMonthYear` | Chọn tháng và năm | Choose month and year | MonthYearCalendar.tsx:79 | a11y of the month title button |
| `ui.calendar.monthYear` | Tháng {month.getMonth() + 1}, {month.getFullYear()} | {{month}} {{year}} | MonthYearCalendar.tsx:82 | refactor: JSX "Tháng" + numbers. `{{month}}` = `format.calendar.monthNames[i]`, so VI is "{{month}}, {{year}}" → "Tháng 10, 2026"; EN "October 2026" |

### `mobile/src/components/shared/MonthYearWheelSheet.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `format.calendar.monthNames` | `Tháng ${i + 1}` | (same key) | MonthYearWheelSheet.tsx:11 | Month wheel labels; same array as calendar-theme.ts below |
| `common.action.close` | Đóng | (common) | MonthYearWheelSheet.tsx:51 | a11y of the backdrop |
| `ui.monthYearSheet.title` | Chọn thời gian | Choose month | MonthYearWheelSheet.tsx:56 | The sheet picks a month and a year; "time" in EN reads as a clock time |
| `common.action.close` | Đóng | (common) | MonthYearWheelSheet.tsx:57 | a11y of the X button |
| `common.action.apply` | Áp dụng | (common) | MonthYearWheelSheet.tsx:75 | |

### `mobile/src/lib/calendar-theme.ts`

`react-native-calendars` reads names from `LocaleConfig.locales[<code>]`. Proposal: register both `vi` and `en` from the locale files (arrays read with `t(key, { returnObjects: true })`) and set `LocaleConfig.defaultLocale` to the active language on every switch. EN values could also come from `Intl.DateTimeFormat("en", { month: "long" | "short" })` / `{ weekday: "long" | "short" }`; VI must stay hand-written because `Intl` for `vi` gives "tháng 10" and "Th 2", not the app's "Tháng 10" and "T2". A calendar already open keeps its old names (it only mounts inside modals, so a switch from Settings never meets an open one).

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `format.calendar.monthNames` | `Tháng ${i + 1}` (Tháng 1 … Tháng 12) | January, February, March, April, May, June, July, August, September, October, November, December | calendar-theme.ts:12 | Array, 12 items |
| `format.calendar.monthNamesShort` | `Th${i + 1}` (Th1 … Th12) | Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec | calendar-theme.ts:13 | Array. Missed by the diacritic scan |
| `format.calendar.dayNames` | Chủ nhật, Thứ hai, Thứ ba, Thứ tư, Thứ năm, Thứ sáu, Thứ bảy | Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, Saturday | calendar-theme.ts:14 | Array, Sunday first (library order) |
| `format.calendar.dayNamesShort` | CN, T2, T3, T4, T5, T6, T7 | Sun, Mon, Tue, Wed, Thu, Fri, Sat | calendar-theme.ts:15 | Array; weekday header row. Missed by the diacritic scan |
| `common.date.today` | Hôm nay | (common) | calendar-theme.ts:16 | `today` label of the library |

## Offline banner and sheet

### `mobile/src/components/shared/OfflineBanner.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.offline.strip` | Bạn đang ngoại tuyến | You're offline | OfflineBanner.tsx:20 | Strip under the status bar. Changed from "Ngoại tuyến" in the working tree on 2026-10-29 |
| `ui.offline.reconnected` | Đã kết nối lại · đang đồng bộ | Back online · syncing | OfflineBanner.tsx:21 | |
| `ui.offline.openHint` | Xem dữ liệu cập nhật lúc nào và thao tác nào cần mạng | Shows when data was last updated and what needs a connection | OfflineBanner.tsx:22 | a11y hint. VI "thao tác" is on the skill's WARN list; proposed VI: "Xem dữ liệu cập nhật lúc nào và việc nào cần mạng" |
| `ui.offline.stripQueued` | `${OFFLINE_LABEL} · ${queuedCount} chờ đồng bộ` | one: You're offline · {{count}} waiting to sync · other: You're offline · {{count}} waiting to sync | OfflineBanner.tsx:60 | refactor: built from `OFFLINE_LABEL` + fragment; one key. VI: "Bạn đang ngoại tuyến · {{count}} chờ đồng bộ" |

### `mobile/src/components/shared/OfflineInfoSheet.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.offline.sheet.stillWorks.viewSaved` | Xem dữ liệu đã lưu | View saved data | OfflineInfoSheet.tsx:18 | List item |
| `ui.offline.sheet.stillWorks.addTransaction` | Thêm giao dịch mới — tự đồng bộ khi có mạng | Add transactions, synced when you're back online | OfflineInfoSheet.tsx:18 | List item. VI uses "—" (banned); proposed VI: "Thêm giao dịch, tự đồng bộ khi có mạng" |
| `ui.offline.sheet.needsNetwork.editDelete` | Sửa hoặc xoá giao dịch | Edit or delete transactions | OfflineInfoSheet.tsx:20 | "xoá" is the old spelling; VI locale value "xóa" |
| `ui.offline.sheet.needsNetwork.manage` | Thêm, sửa ví, danh mục, ngân sách | Add or edit wallets, categories, budgets | OfflineInfoSheet.tsx:21 | |
| `ui.offline.sheet.needsNetwork.assistant` | Trò chuyện với AI và duyệt đề xuất | Chat with the assistant and review pending items | OfflineInfoSheet.tsx:22 | "đề xuất" = AI drafts; glossary EN for those is "pending" |
| `ui.offline.sheet.needsNetwork.importExport` | Nhập, xuất dữ liệu | Import and export data | OfflineInfoSheet.tsx:23 | |
| `ui.offline.sheet.needsNetwork.inviteMembers` | Mời thành viên | Invite members | OfflineInfoSheet.tsx:24 | Same text as the Users screen button; separate key because it is a list item here |
| `common.action.gotIt` | Đã hiểu | (common) | OfflineInfoSheet.tsx:54 | |
| `ui.offline.sheet.title` | Đang ngoại tuyến | You're offline | OfflineInfoSheet.tsx:56 | |
| `ui.offline.sheet.lastUpdated` | `Dữ liệu cập nhật lúc ${formatLastUpdated(lastUpdatedMs)}` | Last updated {{time}} | OfflineInfoSheet.tsx:60 | `{{time}}`: "14:05" today, otherwise date + time from the locale formatter (today hand-built "dd/mm HH:mm" at OfflineInfoSheet.tsx:111) |
| `ui.offline.sheet.noSavedData` | Chưa có dữ liệu nào được lưu trên máy | No data saved on this phone yet | OfflineInfoSheet.tsx:61 | |
| `ui.offline.sheet.staleNote` | Số dư và số liệu có thể đã cũ cho tới khi có mạng lại. | Balances and figures may be out of date until you're back online. | OfflineInfoSheet.tsx:63 | |
| `ui.offline.sheet.queued` | {queuedCount} giao dịch đang chờ — sẽ tự đồng bộ khi có mạng. | one: {{count}} transaction waiting. It syncs when you're back online. · other: {{count}} transactions waiting. They sync when you're back online. | OfflineInfoSheet.tsx:65 | VI uses "—"; proposed VI: "{{count}} giao dịch đang chờ. Tự đồng bộ khi có mạng." |
| `ui.offline.sheet.stillWorksTitle` | Vẫn làm được | Still works | OfflineInfoSheet.tsx:69 | Section header |
| `ui.offline.sheet.needsNetworkTitle` | Cần kết nối mạng | Needs a connection | OfflineInfoSheet.tsx:74 | Section header |

## Calculator and amount input

### `mobile/src/components/ui/CalculatorKeypad.tsx`

What a screen reader says for each key. The spoken order ("5 plus 3") is the same in both languages, so `spokenExpression` may keep joining tokens.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.calculator.spoken.plus` | cộng | plus | CalculatorKeypad.tsx:24 | a11y |
| `ui.calculator.spoken.minus` | trừ | minus | CalculatorKeypad.tsx:25 | a11y |
| `ui.calculator.spoken.times` | nhân | times | CalculatorKeypad.tsx:26 | a11y |
| `ui.calculator.spoken.divide` | chia | divided by | CalculatorKeypad.tsx:27 | a11y. Missed by the diacritic scan |
| `ui.calculator.spoken.decimal` | dấu thập phân | decimal point | CalculatorKeypad.tsx:28 | a11y of the decimal key |
| `ui.calculator.spoken.tripleZero` | ba số không | triple zero | CalculatorKeypad.tsx:29 | a11y of the "000" key |
| `ui.calculator.backspace` | Xóa | Delete | CalculatorKeypad.tsx:177 | a11y of the backspace key. Not `common.action.delete`: removes one character |
| `ui.calculator.backspaceHint` | Nhấn giữ để xóa hết | Hold to clear all | CalculatorKeypad.tsx:178 | a11y hint |
| `ui.calculator.confirm` | Xác nhận | Confirm | CalculatorKeypad.tsx:210 | a11y of the ✓ key. Plain "Xác nhận" is allowed here: the key's role is already clear from the sheet |

### `mobile/src/lib/calculator/format.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.calculator.spoken.plus` / `.minus` / `.times` / `.divide` | cộng / trừ / nhân / chia | (same keys as above) | format.ts:165 | `SPOKEN_OPERATOR` duplicates the keypad table; both read the same keys |
| `ui.calculator.spoken.decimalSeparator` | phẩy | point | format.ts:169 | a11y. VI reads the decimal separator as "phẩy" (comma), EN as "point". Template `" phẩy "` keeps its spaces in code, not in the locale value |

### `mobile/src/lib/use-amount-expression.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.amount.error.divideByZero` | Không thể chia cho 0 | Can't divide by 0 | use-amount-expression.ts:70 | Shown in the preview line |
| `ui.amount.error.outOfRange` | Vượt quá số tiền tối đa | Over the maximum amount | use-amount-expression.ts:71 | |
| `ui.amount.notice.rounded` | `Đã làm tròn thành ${formatValue(outcome.state.expression, currency)} vì ${currency} không có phần lẻ.` | Rounded to {{amount}} because {{currency}} has no decimals. | use-amount-expression.ts:106 | `{{amount}}` is the grouped value, `{{currency}}` the ISO code |
| `ui.amount.notice.cleared` | `Đã xóa số tiền vì ${currency} không có phần lẻ.` | Amount cleared because {{currency}} has no decimals. | use-amount-expression.ts:108 | |
| `ui.amount.problem.roundedToZero` | `Số tiền làm tròn về 0 — nhỏ hơn đơn vị nhỏ nhất của ${currency}.` | This rounds to 0, below the smallest {{currency}} unit. | use-amount-expression.ts:194 | VI uses "—"; proposed VI: "Số tiền làm tròn về 0, nhỏ hơn đơn vị nhỏ nhất của {{currency}}." |
| `ui.amount.problem.notPositive` | Số tiền phải lớn hơn 0. | Enter an amount above 0. | use-amount-expression.ts:195 | patterns §4. Proposed VI: "Nhập số tiền lớn hơn 0." |
| `ui.amount.spokenEmpty` | Chưa nhập số tiền | No amount entered | use-amount-expression.ts:204 | a11y of the empty amount |

### `mobile/src/components/shared/RevealableAmount.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.amount.revealHint` | Nhấn giữ để xem số tiền đầy đủ | Hold to see the full amount | RevealableAmount.tsx:101 | a11y hint |

### `mobile/src/components/shared/CurrencySwitch.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.currencySwitch.viewIn` | `Xem theo ${currency}` | Show in {{currency}} | CurrencySwitch.tsx:34 | a11y of each currency tab. Missed by the diacritic scan |

## Icon and emoji pickers

### `mobile/src/components/shared/use-icon-picker.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.field.chooseIcon` | Chọn biểu tượng | (common) | use-icon-picker.tsx:36 | Panel title |
| `ui.iconPicker.upload` | Tải ảnh từ thiết bị | Upload a photo | use-icon-picker.tsx:50 | |

### `mobile/src/components/shared/IconSelectField.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.iconField.uploaded` | Ảnh đã tải lên | Uploaded photo | IconSelectField.tsx:36 | What the current icon is |
| `ui.iconField.default` | Biểu tượng mặc định | Default icon | IconSelectField.tsx:39 | |
| `ui.iconField.hint` | Chạm để chọn emoji hoặc tải ảnh | Emoji or your own photo | IconSelectField.tsx:61 | VI explains the gesture (patterns §11: no "Chạm để…"); proposed VI: "Emoji hoặc ảnh tải lên". When an emoji is set the field shows its OpenMoji annotation, which is English data in both languages |

### `mobile/src/components/ui/EmojiPickerInput.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.emojiPicker.placeholder` | Chọn emoji | Choose emoji | EmojiPickerInput.tsx:26 | placeholder |
| `ui.emojiPicker.clear` | Xóa | Remove | EmojiPickerInput.tsx:38 | Clears the chosen emoji, deletes no data |

### `mobile/src/components/shared/OpenMojiGrid.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.openMoji.searchPlaceholder` | Tìm bằng tiếng Anh, vd: coffee | Search, e.g. coffee | OpenMojiGrid.tsx:66 | placeholder. OpenMoji keywords are English, so VI has to say "bằng tiếng Anh"; EN does not |
| `ui.openMoji.empty` | Không tìm thấy biểu tượng nào. | No icons found. | OpenMojiGrid.tsx:89 | |
| `ui.openMoji.credit` | Biểu tượng: OpenMoji (CC BY-SA 4.0) | Icons: OpenMoji (CC BY-SA 4.0) | OpenMojiGrid.tsx:108 | Licence attribution; keep the licence string as is |

### `mobile/src/lib/openmoji/index.ts`

Group chips are UI and get keys; each emoji's `annotation` and search keywords are OpenMoji catalogue data (English) and are not translated.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.openMoji.group.foodDrink` | Đồ ăn & Uống | Food & drink | index.ts:43 | chip |
| `ui.openMoji.group.objects` | Đồ vật | Objects | index.ts:44 | chip |
| `ui.openMoji.group.travelPlaces` | Du lịch & Địa điểm | Travel & places | index.ts:45 | chip |
| `ui.openMoji.group.activities` | Hoạt động | Activities | index.ts:46 | chip |
| `ui.openMoji.group.animalsNature` | Động vật & Thiên nhiên | Animals & nature | index.ts:47 | chip |
| `ui.openMoji.group.smileysEmotion` | Cảm xúc | Smileys | index.ts:48 | chip |
| `ui.openMoji.group.peopleBody` | Con người | People | index.ts:49 | chip |
| `ui.openMoji.group.symbols` | Ký hiệu | Symbols | index.ts:50 | chip |
| `ui.openMoji.group.flags` | Cờ | Flags | index.ts:51 | chip |

## Lists, rows, charts and uploads

### `mobile/src/components/shared/TransactionRow.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.count.items` | {itemCount} món | (common) | TransactionRow.tsx:131 | refactor: JSX number + "món" becomes `t("common.count.items", { count })` |

### `mobile/src/components/shared/DonutChart.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.donut.seeTransactions` | Xem giao dịch | See transactions | DonutChart.tsx:194 | Link in the segment tooltip |

### `mobile/src/components/ui/SearchField.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.clearSearch` | Xóa tìm kiếm | (common) | SearchField.tsx:44 | a11y |

### `mobile/src/components/ui/UploadButton.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.upload.waiting` | Đang tải ảnh lên… | Uploading photo… | UploadButton.tsx:16 | Also rendered by IconSelectField while a photo uploads |

### `mobile/src/lib/clipboard.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.clipboard.copied` | Đã sao chép | Copied | clipboard.ts:5 | toast |
| `ui.clipboard.copyFailed` | Không sao chép được | Couldn't copy | clipboard.ts:6 | toast |

### `mobile/src/lib/biometric-vault.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.cancel` | Hủy | (common) | biometric-vault.ts:35 | Cancel button of the system fingerprint prompt (passed to the native module). Read at call time so it follows the app language |

### `mobile/src/lib/device-identity.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.device.fallbackName` | Điện thoại | Phone | device-identity.ts:20 | Sent as `X-Device-Name` when Android reports no brand/model; stored server-side with the session and shown later in Security → signed-in devices in whatever language it was sent. Proposal: send an empty name instead and let the client render the glossary's "Thiết bị không rõ tên" / "Unknown device" at display time |

## Wallet colours and themes

### `mobile/src/lib/wallet-colors.ts`

Card colour names (glossary: card colour), read by a screen reader on each swatch (`WalletColorPicker.tsx` `accessibilityLabel`). The server stores only the colour key, so the label is pure UI.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.walletColor.blue` | Xanh dương | Blue | wallet-colors.ts:18 | a11y |
| `ui.walletColor.indigo` | Chàm | Indigo | wallet-colors.ts:19 | a11y |
| `ui.walletColor.violet` | Tím | Purple | wallet-colors.ts:20 | a11y |
| `ui.walletColor.magenta` | Tím hồng | Magenta | wallet-colors.ts:21 | a11y |
| `ui.walletColor.rose` | Đỏ hồng | Rose | wallet-colors.ts:22 | a11y |
| `ui.walletColor.orange` | Cam đất | Burnt orange | wallet-colors.ts:23 | a11y |
| `ui.walletColor.green` | Xanh lá | Green | wallet-colors.ts:24 | a11y |
| `ui.walletColor.teal` | Xanh két | Teal | wallet-colors.ts:25 | a11y |
| `ui.walletColor.slate` | Xám | Slate | wallet-colors.ts:26 | a11y. "Slate" sidesteps gray/grey until the EN spelling variant is decided |
| `ui.walletColor.amber` | Vàng | Yellow | wallet-colors.ts:27 | a11y |
| `ui.walletColor.lime` | Xanh nõn chuối | Lime | wallet-colors.ts:28 | a11y |
| `ui.walletColor.cyan` | Xanh ngọc | Turquoise | wallet-colors.ts:29 | a11y |

### `mobile/src/theme/palettes.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `ui.theme.dark` | Tối | Dark | palettes.ts:134 | Theme tile label (Preferences screen, ThemePicker) |
| `ui.theme.light` | Sáng | Light | palettes.ts:135 | |

## Formatting helpers

### `mobile/src/lib/constants.ts`

`TRANSACTION_KIND_LABELS` becomes a key lookup (`t(\`common.txType.${kind}Short\`)` for expense/income, `common.txType.transfer`).

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.txType.expenseShort` | Chi | (common) | constants.ts:116 | Type chips, pending-sync rows. Missed by the diacritic scan |
| `common.txType.incomeShort` | Thu | (common) | constants.ts:117 | Missed by the diacritic scan |
| `common.txType.transfer` | Chuyển khoản | (common) | constants.ts:118 | |

### `mobile/src/lib/format-date.ts`

Every helper here hand-builds Vietnamese-style output. Proposal: each takes the active locale (from the i18n instance, not a parameter threaded through every caller) and VI keeps today's exact output.

| Helper | VI today | EN proposal |
|---|---|---|
| `formatTime` | 24-hour "14:05" | Keep 24-hour "14:05" for v1 (open question 1) |
| `formatDateDMY`, `formatDateShort` | "29/10/2026" | `Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" })` → "Oct 29, 2026" (avoids 10/29 vs 29/10 ambiguity) |
| `formatDateRange` | "01/09 – 30/09/2026" | "Sep 1 – Sep 30, 2026" (start without year, end with year; build from two `Intl` calls, Hermes has no reliable `formatRange`) |
| `formatDateViShort` (rename `formatDateGroupHeader`) | "06 Th09, 2026" | "Sep 6, 2026" |
| `dayLabelVi` (rename `dayLabel`) | "Hôm nay" / "Hôm qua" / dd/mm/yyyy | `common.date.today` / `common.date.yesterday` / the EN date above |
| `dayLabel` (English) | unused | Delete (dead code, see "Not translated") |

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `format.date.groupHeader` | `${day} Th${month}, ${date.getFullYear()}` | (Intl) "Sep 6, 2026" | format-date.ts:78 | No locale string: VI keeps the hand-built form, EN uses `Intl`. Listed so the "Th" is not missed |
| `common.date.today` | Hôm nay | (common) | format-date.ts:86 | |
| `common.date.yesterday` | Hôm qua | (common) | format-date.ts:87 | |

### `mobile/src/lib/date-range.ts`

`previousPeriodLabel` returns a fragment that `SnapshotTopRow.tsx:34-35` splices into "Nhiều hơn {{amount}} so với {{period}}" (see [translations-home.md](./translations-home.md)). Proposal: delete this helper and give the sentence one key per period (`…_day`, `…_month`, `…_year` via i18next `context`), because EN word order and article use differ by period ("than yesterday" / "than last month"). Until then:

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `format.previousPeriod.day` | hôm qua | yesterday | date-range.ts:54 | refactor: fragment, lower case mid-sentence |
| `format.previousPeriod.year` | năm trước | last year | date-range.ts:55 | refactor: fragment |
| `format.previousPeriod.month` | tháng trước | last month | date-range.ts:56 | refactor: fragment |

### `mobile/src/lib/number-to-words-vi.ts` (amount in words)

Shown under the full figure in `AmountRevealPopup.tsx:24` and `TooltipHost.tsx:123` (long-press on a truncated amount). The digit and magnitude words are Vietnamese number grammar ("hai mươi mốt", "linh", "không trăm") and do not belong in a locale file: they stay in this VI-only speller (see "Not translated"). Proposal for EN: add `number-to-words-en.ts` (short scale: "one million five hundred thousand", "and" omitted, US style) behind one `amountInWords(amountCents, currency, language)` entry point, unit tests mirroring the VI ones. If that is not ready when EN ships, hide the words line in EN rather than show Vietnamese words under an English UI. Only the currency unit names are locale strings:

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `format.amountWords.currency.VND` | đồng | dong | number-to-words-vi.ts:92 | Unit after the spelled-out number: "one million dong" |
| `format.amountWords.currency.USD` | đô la Mỹ | US dollars | number-to-words-vi.ts:92 | Other currencies end with their ISO code in both languages |

## Errors and session (shared)

These are the app-wide network/offline/session messages. [translations-errors.md](./translations-errors.md) holds the backend `error_code` map; it links here for these keys.

### `mobile/src/lib/constants.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `errors.network` | Không thể kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại. | Can't reach the server. Check your connection and try again. | constants.ts:36 | Returned by every `getErrorMessage` caller. VI breaks the skill ("Vui lòng"); proposed VI: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." |
| `errors.needsConnection` | Cần kết nối mạng để thực hiện thao tác này. | Connect to the internet to do this. | constants.ts:37 | toast (`connectivity.ts:64`). VI "thực hiện thao tác" is WARN; proposed VI: "Cần kết nối mạng để làm việc này." |
| `errors.offlineRefresh` | Đang ngoại tuyến — chưa thể làm mới. | You're offline. Can't refresh yet. | constants.ts:38 | toast (`use-refresh.tsx:48`). VI uses "—"; proposed VI: "Đang ngoại tuyến. Chưa làm mới được." |
| `errors.offlineNoData` | Chưa có dữ liệu đã lưu cho mục này. Kết nối mạng để tải. | Nothing saved here yet. Connect to load it. | constants.ts:47 | Rendered by `OfflinePlaceholder.tsx:17` |

### `mobile/src/stores/session-store.ts`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `errors.sessionExpired` | Phiên đăng nhập đã hết hạn. | Your session expired. | session-store.ts:27 | toast when the server refuses the refresh token (glossary "Session ended": text for the current account) |

## App update

### `mobile/src/features/app-update/components/NativeUpdateDialog.tsx`

Blocking dialog when the installed APK is too old for published OTA updates. It is mounted in the root layout, so i18n must be initialised before the first render (see spec.md). The Android installer's own button ("Cài đặt" / "Install") follows the phone's language, not the app's: the hints name it by the phone's word only when both match (open question 2).

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `appUpdate.title` | Cần cài bản Budgest mới | New Budgest version needed | NativeUpdateDialog.tsx:16 | |
| `appUpdate.message` | Bản đang dùng đã cũ nên không nhận thêm cập nhật. Cài bản mới đè lên, dữ liệu và đăng nhập vẫn giữ nguyên. | This version no longer gets updates. Install the new one on top, and your data and sign-in stay as they are. | NativeUpdateDialog.tsx:17 | |
| `appUpdate.version` | `Bản ${name}` | Version {{name}} | NativeUpdateDialog.tsx:18 | `{{name}}` = version name from the server, e.g. "1.0.10" |
| `appUpdate.hint` | Tải xong, chọn Cài đặt khi máy hỏi. | Once it's downloaded, tap Install when your phone asks. | NativeUpdateDialog.tsx:19 | "Install" = Android's button |
| `appUpdate.readyHint` | Máy hỏi quyền cài ứng dụng thì bật cho Budgest. | If your phone asks to allow app installs, allow it for Budgest. | NativeUpdateDialog.tsx:22 | |
| `appUpdate.browserHint` | Tải xong, mở file vừa tải và chọn Cài đặt. | Once it's downloaded, open the file and tap Install. | NativeUpdateDialog.tsx:23 | |
| `appUpdate.download` | Tải bản mới | Download update | NativeUpdateDialog.tsx:24 | Same VI as StaleEditDialog's "Tải bản mới" (reload a transaction), different meaning: separate keys |
| `appUpdate.install` | Cài bản mới | Install update | NativeUpdateDialog.tsx:25 | |
| `appUpdate.retry` | Tải lại | Download again | NativeUpdateDialog.tsx:26 | |
| `appUpdate.browser` | Tải bằng trình duyệt | Download in browser | NativeUpdateDialog.tsx:27 | |
| `appUpdate.downloadFailed` | Chưa tải được bản mới. Kiểm tra mạng rồi thử lại. | Couldn't download the update. Check your connection and try again. | NativeUpdateDialog.tsx:28 | |
| `appUpdate.installFailed` | Chưa mở được trình cài đặt. | Couldn't open the installer. | NativeUpdateDialog.tsx:29 | |

### `mobile/src/features/app-update/components/UpdateProgress.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `appUpdate.progress` | Đang tải bản mới | Downloading update | UpdateProgress.tsx:17 | |

## Debug console

Reached from Settings → Developer → "show debug bubble". Today it is mixed: the bubble's a11y label is Vietnamese, the viewer is English only. Decision proposed: give the viewer's chrome `debug.*` keys so the screen follows the app language like everything else reachable from Settings, in the last migration batch (low priority). The log entries themselves (summaries, categories, JSON detail) and the shared log text stay English: they are diagnostic data for developers, not UI copy. Because the VI column has no Vietnamese today, the VI value proposed for `vi.json` is in Notes.

### `mobile/src/components/debug/DebugBubble.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `debug.bubble.open` | Mở debug console | Open debug console | DebugBubble.tsx:88 | a11y |

### `mobile/src/components/debug/DebugLogViewer.tsx`

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `debug.viewer.title` | Debug Console (EN only) | Debug console | DebugLogViewer.tsx:130 | vi.json: "Debug console" (developer term, kept) |
| `debug.viewer.screen` | Screen: {pathname} (EN only) | Screen: {{path}} | DebugLogViewer.tsx:132 | vi.json: "Màn hình: {{path}}" |
| `common.action.close` | Close (EN only) | (common) | DebugLogViewer.tsx:136 | |
| `debug.viewer.share` | Share (EN only) | Share | DebugLogViewer.tsx:142 | vi.json: "Chia sẻ" |
| `debug.viewer.clear` | Clear (EN only) | Clear log | DebugLogViewer.tsx:145 | vi.json: "Xóa log" |
| `debug.viewer.testAccounts` | Test accounts (EN only) | Test accounts | DebugLogViewer.tsx:153 | vi.json: "Tài khoản thử" |
| `debug.viewer.showNew` | Show {newCount} new (EN only) | one: Show {{count}} new · other: Show {{count}} new | DebugLogViewer.tsx:159 | refactor: JSX fragments "Show" + count + "new". vi.json: "Hiện {{count}} mục mới" |
| `debug.viewer.empty` | No log entries yet. (EN only) | No log entries yet. | DebugLogViewer.tsx:172 | vi.json: "Chưa có log." |

## Not translated

| Source | Text | Reason |
|---|---|---|
| TopBar.tsx:26, BrandSplash.tsx:83 | Budgest | Brand name (`common.brand`), a constant, never in locale files |
| number-to-words-vi.ts:3 | không, một, hai, ba, bốn, năm, sáu, bảy, tám, chín | VI number grammar inside the VI speller; EN gets its own speller (see "Formatting helpers") |
| number-to-words-vi.ts:9-11 | mốt, tư, lăm | VI number grammar |
| number-to-words-vi.ts:27, 29 | `${DIGIT_WORDS[hundreds]} trăm`, không trăm | VI number grammar |
| number-to-words-vi.ts:33 | `linh ${unitWord(units, 0)}` | VI number grammar (no diacritic, missed by the scan) |
| number-to-words-vi.ts:37, 40 | mười, `${DIGIT_WORDS[tens]} mươi` | VI number grammar |
| number-to-words-vi.ts:53, 56 | nghìn, triệu, tỷ, " tỷ" | VI number grammar (magnitudes) |
| number-to-words-vi.ts:68, 87 | không, `âm ${result}` | VI number grammar (zero, negative) |
| format-date.ts:64-66 | Today, Yesterday, `toLocaleDateString("en-US", …)` | `dayLabel` is unused (no caller in `src/` or `app/`); delete it |
| DebugLogViewer.tsx:32, 42, 101 | `… (${n} more chars)`, `… ${n} older entries not included`, No log entries yet. | Content of the shared log file (diagnostic data, stays English) |
| openmoji catalogue `annotation` / keywords | (English OpenMoji data) | Search data and emoji names from OpenMoji, English in both languages |
| lib/axios.ts, lib/config.ts, stores/session-store.ts, features/app-update/apk-installer.ts, lib/biometric-vault.ts | English `Error` messages and console logs ("no refresh token to refresh with", "vault not in this build", …) | Internal errors and logs, never rendered |
