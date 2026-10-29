# Translations: Insights tab (spending, budgets) and analytics answers

> Scope: `app/(app)/(tabs)/insights.tsx`, `src/features/reports` (Insights parts; the Home snapshot is in [translations-home.md](./translations-home.md)), `src/features/budgets`, `src/features/analytics` (the analysis-mode answers rendered inside the Assistant tab). 109 rows. Conventions and `common.*` keys: [translations.md](./translations.md).

Terms used here that are not yet in `glossary.md` (add before adoption): **hạn mức** = limit (a budget's monthly cap), **khoản chi** = expense (one specific spending item, allowed by the glossary's "expense" note), **mức thường** = usual (already in glossary), **chu kỳ** = cycle.

## Insights screen: route `app/(app)/(tabs)/insights.tsx`

### Screen (`mobile/app/(app)/(tabs)/insights.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `insights.tab.spending` | Chi tiêu | Spending | insights.tsx:23 | Sub-tab label. Tab keys `Spending`/`Budgets` stay English in code (deep links). |
| `insights.tab.budgets` | Ngân sách | Budgets | insights.tsx:24 | Sub-tab label |
| `insights.title` | Phân tích | Insights | insights.tsx:70 | Screen title; same word as `nav.tab.insights`, separate key (title vs tab). Glossary open decision #3 applies. |

## Insights: Spending sub-tab

### Spending tab (`mobile/src/features/reports/components/SpendingTab.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `reports.spending.loadError` | Chưa tải được báo cáo. | Couldn't load the report. | SpendingTab.tsx:95 | Paired with retry link |
| `common.action.retry` | Thử lại | (common) | SpendingTab.tsx:97 | |
| `common.txType.income` | Thu nhập | (common) | SpendingTab.tsx:139 | Stat card label |
| `common.txType.expense` | Chi tiêu | (common) | SpendingTab.tsx:149 | Stat card label |
| `reports.spending.proratedHintOneDay` | Hạn mức tháng đã chia theo / ngày / bạn chọn. | Monthly limit prorated to the day you picked. | SpendingTab.tsx:175 | refactor: sentence built from three JSX fragments + ternary; one key for the single-day case (VI has no `_one`, so a separate key, chosen in the component) |
| `reports.spending.proratedHint` | Hạn mức tháng đã chia theo / `${rangeDayCount} ngày` / bạn chọn. | one: Monthly limit prorated to the {{count}} day you picked. · other: Monthly limit prorated to the {{count}} days you picked. | SpendingTab.tsx:175 | refactor: same fragments. VI: "Hạn mức tháng đã chia theo {{count}} ngày bạn chọn." |
| `reports.spending.byCategory` | Theo danh mục | By category | SpendingTab.tsx:181 | Legend heading |

### Spending empty state (`mobile/src/features/reports/components/SpendingEmptyState.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `reports.spending.empty.title` | Chưa có khoản chi | No spending yet | SpendingEmptyState.tsx:28 | |
| `reports.spending.empty.body` | Ghi giao dịch để xem tiền đi đâu theo danh mục. | Log transactions to see where your money goes. | SpendingEmptyState.tsx:29 | "by category" cut: the screen shows it |
| `common.action.createWallet` | Tạo ví | (common) | SpendingEmptyState.tsx:33 | |
| `common.action.addTransaction` | Thêm giao dịch | (common) | SpendingEmptyState.tsx:38 | |
| `reports.spending.tip.eyebrow` | Mẹo | Tip | SpendingEmptyState.tsx:52 | |
| `reports.spending.tip.body` | Đặt ngân sách cho từng danh mục để biết mỗi ngày còn được chi bao nhiêu. | Set a budget per category to see what you can spend each day. | SpendingEmptyState.tsx:53 | |

### Category transactions sheet (`mobile/src/features/reports/components/CategoryTransactionsDialog.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `reports.categorySheet.title` | Giao dịch | Transactions | CategoryTransactionsDialog.tsx:116 | Sheet title |
| `common.action.close` | Đóng | (common) | CategoryTransactionsDialog.tsx:116 | |
| `reports.categorySheet.empty` | Không có giao dịch nào trong khoảng thời gian này. | No transactions in this period. | CategoryTransactionsDialog.tsx:145 | |
| `reports.categorySheet.loadMore` | Tải thêm | Load more | CategoryTransactionsDialog.tsx:174 | |

## Insights: Budgets sub-tab

### Budgets tab (`mobile/src/features/budgets/components/BudgetsTab.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.date.thisMonth` | Tháng này | (common) | BudgetsTab.tsx:175 | Range row label when no range is picked |
| `budgets.list.emptyCurrency` | `Chưa có ngân sách bằng ${currency}.` | No budgets in {{currency}} yet. | BudgetsTab.tsx:209 | `{{currency}}` is the ISO code |
| `budgets.list.emptyFilter` | Không có ngân sách nào trong nhóm này. | No budgets match this filter. | BudgetsTab.tsx:209 | |

### Range row (`mobile/src/features/budgets/components/BudgetRangeRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.clearFilters` | Xóa bộ lọc | (common) | BudgetRangeRow.tsx:26 | |

### Month summary card (`mobile/src/features/budgets/components/BudgetMonthSummary.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgets.summary.daysLeft` | còn / ngày | one: {{count}} day left · other: {{count}} days left | BudgetMonthSummary.tsx:53 | refactor: `còn {pace.daysLeft} ngày`, two fragments. VI: "còn {{count}} ngày" |
| `budgets.summary.overLimit` | vượt hạn mức | over the {{limit}} limit | BudgetMonthSummary.tsx:71 | refactor: suffix after the big amount, limit in a nested `<Text>`; use `<Trans>` with `<0>{{limit}}</0>`. VI: "vượt hạn mức <0>{{limit}}</0>" |
| `budgets.summary.leftOfLimit` | còn lại trong hạn mức | left of the {{limit}} limit | BudgetMonthSummary.tsx:71 | refactor: same structure. VI: "còn lại trong hạn mức <0>{{limit}}</0>" |
| `budgets.summary.someOver` | danh mục đã vượt hạn mức. Tổng vẫn còn nhờ các mục khác. | one: {{count}} category is over its limit. The total still has room from the others. · other: {{count}} categories are over their limits. The total still has room from the others. | BudgetMonthSummary.tsx:80 | refactor: `{overCount}` + text. VI: "{{count}} danh mục đã vượt hạn mức. Tổng vẫn còn nhờ các mục khác." |

### Filter chips (`mobile/src/features/budgets/components/BudgetFilterChips.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.label.all` | Tất cả | (common) | BudgetFilterChips.tsx:20 | |
| `common.budget.nearLimit` | Sắp vượt | (common) | BudgetFilterChips.tsx:21 | |
| `budgets.filter.over` | Đã vượt | Over limit | BudgetFilterChips.tsx:22 | Chip; differs from `common.budget.over` ("Vượt", a figure label) |

### Budget row (`mobile/src/features/budgets/components/BudgetListRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgets.row.over` | Vượt | {{percent}} · {{amount}} over | BudgetListRow.tsx:108 | refactor: `{percent} · {Vượt\|Còn} {amount}` built inline; one key per branch. VI: "{{percent}} · Vượt {{amount}}" |
| `budgets.row.left` | Còn | {{percent}} · {{amount}} left | BudgetListRow.tsx:108 | refactor: as above. VI: "{{percent}} · Còn {{amount}}" |
| `budgets.row.limit` | Hạn mức: | Limit: {{amount}} | BudgetListRow.tsx:111 | refactor: label + compact amount. VI: "Hạn mức: {{amount}}" |
| `budgets.row.seeTransactions` | Xem giao dịch → | See transactions → | BudgetListRow.tsx:118 | Link |

### Budget figures (`mobile/src/features/budgets/components/BudgetFigures.tsx`)

Also rendered in the budget form and the category transactions sheet.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgets.figures.usedShare` | Đã dùng / hạn mức | {{percent}} of limit used | BudgetFigures.tsx:39 | refactor: `Đã dùng {formatPercent(…)} hạn mức`. VI: "Đã dùng {{percent}} hạn mức" |
| `common.budget.spent` | Đã chi | (common) | BudgetFigures.tsx:44 | |
| `budgets.figures.limit` | Hạn mức | Limit | BudgetFigures.tsx:45 | |
| `common.budget.over` | Vượt | (common) | BudgetFigures.tsx:47 | |
| `common.budget.left` | Còn lại | (common) | BudgetFigures.tsx:47 | |

### Empty state (`mobile/src/features/budgets/components/BudgetsEmptyState.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgets.empty.title` | Chưa có ngân sách | No budgets yet | BudgetsEmptyState.tsx:51 | |
| `budgets.empty.body` | Đặt hạn mức theo danh mục để biết tháng này còn chi được bao nhiêu. | Set a limit per category to see what's left to spend this month. | BudgetsEmptyState.tsx:52 | Same sentence in `onboarding-steps.ts:29` (translations-home.md): reuse this key there |
| `common.action.createBudget` | Tạo ngân sách | (common) | BudgetsEmptyState.tsx:54 | |
| `budgets.empty.suggestions` | Gợi ý danh mục phổ biến | Popular categories | BudgetsEmptyState.tsx:65 | Section header (rendered uppercase) |
| `budgets.empty.savingsHint` | Đề xuất 15–20% thu nhập | Suggested: 15–20% of income | BudgetsEmptyState.tsx:92 | En dash is a range, allowed |
| `budgets.empty.typicalAmount` | `Mức tiêu chuẩn ~ ${formatCurrency(amountCents, currency)}` | Typical: ~{{amount}} | BudgetsEmptyState.tsx:94 | |
| `budgets.empty.setOwn` | Tự đặt hạn mức | Set your own limit | BudgetsEmptyState.tsx:95 | |

### Add button (`mobile/src/features/budgets/components/BudgetsFab.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgets.fab.wizard` | AI gợi ý | Suggest with AI | BudgetsFab.tsx:26 | Opens the budget wizard |
| `budgets.fab.manual` | Thủ công | Add manually | BudgetsFab.tsx:28 | |
| `budgets.fab.a11y` | Thêm ngân sách | Add budget | BudgetsFab.tsx:32 | a11y |

### Budget form sheet (`mobile/src/features/budgets/components/BudgetFormModal.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.validation.chooseCategory` | Vui lòng chọn danh mục | (common) | BudgetFormModal.tsx:99 | VI breaks the skill ("Vui lòng"); see common table |
| `budgets.form.amountInvalid` | Vui lòng nhập hạn mức hợp lệ | Enter a limit above 0. | BudgetFormModal.tsx:100 | VI breaks the skill ("Vui lòng", vague "hợp lệ"); proposed VI: "Nhập hạn mức lớn hơn 0." |
| `common.action.cancel` | Hủy | (common) | BudgetFormModal.tsx:140 | |
| `common.action.save` | Lưu | (common) | BudgetFormModal.tsx:142 | Edit mode |
| `common.action.create` | Tạo | (common) | BudgetFormModal.tsx:142 | Create mode |
| `budgets.form.titleEdit` | Sửa ngân sách | Edit budget | BudgetFormModal.tsx:151 | |
| `budgets.form.titleNew` | Ngân sách mới | New budget | BudgetFormModal.tsx:151 | |
| `common.field.category` | Danh mục | (common) | BudgetFormModal.tsx:153 | Create mode label |
| `budgets.form.categoryLocked` | Danh mục + " (khóa sau khi tạo)" | Category (locked after creation) | BudgetFormModal.tsx:153 | refactor: label + suffix concatenated; one key for the edit-mode label. Same suffix in category and transaction forms (other area files) |
| `common.date.thisMonth` | Tháng này | (common) | BudgetFormModal.tsx:177 | Period label on the figures |
| `budgets.form.iconHint` | Ngân sách dùng luôn biểu tượng của danh mục này. | The budget uses this category's icon. | BudgetFormModal.tsx:182 | |
| `budgets.form.limitLabel` | `Hạn mức hàng tháng (` + currency + `)` | Monthly limit ({{currency}}) | BudgetFormModal.tsx:185 | refactor: JSX text + `{currency}`. VI: "Hạn mức hàng tháng ({{currency}})" |
| `budgets.form.saveError` | Không thể lưu ngân sách | Couldn't save the budget. | BudgetFormModal.tsx:190 | `getErrorMessage` fallback; known `error_code`s map per translations-errors.md. Proposed VI: "Chưa lưu được ngân sách." |
| `budgets.form.delete` | Xóa ngân sách | Delete budget | BudgetFormModal.tsx:196 | Destructive row |
| `budgets.delete.title` | Xóa ngân sách? | Delete this budget? | BudgetFormModal.tsx:203 | |
| `common.confirm.cannotUndo` | Hành động này không thể hoàn tác. | (common) | BudgetFormModal.tsx:204 | ConfirmDialog falls back to "Xóa" / "Hủy"; per the skill pass `budgets.form.delete` + `common.action.keep` |

### Budget limit toast (`mobile/src/features/budgets/budget-limit-alert.ts`)

Shown as a toast after an expense is saved from any screen.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgets.alert.over` | `Đã vượt hạn mức ngân sách "${budget.category_name}": ${spentLabel}/${limitLabel}.` | Over the {{category}} budget: {{spent}} of {{limit}} | budget-limit-alert.ts:34 | toast; no period on a toast (proposed VI drops it too) |
| `budgets.alert.near` | `Sắp đạt hạn mức ngân sách "${budget.category_name}": ${spentLabel}/${limitLabel}.` | {{category}} budget almost used: {{spent}} of {{limit}} | budget-limit-alert.ts:40 | toast |

## Analytics answers: Assistant tab, analysis mode (`app/(app)/(tabs)/ai-chat.tsx`)

The reply sentence above each card, notices (`answer.notices[].message`), period labels (`compare.previous_label`, `anomaly.baseline_label`), chart axis labels and follow-up chips are rendered by the backend; see "Text from the server" below.

### Starter chips (`mobile/src/features/analytics/starter-chips.ts`)

User-voice chips (patterns §2: written as the user would ask).

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.starter.spentThisMonth` | Tháng này tiêu bao nhiêu? | How much did I spend this month? | starter-chips.ts:11 | Backend `starterChips()` (consult_routing.go) sends the same set on fallback replies; both must change together |
| `analytics.starter.whereMoneyWent` | Tiền đi đâu? | Where did my money go? | starter-chips.ts:12 | |
| `analytics.starter.budgetLeft` | Còn bao nhiêu ngân sách? | How much budget is left? | starter-chips.ts:13 | |
| `analytics.starter.incomeThisMonth` | Thu nhập tháng này | Income this month | starter-chips.ts:14 | |
| `analytics.starter.unusualToday` | Hôm nay có gì bất thường? | Anything unusual today? | starter-chips.ts:24 | Glossary "unusual" |

### Reply card (`mobile/src/features/analytics/components/ConsultReplyCard.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.period.toDate` | " (đến hôm nay)" | {{range}} (to date) | ConsultReplyCard.tsx:30 | refactor: suffix appended to a hand-built "dd/mm – dd/mm"; build the range with the shared date formatter and pass it as `{{range}}`. VI: "{{range}} (đến hôm nay)" |
| `analytics.period.soFar` | " (đến giờ)" | {{range}} (so far) | ConsultReplyCard.tsx:33 | refactor: as above, single day that is today. VI: "{{range}} (đến giờ)" |
| `analytics.answer.periodLine` | `{periodText(answer.period)} · {answer.tx_count} giao dịch` | one: {{period}} · {{count}} transaction · other: {{period}} · {{count}} transactions | ConsultReplyCard.tsx:63 | refactor: JSX fragments. VI: "{{period}} · {{count}} giao dịch" |
| `analytics.answer.switchToRecording` | Chuyển sang Ghi giao dịch | Switch to {{mode}} | ConsultReplyCard.tsx:89 | `{{mode}}` = the recording mode's label from translations-ai-chat.md (`chat-mode.ts` "Ghi giao dịch"), so the two never drift. VI: "Chuyển sang {{mode}}" |

### Category banner (`mobile/src/features/analytics/components/CategoryBanner.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.banner.countingFor` | Đang tính cho: | Counting: {{categories}} | CategoryBanner.tsx:23 | refactor: label + nested `<Text>` of names; `<Trans>` with `<0>{{categories}}</0>`. Names joined with the locale's list format (`Intl.ListFormat` if available, else ", ") |
| `analytics.banner.change` | Đổi | Change | CategoryBanner.tsx:26 | Text link |

### Chart renderer (`mobile/src/features/analytics/components/ChartRenderer.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.number.avgCaption` | `trung bình trên ${chart.days} ngày có chi tiêu` | one: average over {{count}} day with spending · other: average over {{count}} days with spending | ChartRenderer.tsx:44 | Caption under a single figure (lower case on purpose) |

### Column bars (`mobile/src/features/analytics/components/ColumnBars.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.columns.hint` | Chạm vào cột để xem từng mốc. | Tap a bar to see its amount. | ColumnBars.tsx:108 | Shown until the first tap. Column labels come from the server |

### Compare bars (`mobile/src/features/analytics/components/CompareBars.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.compare.same` | `Không đổi so với ${previousLabel}` | Same as {{previous}} | CompareBars.tsx:21 | `{{previous}}` is server text (e.g. "T8/26") |
| `analytics.compare.up` | `${pct > 0 ? "Tăng" : "Giảm"} ${Math.abs(pct)}% so với ${previousLabel}` | Up {{percent}} from {{previous}} | CompareBars.tsx:22 | refactor: ternary inside the sentence; one key per direction. `{{percent}}` formatted ("12%"). VI: "Tăng {{percent}} so với {{previous}}" |
| `analytics.compare.down` | (same line) | Down {{percent}} from {{previous}} | CompareBars.tsx:22 | VI: "Giảm {{percent}} so với {{previous}}" |

### Donut legend (`mobile/src/features/analytics/components/DonutLegend.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.legend.hide` | Ẩn danh mục | Hide categories | DonutLegend.tsx:41 | Button text and a11y label |
| `analytics.legend.show` | `Xem ${count} danh mục` | one: Show {{count}} category · other: Show {{count}} categories | DonutLegend.tsx:41 | Button text and a11y label |

### Inline transactions (`mobile/src/features/analytics/components/InlineTransactions.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.inline.heading` | Giao dịch | Transactions | InlineTransactions.tsx:21 | Section heading |

### Line chart (`mobile/src/features/analytics/components/LineChart.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.line.peak` | Cao nhất: | Peak: {{amount}} ({{label}}) | LineChart.tsx:72 | refactor: `Cao nhất: {amount} ({peak.label})`. `{{label}}` is a server point label. VI: "Cao nhất: {{amount}} ({{label}})" |

### Ranked list (`mobile/src/features/analytics/components/RankedList.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.ranked.collapse` | Thu gọn | Show less | RankedList.tsx:91 | |
| `analytics.ranked.showMore` | `Xem thêm ${moreRows.length} khoản` | Show {{count}} more | RankedList.tsx:91 | VI: "Xem thêm {{count}} khoản" |
| `analytics.ranked.notShownExpanded` | `Còn ${notShown} khoản nhỏ hơn — xem đủ ở tab Giao dịch.` | one: {{count}} smaller one not shown. See all in Transactions. · other: {{count}} smaller ones not shown. See all in Transactions. | RankedList.tsx:100 | VI breaks the skill (em dash); proposed VI: "Còn {{count}} khoản nhỏ hơn. Xem đủ ở tab Giao dịch." |
| `analytics.ranked.notShownCollapsed` | `và ${notShown} khoản khác` | and {{count}} more | RankedList.tsx:100 | VI: "và {{count}} khoản khác" |

### Budget status answer (`mobile/src/features/analytics/components/BudgetStatusList.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.budgetStatus.over` | Vượt | Over by {{amount}} | BudgetStatusList.tsx:80 | refactor: "Vượt" + `<AmountText>`; `<Trans>` with `<0/>` for the amount. VI: "Vượt <0/>" |
| `analytics.budgetStatus.unused` | `Chưa chi · Hạn mức ${formatCurrency(b.limit, currency)}` | Nothing spent · Limit {{limit}} | BudgetStatusList.tsx:96 | |
| `analytics.budgetStatus.spent` | `Đã chi ${formatCurrency(b.spent, currency)} / ${formatCurrency(b.limit, currency)}` | Spent {{spent}} of {{limit}} | BudgetStatusList.tsx:97 | |

### Anomaly answer (`mobile/src/features/analytics/components/AnomalyAnswer.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.anomaly.count` | `${anomaly.count} khoản chi` | one: {{count}} expense · other: {{count}} expenses | AnomalyAnswer.tsx:36 | Caption under the total. "expense" = one specific item (glossary) |
| `analytics.anomaly.countVsUsual` | `{anomaly.count}` khoản chi, thường `{anomaly.typical_count}` khoản | one: {{count}} expense, usually {{usual}} · other: {{count}} expenses, usually {{usual}} | AnomalyAnswer.tsx:40 | refactor: two JSX fragments around two numbers. VI: "{{count}} khoản chi, thường {{usual}} khoản" |
| `analytics.anomaly.aboveUsual` | Cao hơn mức thường | Above usual | AnomalyAnswer.tsx:45 | Section title; glossary "usual" |
| `analytics.anomaly.largeExpenses` | Khoản chi lớn | Large expenses | AnomalyAnswer.tsx:52 | Section title |
| `analytics.anomaly.largeIncome` | Khoản thu lớn | Large income | AnomalyAnswer.tsx:57 | Section title |
| `analytics.anomaly.usualAmount` | `Thường ${formatCurrency(item.typical, currency)}` | Usually {{amount}} | AnomalyAnswer.tsx:86 | |
| `analytics.anomaly.noneInBaseline` | `Không có trong ${baseline}` | None in {{baseline}} | AnomalyAnswer.tsx:86 | `{{baseline}}` is server text ("8 tuần trước đó"); needs the server's EN label |

### Savings scenario (`mobile/src/features/analytics/components/ScenarioPlan.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `analytics.scenario.caption` | để dành mỗi tháng · / tháng | one: to set aside each month · {{count}} month · other: to set aside each month · {{count}} months | ScenarioPlan.tsx:28 | refactor: `để dành mỗi tháng · {months} tháng`. VI: "để dành mỗi tháng · {{count}} tháng" |
| `analytics.scenario.captionDeadline` | `" · đến ${longDate(scenario.deadline)}"` | one: to set aside each month · {{count}} month · by {{date}} · other: to set aside each month · {{count}} months · by {{date}} | ScenarioPlan.tsx:29 | refactor: optional suffix → separate full key. `longDate` hand-builds dd/mm/yyyy: use the shared formatter. VI: "để dành mỗi tháng · {{count}} tháng · đến {{date}}" |
| `analytics.scenario.goal` | Mục tiêu | Goal | ScenarioPlan.tsx:33 | Row label |
| `analytics.scenario.avgIncome` | Thu TB/tháng | Avg income/month | ScenarioPlan.tsx:34 | Row label |
| `analytics.scenario.avgSpending` | Chi TB/tháng | Avg spending/month | ScenarioPlan.tsx:35 | Row label; glossary "spending" |
| `analytics.scenario.spendCap` | Chi tối đa/tháng | Max spending/month | ScenarioPlan.tsx:37 | Row label |
| `analytics.scenario.cutNeeded` | Cần giảm/tháng | Cut needed/month | ScenarioPlan.tsx:39 | Row label |

## Text from the server on these screens

Not in the client today, so not keyed here. They stay Vietnamese in an English UI until the backend localises them (spec.md, backend-originated strings):

- Analysis reply sentence, `answer.notices[].message`, `compare.previous_label` ("T8/26"), `anomaly.baseline_label`, chart column/point labels, follow-up chip labels, category-choice names: `backend/internal/service/consult_*.go`, `analytics_*template.go`.
- Error messages behind `getErrorMessage(…)` in `BudgetFormModal.tsx:190` (budget create/update/delete): map by `error_code` (`BUDGET_ALREADY_EXISTS`, `INVALID_CATEGORY_TYPE`, `CATEGORY_IN_USE`, ...) per translations-errors.md.
- Category names on rows, legend and toasts: system categories translate via `system_key`, user categories never (translations-errors.md, seed data).

## Not translated

| Source | VI | Reason |
|---|---|---|
| budget-pace.ts:26 | `Tháng ${now.getMonth() + 1}` | `MonthPace.label` is never rendered (BudgetsTab passes the pace to BudgetMonthSummary, which reads only `elapsed`/`daysLeft`). Drop the field; if it returns, use `Intl.DateTimeFormat(locale, { month: "long" })`, not a key |
| budget-pace.ts:103 | đã vượt | `BudgetRowStatus.caption` is never rendered (no caller reads `status.caption`). Drop on migration; if revived: `budgets.pace.over` "over" |
| budget-pace.ts:106 | chưa dùng | Same dead field; if revived: "unused" |
| budget-pace.ts:114 | nhanh hơn dự kiến | Same dead field; if revived: "ahead of pace" |
| budget-pace.ts:119 | đúng tiến độ | Same dead field; if revived: "on track" |
| BudgetMonthSummary.tsx:30 | tháng | Default of the `periodNoun` prop, which the component never renders. Drop the prop |
| BudgetsTab.tsx:196 | ngày / khoảng này / tháng | Values passed to the unused `periodNoun` prop. Drop with it |
