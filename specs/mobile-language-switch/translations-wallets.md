# Translations: wallets and shared wallets

Scope: `app/(app)/wallets.tsx`, `app/(app)/shared-wallets.tsx` and `src/features/wallets/` (cards, carousel, list, wallet form, sheet, members, invitations, shared activity). 172 rows (169 extracted strings plus 3 composed a11y labels the extractor could not see), 7 not-translated entries. Conventions and `(common)` keys: [translations.md](./translations.md).

Key namespaces: `wallets.*` (a wallet and the Wallets screen), `sharedWallets.*` (sharing, members, invitations, shared activity). Role labels (`sharedWallets.role.*`) are passed as `{{role}}` values into other keys; they are translated before interpolation.

## Wallets screen

Route `app/(app)/wallets.tsx`, opened from Settings → "Ví của bạn" and from Home's wallet cards. Three tabs: card carousel, list grouped by type, shared wallets.

### Screen (`mobile/app/(app)/wallets.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.title.wallets` | Ví | (common) | wallets.tsx:154 | Screen title |
| `wallets.view.carousel` | Dạng thẻ | Cards | wallets.tsx:38 | Segmented tab, 1-2 words |
| `wallets.view.list` | Theo nhóm | By type | wallets.tsx:39 | Segmented tab: the list is grouped by wallet type |
| `wallets.view.shared` | Ví chung | Shared | wallets.tsx:40 | Segmented tab. Every "tab Ví chung" reference in EN says "Shared tab" |
| `sharedWallets.action.share` | Chia sẻ một ví | Share a wallet | wallets.tsx:253 | a11y of the Fab on the Shared tab. Same key as the empty-state button (SharedWalletsView.tsx:95) |
| `common.action.createWallet` | Tạo ví | (common) | wallets.tsx:257 | a11y of the Fab |

### Empty state (`mobile/src/features/wallets/components/WalletsEmptyState.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `wallets.empty.title` | Chưa có ví nào | No wallets yet | WalletsEmptyState.tsx:27 | |
| `wallets.empty.body` | Tiền mặt, tài khoản ngân hàng hay ví điện tử — mỗi nguồn tiền là một ví, và mọi giao dịch đều được ghi vào một ví. | Each place you keep money is a wallet: cash, bank or e-wallet. | WalletsEmptyState.tsx:28 | VI breaks the skill: "—", "nguồn tiền" for a wallet (glossary, open decision #1), "tài khoản" near a wallet, explains what the next screen shows. Proposed VI: "Mỗi nơi giữ tiền là một ví: tiền mặt, ngân hàng hay ví điện tử." |
| `wallets.empty.cta` | Tạo ví đầu tiên | Create a wallet | WalletsEmptyState.tsx:30 | Button, ≤ 3 words |

### Grouped list (`mobile/src/features/wallets/components/WalletsGroupedList.tsx`)

Section headers, one per wallet type.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.walletType.cash` | Tiền mặt | (common) | WalletsGroupedList.tsx:12 | |
| `common.walletType.bank` | Ngân hàng | (common) | WalletsGroupedList.tsx:13 | |
| `common.walletType.e_wallet` | Ví điện tử | (common) | WalletsGroupedList.tsx:14 | |
| `common.walletType.other` | Khác | (common) | WalletsGroupedList.tsx:15 | |

### List row (`mobile/src/features/wallets/components/WalletListItem.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.walletType.cash` | Tiền mặt | (common) | WalletListItem.tsx:18 | |
| `common.walletType.bank` | Ngân hàng | (common) | WalletListItem.tsx:19 | |
| `common.walletType.e_wallet` | Ví điện tử | (common) | WalletListItem.tsx:20 | |
| `common.walletType.other` | Khác | (common) | WalletListItem.tsx:21 | |
| `wallets.owner.sharedBy` | Ví chung của ${wallet.owner_name ?? "người khác"} | Shared by {{owner}} | WalletListItem.tsx:51 | VI "Ví chung của {{owner}}" (glossary). A missing owner name passes `wallets.owner.unknown` as `{{owner}}`. Same key: WalletStackCard.tsx:51 |
| `wallets.owner.unknown` | người khác | someone else | WalletListItem.tsx:51 | Lowercase; only ever a `{{owner}}` value. Also WalletSheetHero.tsx:28, SharedWalletCard.tsx:36, SharedActivityHeader.tsx:60 |
| `common.label.sharedWallet` | " · Ví chung" | (common) | WalletListItem.tsx:52 | refactor: subtitle is built as `${kind}${shared} · ${amount}${pending}`. Build an array of parts (type or owner, shared tag, amount, pending) and join with " · "; each part is its own key, the separator is not translated |
| `wallets.list.pendingSync` | " · ${pendingCount} chưa đồng bộ" | one: {{count}} not synced · other: {{count}} not synced | WalletListItem.tsx:53 | VI "{{count}} chưa đồng bộ". Part of the subtitle (see the row above) |
| `common.label.default` | Mặc định | (common) | WalletListItem.tsx:60 | Trailing value on the default wallet |
| `common.action.setDefault` | Đặt mặc định | (common) | WalletListItem.tsx:68 | Inline button |
| `wallets.setDefault.confirm.title` | Đặt ví mặc định? | Set default wallet? | WalletListItem.tsx:85 | Same dialog in WalletActiveActions.tsx:100 |
| `wallets.setDefault.confirm.body` | "${wallet.name}" sẽ trở thành ví mặc định của bạn. | "{{wallet}}" becomes your default wallet. | WalletListItem.tsx:86 | VI "\"{{wallet}}\" sẽ trở thành ví mặc định của bạn." Same in WalletActiveActions.tsx:101 |
| `common.action.setDefault` | Đặt mặc định | (common) | WalletListItem.tsx:87 | Confirm button. The card view's copy of this dialog says "Lưu" (WalletActiveActions.tsx:102); proposal: both use this key |

## Wallet card, carousel and sheet

Shared by Home and the Wallets screen's card tab.

### Stack card (`mobile/src/features/wallets/components/WalletStackCard.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.walletType.cash` | Tiền mặt | (common) | WalletStackCard.tsx:28 | |
| `common.walletType.bank` | Ngân hàng | (common) | WalletStackCard.tsx:29 | |
| `common.walletType.e_wallet` | Ví điện tử | (common) | WalletStackCard.tsx:30 | |
| `common.walletType.other` | Khác | (common) | WalletStackCard.tsx:31 | |
| `wallets.card.balance.onHand` | Số dư hiện có | Current balance | WalletStackCard.tsx:37 | Cash and Other wallets. Also line 40 |
| `wallets.card.balance.available` | Số dư khả dụng | Available balance | WalletStackCard.tsx:38 | Bank and e-wallet. Also line 39 |
| `wallets.card.balance.available` | Số dư khả dụng | (same key) | WalletStackCard.tsx:39 | |
| `wallets.card.balance.onHand` | Số dư hiện có | (same key) | WalletStackCard.tsx:40 | |
| `wallets.owner.sharedBy` | Ví chung của ${wallet.owner_name} | Shared by {{owner}} | WalletStackCard.tsx:51 | Same key as WalletListItem.tsx:51 |
| `common.label.sharedWallet` | Ví chung | (common) | WalletStackCard.tsx:51 | Shared wallet with no owner name |
| `wallets.card.typeShared` | ${TYPE_LABEL[wallet.type]} · Ví chung | {{type}} · Shared wallet | WalletStackCard.tsx:52 | VI "{{type}} · Ví chung" (glossary). `{{type}}` = translated `common.walletType.*` |
| `wallets.card.a11y` | ${wallet.name}, ${formatCurrency(wallet.balance, wallet.currency)} | {{wallet}}, {{amount}} | WalletStackCard.tsx:131 | a11y. Not in the raw dump (no VI letters); listed so the order is a locale decision. Same key: WalletCarousel.tsx:240 |

### Pending balance hint (`mobile/src/features/wallets/components/PendingBalanceHint.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `wallets.card.pendingNotCounted` | Chưa tính {count} giao dịch chờ đồng bộ | one: Excludes {{count}} unsynced transaction · other: Excludes {{count}} unsynced transactions | PendingBalanceHint.tsx:31 | VI "Chưa tính {{count}} giao dịch chờ đồng bộ". refactor: JSX text "Chưa tính" + `{count}` + "giao dịch chờ đồng bộ" (two raw fragments) → one key. One line on the card: keep short |

### Carousel (`mobile/src/features/wallets/components/WalletCarousel.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `wallets.carousel.a11y.next` | Ví sau | Next wallet | WalletCarousel.tsx:34 | a11y action (adjustable) |
| `wallets.carousel.a11y.previous` | Ví trước | Previous wallet | WalletCarousel.tsx:35 | a11y action. Also WalletCarouselPager.tsx:213 |
| `common.empty.noWallet` | Chưa có ví. Tạo ví để ghi giao dịch. | (common) | WalletCarousel.tsx:185 | |
| `wallets.card.a11y` | ${centred.name}, ${formatCurrency(centred.balance, centred.currency)} | {{wallet}}, {{amount}} | WalletCarousel.tsx:240 | a11y. Not in the raw dump; same key as WalletStackCard.tsx:131 |
| `wallets.carousel.a11y.hint` | Vuốt lên hoặc xuống để đổi ví, chạm hai lần để mở | Swipe up or down to change wallet. Double-tap to open. | WalletCarousel.tsx:241 | a11y hint |

### Carousel pager (`mobile/src/features/wallets/components/WalletCarouselPager.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `wallets.carousel.a11y.previous` | Ví trước | Previous wallet | WalletCarouselPager.tsx:213 | a11y, same key as WalletCarousel.tsx:35 |
| `wallets.carousel.a11y.nextButton` | Ví tiếp theo | Next wallet | WalletCarouselPager.tsx:245 | a11y. VI differs from "Ví sau" (WalletCarousel.tsx:34) for the same thing; proposal: one VI wording, then merge into `wallets.carousel.a11y.next` |

### Actions under the centred card (`mobile/src/features/wallets/components/WalletActiveActions.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `wallets.active.sharedBadge` | {ROLE_LABEL[wallet.access ?? "viewer"]} · {wallet.owner_name ?? "Ví chung"} | {{role}} · {{owner}} | WalletActiveActions.tsx:42 | refactor: JSX fragments → one key. `{{role}}` = `sharedWallets.role.*`; missing owner name passes `common.label.sharedWallet` |
| `wallets.active.members` | Thành viên | Members | WalletActiveActions.tsx:46 | Button opening the people in a wallet shared with the user. Not `common.role.member` (a role) |
| `common.label.default` | Mặc định | (common) | WalletActiveActions.tsx:64 | Badge |
| `common.action.setDefault` | Đặt mặc định | (common) | WalletActiveActions.tsx:68 | |
| `wallets.active.shareCount` | Chia sẻ · ${memberCount} | Share · {{count}} | WalletActiveActions.tsx:78 | VI "Chia sẻ · {{count}}". Count of people already in the wallet |
| `wallets.active.share` | Chia sẻ | Share | WalletActiveActions.tsx:78 | Button |
| `wallets.active.edit` | Sửa ví | Edit wallet | WalletActiveActions.tsx:90 | a11y of the pencil button |
| `wallets.setDefault.confirm.title` | Đặt ví mặc định? | Set default wallet? | WalletActiveActions.tsx:100 | Same key as WalletListItem.tsx:85 |
| `wallets.setDefault.confirm.body` | "${wallet.name}" sẽ trở thành ví mặc định của bạn. | "{{wallet}}" becomes your default wallet. | WalletActiveActions.tsx:101 | Same key as WalletListItem.tsx:86 |
| `common.action.save` | Lưu | (common) | WalletActiveActions.tsx:102 | Confirm button. Proposal: `common.action.setDefault` like WalletListItem.tsx:87 (a button names what happens) |

### Sheet header (`mobile/src/features/wallets/components/WalletSheetHero.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `wallets.owner.yoursShared` | Ví chung của bạn | Your shared wallet | WalletSheetHero.tsx:26 | |
| `wallets.owner.yours` | Ví của bạn | Your wallet | WalletSheetHero.tsx:27 | Singular, one wallet. Not `common.label.yourWallets` (the Settings row, "Your wallets"). Also SharedWalletCard.tsx:36, SharedActivityHeader.tsx:60 |
| `wallets.owner.sharedByWithRole` | Ví chung của ${wallet.owner_name ?? "người khác"} · ${ROLE_LABEL[wallet.access ?? "viewer"]} | Shared by {{owner}} · {{role}} | WalletSheetHero.tsx:28 | VI "Ví chung của {{owner}} · {{role}}". Missing owner passes `wallets.owner.unknown` |

### Recent transactions in the sheet (`mobile/src/features/wallets/components/WalletRecentTransactions.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `wallets.recent.title.shared` | Giao dịch trong ví chung | Transactions in this wallet | WalletRecentTransactions.tsx:58 | Section label on a shared wallet (everyone's entries) |
| `wallets.recent.title.own` | Gần đây trong ví này | Recent in this wallet | WalletRecentTransactions.tsx:58 | Section label |
| `wallets.recent.error` | Không tải được giao dịch của ví này. | Couldn't load this wallet's transactions. | WalletRecentTransactions.tsx:64 | No retry control here; pull-to-refresh on the screen |
| `wallets.recent.empty` | Ví này chưa có giao dịch nào. | No transactions in this wallet yet. | WalletRecentTransactions.tsx:66 | |
| `sharedWallets.recordedBy` | {item.recorded_by.name} ghi | {{name}} recorded | WalletRecentTransactions.tsx:73 | VI "{{name}} ghi" (glossary: "người ghi"). refactor: JSX `{name}` + " ghi" → one key. Same key: SharedActivityRow.tsx:40 |

## Wallet form

Bottom sheet for create and edit, opened from the Wallets screen (Fab, pencil) and the empty state.

### Form (`mobile/src/features/wallets/components/WalletFormModal.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.walletType.cash` | Tiền mặt | (common) | WalletFormModal.tsx:25 | Type chip |
| `common.walletType.bank` | Ngân hàng | (common) | WalletFormModal.tsx:26 | Type chip |
| `common.walletType.e_wallet` | Ví điện tử | (common) | WalletFormModal.tsx:27 | Type chip. Glossary open decision #2 (e-wallet vs the app's wallet) applies to EN too |
| `common.walletType.other` | Khác | (common) | WalletFormModal.tsx:28 | Type chip |
| `wallets.form.name.required` | Nhập tên ví. | Enter a wallet name. | WalletFormModal.tsx:120 | Inline field error |
| `wallets.form.title.edit` | Sửa ví | Edit wallet | WalletFormModal.tsx:151 | Sheet title |
| `wallets.form.title.create` | Ví mới | New wallet | WalletFormModal.tsx:151 | Sheet title |
| `common.field.icon` | Biểu tượng | (common) | WalletFormModal.tsx:153 | |
| `common.field.name` | Tên | (common) | WalletFormModal.tsx:163 | |
| `wallets.form.name.placeholder` | vd: Tiền mặt | e.g. Cash | WalletFormModal.tsx:164 | placeholder |
| `wallets.form.colour.label` | Màu thẻ | Card colour | WalletFormModal.tsx:168 | Glossary spelling "colour" (see spec Open Questions on en-US vs en-GB) |
| `common.field.type` | Loại | (common) | WalletFormModal.tsx:171 | |
| `wallets.form.currency.label` | Loại tiền | Currency | WalletFormModal.tsx:180 | Create mode |
| `wallets.form.currency.labelLocked` | Loại tiền + " (không đổi được sau khi tạo)" | Currency (can't be changed) | WalletFormModal.tsx:180 | VI "Loại tiền (không đổi được sau khi tạo)". refactor: label + conditional suffix → two whole keys, one per mode |
| `wallets.form.initialBalance.label` | Số dư ban đầu ({currency}) | Starting balance ({{currency}}) | WalletFormModal.tsx:195 | VI "Số dư ban đầu ({{currency}})". refactor: JSX "Số dư ban đầu (" + `{currency}` + ")" → one key. `{{currency}}` is the ISO code |
| `wallets.form.error.saveFailed` | Không thể lưu ví | Couldn't save the wallet. Try again. | WalletFormModal.tsx:201 | Fallback passed to `getErrorMessage`, which today shows the server `message` first. Per spec: map `error_code` (CURRENCY_LOCKED, ICON_UPLOAD_UNAVAILABLE, ICON_UPLOAD_FAILED, INVALID_INPUT) in translations-errors.md, this key last. Proposed VI: "Chưa lưu được ví. Thử lại." |
| `common.action.cancel` | Hủy | (common) | WalletFormModal.tsx:205 | |
| `common.action.save` | Lưu | (common) | WalletFormModal.tsx:207 | Edit mode |
| `common.action.create` | Tạo | (common) | WalletFormModal.tsx:207 | Create mode |

### Colour picker (`mobile/src/features/wallets/components/WalletColorPicker.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `wallets.form.colour.auto` | Màu tự động | Automatic colour | WalletColorPicker.tsx:33 | a11y of the first swatch (glossary: "Màu tự động") |

Swatch a11y labels (line 59) come from `src/lib/wallet-colors.ts`; they are in [translations-shared.md](./translations-shared.md).

## Shared wallets tab and screen

The Wallets screen's "Ví chung" tab (`SharedWalletsView`) and the shared activity screen `app/(app)/shared-wallets.tsx` (everyone's transactions in one shared wallet, with search and filters).

### Shared tab (`mobile/src/features/wallets/components/SharedWalletsView.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `sharedWallets.tab.invitations` | Lời mời | Invitations | SharedWalletsView.tsx:79 | Group title |
| `sharedWallets.empty.title` | Chưa có ví chung | No shared wallets yet | SharedWalletsView.tsx:92 | Same key: shared-wallets.tsx:150 |
| `sharedWallets.empty.body` | Mời người thân vào một ví để cùng ghi thu chi, chung một số dư. | Invite family to a wallet to log income and spending together, on one balance. | SharedWalletsView.tsx:93 | |
| `sharedWallets.action.share` | Chia sẻ một ví | Share a wallet | SharedWalletsView.tsx:95 | Button. Same key as wallets.tsx:253 |
| `sharedWallets.activity.title` | Giao dịch ví chung | Shared wallet transactions | SharedWalletsView.tsx:115 | Row title; opens the screen with the same title (shared-wallets.tsx:139) |
| `sharedWallets.activity.hint` | Tìm và lọc giao dịch của mọi người trong ví | Search and filter everyone's transactions | SharedWalletsView.tsx:116 | Row subtitle |
| `sharedWallets.group.withMe` | Được chia sẻ với bạn | Shared with you | SharedWalletsView.tsx:120 | Group title |
| `sharedWallets.group.byMe` | Bạn đang chia sẻ | Shared by you | SharedWalletsView.tsx:121 | Group title |
| `sharedWallets.action.shareAnother` | Chia sẻ một ví khác | Share another wallet | SharedWalletsView.tsx:130 | Link button |

### Shared wallet row (`mobile/src/features/wallets/components/SharedWalletCard.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `wallets.owner.yours` | Ví của bạn | Your wallet | SharedWalletCard.tsx:36 | Same key as WalletSheetHero.tsx:27 |
| `wallets.owner.ownedBy` | Của ${wallet.owner_name ?? "người khác"} | Owned by {{owner}} | SharedWalletCard.tsx:36 | VI "Của {{owner}}". Missing owner passes `wallets.owner.unknown`. Same key: SharedActivityHeader.tsx:60 |
| `sharedWallets.card.a11y` | ${wallet.name}, ${owner}, ${ROLE_LABEL[wallet.access ?? "owner"]}, ${balance}${people} | {{wallet}}, {{owner}}, {{role}}, {{amount}} | SharedWalletCard.tsx:45 | a11y. Not in the raw dump (VI only inside variables). `${people}` is ", " + `memberCountLine`: add `sharedWallets.card.a11yWithPeople` "{{wallet}}, {{owner}}, {{role}}, {{amount}}, {{people}}" (same in VI) |

### Shared tag (`mobile/src/features/wallets/components/SharedWalletTag.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.label.sharedWallet` | Ví chung | (common) | SharedWalletTag.tsx:18 | Small tag in mixed lists |

### Share picker (`mobile/src/features/wallets/components/ShareWalletPicker.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `sharedWallets.picker.title` | Chọn ví để chia sẻ | Choose wallet to share | ShareWalletPicker.tsx:35 | Sheet title |
| `sharedWallets.picker.sharedWith` | Ví chung · ${members + 1} người | one: Shared wallet · {{count}} person · other: Shared wallet · {{count}} people | ShareWalletPicker.tsx:61 | VI "Ví chung · {{count}} người". `count` includes the owner, so it is ≥ 2 in practice; `_one` kept for CLDR completeness |

### Shared activity screen (`mobile/app/(app)/shared-wallets.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.count.categories` | 1 danh mục | (common) | shared-wallets.tsx:105 | Fallback when the one picked category is not in the cache. refactor: the "1 danh mục" branch becomes the plural key |
| `common.count.categories` | ${categoryIds.length} danh mục | (common) | shared-wallets.tsx:106 | Category filter pill |
| `sharedWallets.activity.title` | Giao dịch ví chung | Shared wallet transactions | shared-wallets.tsx:139 | Screen title, same key as SharedWalletsView.tsx:115 |
| `sharedWallets.empty.title` | Chưa có ví chung | No shared wallets yet | shared-wallets.tsx:150 | Same key as SharedWalletsView.tsx:92 |
| `sharedWallets.activity.empty.body` | Chia sẻ một ví ở tab Ví chung để cùng ghi thu chi. | Share a wallet from the Shared tab to log income and spending together. | shared-wallets.tsx:151 | |
| `sharedWallets.activity.empty.cta` | Mở tab Ví chung | Open Shared tab | shared-wallets.tsx:152 | Button (goes back to the tab) |
| `common.action.addTransaction` | Thêm giao dịch | (common) | shared-wallets.tsx:204 | a11y of the Fab |

### Shared activity header (`mobile/src/features/wallets/components/SharedActivityHeader.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `wallets.owner.yours` | Ví của bạn | Your wallet | SharedActivityHeader.tsx:60 | |
| `wallets.owner.ownedBy` | Của ${selected.owner_name ?? "người khác"} | Owned by {{owner}} | SharedActivityHeader.tsx:60 | Missing owner passes `wallets.owner.unknown` |
| `common.count.transactions` | {matchedCount} giao dịch | (common) | SharedActivityHeader.tsx:80 | refactor: JSX `{matchedCount}` + " giao dịch" → plural key |
| `common.field.time` | Thời gian | (common) | SharedActivityHeader.tsx:91 | Empty date-range filter pill. EN "Time" reads as clock time on a date filter; consider "Date" for this and TransactionsFilterBar.tsx:84 together |
| `sharedWallets.filter.clearDate` | Bỏ lọc thời gian | Clear date filter | SharedActivityHeader.tsx:94 | a11y of the pill's ×. Same VI in TransactionsFilterBar.tsx:88: share one key with translations-transactions.md |
| `common.field.category` | Danh mục | (common) | SharedActivityHeader.tsx:99 | Empty category filter pill |
| `sharedWallets.filter.clearCategory` | Bỏ lọc danh mục | Clear category filter | SharedActivityHeader.tsx:102 | a11y. Same VI in TransactionsFilterBar.tsx:96: share one key |

The type tabs (`TYPE_OPTIONS`) and the search field are imported from `src/features/transactions/`; see [translations-transactions.md](./translations-transactions.md).

### Shared activity row (`mobile/src/features/wallets/components/SharedActivityRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `sharedWallets.recordedBy` | {item.recorded_by.name} ghi | {{name}} recorded | SharedActivityRow.tsx:40 | Same key as WalletRecentTransactions.tsx:73 |

## Members and invitations

The members sheet (`WalletMembersSheet`) opens from "Chia sẻ" / "Thành viên" on a card or from a shared wallet row. Invitations show on the Shared tab and as a banner over the other two tabs.

### Copy constants (`mobile/src/features/wallets/components/wallet-member-copy.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `sharedWallets.role.owner` | Chủ ví | Owner | wallet-member-copy.ts:9 | Glossary |
| `sharedWallets.role.editor` | Ghi chép | Can record | wallet-member-copy.ts:10 | Glossary. Also the invite form's role option title |
| `sharedWallets.role.viewer` | Chỉ xem | View only | wallet-member-copy.ts:11 | Glossary |
| `sharedWallets.member.statusPending` | ${role} · Chờ trả lời | {{role}} · Awaiting reply | wallet-member-copy.ts:22 | VI "{{role}} · Chờ trả lời" |
| `sharedWallets.invite.error.noAccount` | Không có tài khoản nào với email hoặc tên đăng nhập này. | No account has this email or username. | wallet-member-copy.ts:26 | Also the `WALLET_MEMBER_USER_NOT_FOUND` copy (line 31) and InviteeLookupRow.tsx:48 |
| `sharedWallets.invite.error.memberExists` | Người này đã ở trong ví hoặc chưa trả lời lời mời. | This person is already in the wallet or has an invitation waiting. | wallet-member-copy.ts:32 | `WALLET_MEMBER_EXISTS` |
| `sharedWallets.invite.error.limit` | Ví đã đủ 10 người. | This wallet already has {{max}} people. | wallet-member-copy.ts:33 | `WALLET_MEMBER_LIMIT`. VI "Ví đã đủ {{max}} người."; `{{max}}` = `WALLET_MEMBER_LIMIT` (10, BR-02), not hardcoded |
| `sharedWallets.invite.error.self` | Đây là tài khoản của bạn. | This is your own account. | wallet-member-copy.ts:34 | Mapped from `INVALID_INPUT` on this endpoint only |
| `sharedWallets.invite.error.failed` | Chưa gửi được lời mời. Thử lại. | Couldn't send the invitation. Try again. | wallet-member-copy.ts:40 | Fallback after the codes above. Same VI in InviteUserModal.tsx:71 (translations-manage.md): candidate for one shared key |
| `sharedWallets.role.editorHint` | Thêm được giao dịch. Chỉ sửa được giao dịch mình ghi. | Can add transactions. Can edit only their own. | wallet-member-copy.ts:48 | Under the role option (invite form, invitation card) |
| `sharedWallets.role.viewerHint` | Xem số dư và giao dịch, không thêm được. | Sees the balance and transactions. Can't add any. | wallet-member-copy.ts:49 | |
| `sharedWallets.member.count` | ${members.length - pending} người | one: {{count}} person · other: {{count}} people | wallet-member-copy.ts:55 | VI "{{count}} người". Owner counted |
| `sharedWallets.member.countWithPending` | ${people} · ${pending} chờ trả lời | {{people}} · {{pending}} awaiting reply | wallet-member-copy.ts:56 | VI "{{people}} · {{pending}} chờ trả lời". `{{people}}` = rendered `sharedWallets.member.count` |

### Confirm dialogs (`mobile/src/features/wallets/components/wallet-member-dialogs.ts`)

refactor: today the role-change title, message and button interpolate `nextRole()` (a role label) into the sentence. EN needs the role inside the grammar, so each target role gets whole-sentence keys (`toViewer` / `toEditor`); the VI values keep today's text with the role written in.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `sharedWallets.memberDialog.toViewer.title` | Đổi ${action.member.name} sang ${nextRole(action.member)}? | Make {{name}} view only? | wallet-member-dialogs.ts:18 | VI "Đổi {{name}} sang Chỉ xem?" |
| `sharedWallets.memberDialog.toEditor.title` | Đổi ${action.member.name} sang ${nextRole(action.member)}? | Let {{name}} record transactions? | wallet-member-dialogs.ts:18 | VI "Đổi {{name}} sang Ghi chép?" |
| `sharedWallets.memberDialog.leave.title` | Rời ví ${walletName}? | Leave {{wallet}}? | wallet-member-dialogs.ts:19 | Glossary "Rời ví {{wallet}}?" |
| `sharedWallets.memberDialog.revoke.title` | Thu hồi lời mời? | Withdraw invitation? | wallet-member-dialogs.ts:20 | Pending member |
| `sharedWallets.memberDialog.remove.title` | Xóa ${action.member.name} khỏi ví? | Remove {{name}} from the wallet? | wallet-member-dialogs.ts:20 | |
| `sharedWallets.memberDialog.toViewer.body` | Người này vẫn xem được ví nhưng không thêm được giao dịch. | They can still see the wallet but can't add transactions. | wallet-member-dialogs.ts:27 | |
| `sharedWallets.memberDialog.toEditor.body` | Người này thêm được giao dịch vào ví. | They can add transactions to the wallet. | wallet-member-dialogs.ts:28 | |
| `sharedWallets.memberDialog.leave.body` | Ví sẽ không còn trong danh sách của bạn. Giao dịch bạn đã ghi vẫn ở lại trong ví. | The wallet leaves your list. Transactions you recorded stay in it. | wallet-member-dialogs.ts:30 | |
| `sharedWallets.memberDialog.revoke.body` | ${action.member.name} sẽ không vào được ví này. | {{name}} won't be able to join this wallet. | wallet-member-dialogs.ts:32 | |
| `sharedWallets.memberDialog.remove.body` | Giao dịch ${action.member.name} đã ghi vẫn ở lại trong ví. | Transactions {{name}} recorded stay in the wallet. | wallet-member-dialogs.ts:33 | |
| `sharedWallets.action.toViewer` | Đổi sang ${nextRole(action.member)} | Make view only | wallet-member-dialogs.ts:38 | Confirm button, VI "Đổi sang Chỉ xem". Same key as the menu item WalletMemberRow.tsx:55 |
| `sharedWallets.action.toEditor` | Đổi sang ${nextRole(action.member)} | Allow recording | wallet-member-dialogs.ts:38 | Confirm button, VI "Đổi sang Ghi chép". Same key as WalletMemberRow.tsx:55 |
| `sharedWallets.action.leave` | Rời ví | Leave wallet | wallet-member-dialogs.ts:39 | Destructive confirm. Same key: WalletMembersSheet.tsx:157 |
| `sharedWallets.action.revokeInvitation` | Thu hồi lời mời | Withdraw invitation | wallet-member-dialogs.ts:40 | Same key: WalletMemberRow.tsx:61 |
| `sharedWallets.action.removeMember` | Xóa khỏi ví | Remove from wallet | wallet-member-dialogs.ts:40 | Same key: WalletMemberRow.tsx:61 |

### Members sheet (`mobile/src/features/wallets/components/WalletMembersSheet.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `sharedWallets.members.title` | Người trong ví | People in this wallet | WalletMembersSheet.tsx:105 | Section title; the count beside it is `sharedWallets.member.count*` |
| `sharedWallets.members.loadError` | Chưa tải được danh sách. | Couldn't load the list. | WalletMembersSheet.tsx:118 | Paired with [Thử lại] on the same row |
| `common.action.retry` | Thử lại | (common) | WalletMembersSheet.tsx:119 | |
| `sharedWallets.members.allEntries` | Tìm và lọc mọi giao dịch | Search and filter all transactions | WalletMembersSheet.tsx:142 | Link to the shared activity screen |
| `sharedWallets.action.leave` | Rời ví | Leave wallet | WalletMembersSheet.tsx:157 | Button at the foot of the sheet (member, not owner) |
| `common.action.keep` | Giữ lại | (common) | WalletMembersSheet.tsx:168 | Cancel of every member dialog, including the non-destructive role change |

### Member row (`mobile/src/features/wallets/components/WalletMemberRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `sharedWallets.action.toViewer` / `sharedWallets.action.toEditor` | Đổi sang ${ROLE_LABEL[nextRole]} | Make view only / Allow recording | WalletMemberRow.tsx:55 | Popover menu item; one key per target role (see the dialogs refactor note) |
| `sharedWallets.action.revokeInvitation` | Thu hồi lời mời | Withdraw invitation | WalletMemberRow.tsx:61 | Menu item, pending member |
| `sharedWallets.action.removeMember` | Xóa khỏi ví | Remove from wallet | WalletMemberRow.tsx:61 | Menu item, destructive |
| `sharedWallets.member.nameSelf` | (bạn) | {{name}} <0>(you)</0> | WalletMemberRow.tsx:76 | VI "{{name}} <0>(bạn)</0>". refactor: name + styled suffix → one key rendered with `<Trans>` (the suffix has its own style) |
| `common.status.awaitingReply` | Chờ trả lời | (common) | WalletMemberRow.tsx:80 | Line under a pending member's name |
| `sharedWallets.member.roleA11y` | ${ROLE_LABEL[member.role]}. Tùy chọn cho ${member.name} | {{role}}. Options for {{name}} | WalletMemberRow.tsx:92 | a11y of the role pill (opens the menu) |

### Role pill (`mobile/src/features/wallets/components/RolePill.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.status.awaitingReply` | Chờ trả lời | (common) | RolePill.tsx:35 | Shown instead of the role for an unanswered invitation |

### Invite form (`mobile/src/features/wallets/components/WalletInviteForm.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `sharedWallets.invite.title` | Mời thêm người | Invite people | WalletInviteForm.tsx:62 | Section title, next to the "{{count}}/{{max}}" capacity |
| `common.field.identifier` | Email hoặc tên đăng nhập | (common) | WalletInviteForm.tsx:84 | placeholder |
| `common.field.identifier` | Email hoặc tên đăng nhập | (common) | WalletInviteForm.tsx:94 | a11y |
| `sharedWallets.invite.full` | Ví đã đủ {WALLET_MEMBER_LIMIT} người. Xóa bớt người để mời thêm. | This wallet is full ({{max}} people). Remove someone to invite more. | WalletInviteForm.tsx:132 | VI "Ví đã đủ {{max}} người. Xóa bớt người để mời thêm.". refactor: JSX "Ví đã đủ" + `{WALLET_MEMBER_LIMIT}` + "người. Xóa bớt…" (two raw fragments) → one key |
| `sharedWallets.invite.send` | Gửi lời mời | Send invitation | WalletInviteForm.tsx:134 | Same VI in InviteUserModal.tsx:77 (translations-manage.md): candidate for one shared key |

Role option titles and hints (lines 121-122) use `sharedWallets.role.*` and `sharedWallets.role.*Hint`. Errors (line 99) use `sharedWallets.invite.error.*`.

### Invitee lookup (`mobile/src/features/wallets/components/InviteeLookupRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.status.awaitingReply` | Chờ trả lời | (common) | InviteeLookupRow.tsx:16 | Person already invited |
| `sharedWallets.invitee.active` | Đã ở trong ví | Already in this wallet | InviteeLookupRow.tsx:17 | |
| `sharedWallets.invitee.self` | Tài khoản của bạn | Your account | InviteeLookupRow.tsx:18 | User typed their own email/username |

Line 48 renders `sharedWallets.invite.error.noAccount`.

### Invitation banner (`mobile/src/features/wallets/components/WalletInvitationBanner.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `sharedWallets.invitation.single` | ${items[0].owner_name} mời bạn vào ví ${items[0].wallet_name} | {{owner}} invited you to {{wallet}} | WalletInvitationBanner.tsx:25 | VI "{{owner}} mời bạn vào ví {{wallet}}". One line, truncated at the end; same key: WalletInvitationCards.tsx:68 |
| `sharedWallets.invitation.count` | ${items.length} lời mời vào ví chung | one: {{count}} shared wallet invitation · other: {{count}} shared wallet invitations | WalletInvitationBanner.tsx:26 | VI "{{count}} lời mời vào ví chung". refactor: today `items.length === 1` picks the single-invite sentence; keep that branch (it names the wallet), use the plural key for 2+ |
| `sharedWallets.invitationBanner.a11yHint` | Mở tab Ví chung | Opens the Shared tab | WalletInvitationBanner.tsx:34 | a11y hint (describes the result, unlike the button `sharedWallets.activity.empty.cta`) |

### Invitation cards (`mobile/src/features/wallets/components/WalletInvitationCards.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `sharedWallets.invitation.respondFailed` | Chưa trả lời được lời mời. Thử lại. | Couldn't answer the invitation. Try again. | WalletInvitationCards.tsx:42 | toast (error) |
| `sharedWallets.invitation.joined` | Đã vào ví ${invitation.wallet_name} | Joined {{wallet}} | WalletInvitationCards.tsx:44 | toast (success), after the server confirms |
| `sharedWallets.invitation.eyebrow` | Lời mời vào ví chung | Shared wallet invitation | WalletInvitationCards.tsx:66 | Small label over the card title |
| `sharedWallets.invitation.single` | {invitation.owner_name} mời bạn vào ví {invitation.wallet_name} | {{owner}} invited you to {{wallet}} | WalletInvitationCards.tsx:68 | refactor: JSX fragments `{owner}` + " mời bạn vào ví " + `{wallet}` → one key (same as the banner) |
| `sharedWallets.invitation.decline` | Từ chối | Decline | WalletInvitationCards.tsx:83 | Glossary "Từ chối" for invitations; EN "Decline" (not "Reject", which the glossary keeps for access requests) |
| `sharedWallets.invitation.accept` | Tham gia | Join | WalletInvitationCards.tsx:92 | Glossary. No diacritics, found by the secondary search |

The role pill and hint on each card (lines 75, 78) use `sharedWallets.role.*` / `*Hint`.

## Not translated

| Source | String | Reason |
|---|---|---|
| WalletColorPicker.tsx:65 | Aa | Type sample drawn on each swatch to show text contrast; Latin letters read the same in both languages |
| WalletColorPicker.tsx:59 | `{label}` | Colour names live in `src/lib/wallet-colors.ts`, covered in translations-shared.md |
| WalletFormModal.tsx (currency chips) | `{c}` (VND, USD…) | ISO currency codes, data |
| WalletInvitationCards.tsx:76 | `{invitation.wallet_currency}` | ISO currency code, data |
| WalletInviteForm.tsx:64 | `{memberCount}/{WALLET_MEMBER_LIMIT}` | Numbers and a slash only |
| InviteeLookupRow.tsx:65, WalletMemberRow.tsx:84 | `@{username}` | User data with a fixed "@" prefix |
| Wallet, owner and member names, `formatCurrency` output | (data) | User data / formatted by `lib/currency.ts` per the wallet's currency |
