# Translations: home

> Scope: `app/(app)/(tabs)/index.tsx` and what it renders (snapshot card, onboarding card, pending-sync glance, recent list), plus three components the extraction grouped here that render elsewhere: future transactions (Transactions tab) and the hold-to-open row (Insights). 56 rows. Conventions: [translations.md](./translations.md).

## Home tab: `app/(app)/(tabs)/index.tsx`

### Screen (`mobile/app/(app)/(tabs)/index.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `home.period.day` | Ngày | Day | index.tsx:53 | Period chip of the snapshot |
| `home.period.month` | Tháng | Month | index.tsx:54 | Period chip |
| `home.period.year` | Năm | Year | index.tsx:55 | Period chip |
| `home.wallets.title` | Ví | Wallets | index.tsx:207 | Section header |
| `common.count.wallets` | ví | (common) | index.tsx:208 | refactor: JSX `{wallets.data.length} ví` → `t('common.count.wallets', { count })` |
| `home.wallets.add` | Thêm ví | Add wallet | index.tsx:212 | Section action link |
| `common.empty.noWallet` | Chưa có ví. Tạo ví để ghi giao dịch. | (common) | index.tsx:222 | Empty inline card, taps open the wallet creator |
| `home.recent.title` | Giao dịch gần đây | Recent transactions | index.tsx:232 | Section header |
| `home.recent.seeAll` | Xem tất cả → | See all → | index.tsx:234 | Link. Proposal: draw the arrow as an icon and reuse `common.action.seeAll` |

### Snapshot card (`mobile/src/features/reports/components/HomeSnapshotCard.tsx`)

Ring of the period's spending, what is left, and a right column ("Sắp vượt" budgets on Day, otherwise top categories).

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.budget.spent` | Đã chi | (common) | HomeSnapshotCard.tsx:166 | Label inside the ring, above the amount |
| `home.snapshot.leftToday` | Hôm nay còn | Left today | HomeSnapshotCard.tsx:172 | Day period; label above the amount, `numberOfLines={1}` |
| `common.budget.left` | Còn lại | (common) | HomeSnapshotCard.tsx:172 | Month/year period |
| `home.snapshot.daysLeft` | Còn ${daysLeft} ngày trong tháng | one: {{count}} day left this month · other: {{count}} days left this month | HomeSnapshotCard.tsx:194 | VI: "Còn {{count}} ngày trong tháng" |
| `home.snapshot.overBudget` | Vượt ngân sách | Over budget | HomeSnapshotCard.tsx:205 | |
| `home.snapshot.withinBudget` | Trong ngân sách | Within budget | HomeSnapshotCard.tsx:205 | |
| `common.budget.nearLimit` | Sắp vượt | (common) | HomeSnapshotCard.tsx:214 | Right-column header (budgets close to their limit) |
| `home.snapshot.topSpending` | Chi nhiều nhất | Top spending | HomeSnapshotCard.tsx:235 | Right-column header; glossary: spending |
| `home.snapshot.topSpending` | Chi nhiều nhất | Top spending | HomeSnapshotCard.tsx:258 | Same header, empty variant |
| `home.snapshot.noSpending` | Chưa có khoản chi nào trong kỳ này. | No spending in this period. | HomeSnapshotCard.tsx:263 | |

### Snapshot trend and column header (`mobile/src/features/reports/components/SnapshotTopRow.tsx`, `SnapshotColumnParts.tsx`)

The trend pill is built today from `${more ? "Nhiều hơn" : "Ít hơn"} ${amount} so với ${previousPeriodLabel}`, with `previousPeriodLabel` coming from `src/lib/date-range.ts:54-56` ("hôm qua" / "tháng trước" / "năm trước"). refactor: one full sentence per period and direction, so EN word order is free; the three `date-range.ts` fragments are no longer needed for this pill.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `home.snapshot.trend.same_day` | Bằng ${previousPeriodLabel} | Same as yesterday | SnapshotTopRow.tsx:34, date-range.ts:54 | VI: "Bằng hôm qua" |
| `home.snapshot.trend.same_month` | Bằng ${previousPeriodLabel} | Same as last month | SnapshotTopRow.tsx:34, date-range.ts:56 | VI: "Bằng tháng trước" |
| `home.snapshot.trend.same_year` | Bằng ${previousPeriodLabel} | Same as last year | SnapshotTopRow.tsx:34, date-range.ts:55 | VI: "Bằng năm trước" |
| `home.snapshot.trend.more_day` | ${more ? "Nhiều hơn" : "Ít hơn"} ${formatCurrency(…)} so với ${previousPeriodLabel} | {{amount}} more than yesterday | SnapshotTopRow.tsx:35, date-range.ts:54 | VI: "Nhiều hơn {{amount}} so với hôm qua"; `{{amount}}` = formatted absolute delta |
| `home.snapshot.trend.less_day` | (same template) | {{amount}} less than yesterday | SnapshotTopRow.tsx:35, date-range.ts:54 | VI: "Ít hơn {{amount}} so với hôm qua" |
| `home.snapshot.trend.more_month` | (same template) | {{amount}} more than last month | SnapshotTopRow.tsx:35, date-range.ts:56 | VI: "Nhiều hơn {{amount}} so với tháng trước" |
| `home.snapshot.trend.less_month` | (same template) | {{amount}} less than last month | SnapshotTopRow.tsx:35, date-range.ts:56 | VI: "Ít hơn {{amount}} so với tháng trước" |
| `home.snapshot.trend.more_year` | (same template) | {{amount}} more than last year | SnapshotTopRow.tsx:35, date-range.ts:55 | VI: "Nhiều hơn {{amount}} so với năm trước" |
| `home.snapshot.trend.less_year` | (same template) | {{amount}} less than last year | SnapshotTopRow.tsx:35, date-range.ts:55 | VI: "Ít hơn {{amount}} so với năm trước" |
| `common.action.seeAll` | Xem tất cả | (common) | SnapshotColumnParts.tsx:38 | Right-column header link |

### Onboarding card (`mobile/src/features/onboarding/components/HomeOnboardingCard.tsx`)

Shown to a fresh account instead of the snapshot: three steps, only the first unfinished one is actionable.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `onboarding.title` | Biết tiền đi đâu | Know where your money goes | HomeOnboardingCard.tsx:74 | patterns.md §10 |
| `onboarding.description` | Ghi thu chi, đặt ngân sách theo danh mục. | Log income and spending. Set budgets by category. | HomeOnboardingCard.tsx:75 | |
| `onboarding.progress` | Xong {completed}/3 bước | {{done}} of {{total}} steps done | HomeOnboardingCard.tsx:79 | refactor: JSX fragments "Xong" + `{completed}` + "/3 bước" → one key. VI: "Xong {{done}}/{{total}} bước" |
| `onboarding.step.badge.active` | Cần làm | To do | HomeOnboardingCard.tsx:147 | Badge on the active step, never wraps |
| `onboarding.step.badge.done` | Xong | Done | HomeOnboardingCard.tsx:147 | Status badge (not the button `common.action.done`) |
| `onboarding.step.badge.locked` | Bước ${index + 1} | Step {{number}} | HomeOnboardingCard.tsx:147 | VI: "Bước {{number}}" |

### Onboarding steps (`mobile/src/features/onboarding/onboarding-steps.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `onboarding.steps.wallet.title` | Thêm ví | Add a wallet | onboarding-steps.ts:16 | |
| `onboarding.steps.wallet.description` | Tiền mặt, ngân hàng hoặc ví điện tử. | Cash, bank or e-wallet. | onboarding-steps.ts:17 | Glossary wallet types |
| `onboarding.steps.wallet.cta` | Thêm ví đầu tiên | Add first wallet | onboarding-steps.ts:18 | Button |
| `onboarding.steps.transaction.title` | Ghi giao dịch đầu tiên | Log your first transaction | onboarding-steps.ts:22 | |
| `onboarding.steps.transaction.description` | Ghi khoản chi gần nhất, ví dụ bữa trưa hôm nay. | Log your latest expense, like today's lunch. | onboarding-steps.ts:23 | "expense" is fine here: one specific payment (glossary) |
| `onboarding.steps.transaction.cta` | Ghi giao dịch đầu tiên | Log first transaction | onboarding-steps.ts:24 | Button, ≤ 3 words |
| `onboarding.steps.budget.title` | Tạo ngân sách | Create a budget | onboarding-steps.ts:28 | Step title; own key (the common table auto-lists this line under `common.action.createBudget`, but a title is not a button) |
| `onboarding.steps.budget.description` | Đặt hạn mức theo danh mục để biết tháng này còn chi được bao nhiêu. | Set a limit per category to see what's left to spend this month. | onboarding-steps.ts:29 | Same VI at BudgetsEmptyState.tsx:52 (insights area); share one key if both keep this text |
| `common.action.createBudget` | Tạo ngân sách | (common) | onboarding-steps.ts:30 | Button |

### Pending sync glance (`mobile/src/features/transactions/components/HomePendingSyncSection.tsx`)

Transactions saved offline and not yet accepted by the server; newest three, then a link to the Transactions tab.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.status.pendingSync` | Chờ đồng bộ | (common) | HomePendingSyncSection.tsx:19 | Section title |
| `common.action.seeAll` | Xem tất cả | (common) | HomePendingSyncSection.tsx:64 | |
| `home.pendingSync.more` | +{hiddenCount} giao dịch khác chờ đồng bộ | one: +{{count}} more transaction waiting to sync · other: +{{count}} more transactions waiting to sync | HomePendingSyncSection.tsx:83 | VI: "+{{count}} giao dịch khác chờ đồng bộ" |

### Recent transactions empty (`mobile/src/features/transactions/components/HomeRecentEmpty.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `home.recent.empty` | Chưa có giao dịch. | No transactions yet. | HomeRecentEmpty.tsx:34 | patterns.md §3 |

## Transactions tab: upcoming transactions

Rendered by `app/(app)/(tabs)/transactions.tsx` (grouped here by the extraction). Transactions dated after today, kept out of the main list.

### Card (`mobile/src/features/transactions/components/FutureTransactionsCard.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.future.count` | {transactions.length} giao dịch sắp tới | one: {{count}} upcoming transaction · other: {{count}} upcoming transactions | FutureTransactionsCard.tsx:30 | VI: "{{count}} giao dịch sắp tới" |
| `transactions.future.next` | Gần nhất: {formatDateViShort(…)} · {next.category_name} | Next: {{date}} · {{category}} | FutureTransactionsCard.tsx:32 | VI: "Gần nhất: {{date}} · {{category}}". `{{date}}` from the locale-aware short date formatter, not `formatDateViShort` |

### Dialog (`mobile/src/features/transactions/components/FutureTransactionsDialog.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `transactions.future.title` | Giao dịch sắp tới | Upcoming transactions | FutureTransactionsDialog.tsx:54 | Drawer title |
| `common.action.close` | Đóng | (common) | FutureTransactionsDialog.tsx:54 | |
| `transactions.future.note` | Những khoản này có ngày ở tương lai nên chưa nằm trong danh sách chính. Chạm để sửa lại ngày. | These are dated in the future, so they're not in the main list yet. Tap one to change its date. | FutureTransactionsDialog.tsx:57 | |
| `transactions.future.empty` | Không có giao dịch nào sắp tới. | No upcoming transactions. | FutureTransactionsDialog.tsx:61 | |

## Insights: hold-to-open transaction row

### Row (`mobile/src/features/reports/components/HoldableTransactionRow.tsx`)

Rendered by `CategoryTransactionsDialog.tsx` (Insights). Holding a row reveals a link into the Transactions tab.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `reports.holdRow.hint` | Giữ một giây để mở trong Giao dịch | Hold for a second to open in Transactions | HoldableTransactionRow.tsx:105 | a11y hint. "Transactions" = the tab name (`nav.tab.transactions`) |
| `reports.holdRow.show` | Xem trong Giao dịch | View in Transactions | HoldableTransactionRow.tsx:124 | Tooltip button |

## Not translated

| Source | Text | Reason |
|---|---|---|
| HomeSnapshotCard.tsx:187, :190 | — | "No figure" glyph when there is no budget, not copy. Same glyph in both languages (consider "–" to keep the skill's no-em-dash rule) |
| FutureTransactionsCard.tsx:35 | › | Chevron glyph |
| FutureTransactionsDialog.tsx:44 | `${dayLabelVi(…)} · ${formatDateViShort(…)}` | Day-group label built only from the date helpers; becomes locale-aware through the shared `format.*` / date helper work (translations-shared.md), no own key |
| date-range.ts:54-56 | hôm qua / năm trước / tháng trước | Fragments used by the trend pill above; replaced by `home.snapshot.trend.*`. Listed in translations-shared.md under `lib/` if used elsewhere |
