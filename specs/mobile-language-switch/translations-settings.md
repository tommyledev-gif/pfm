# Translations: Settings, preferences, profile, security, change password, developer

> Scope: Settings tab, Preferences (`user-settings`), Profile (`edit-profile`), Security (devices, change password, app lock, app PIN, account-switch check, passkeys, sign out other devices), Change password, Developer, the global app lock / PIN prompt overlays, and the super-admin "delete accounts" tool from `src/features/security`. 216 rows (209 existing strings, 2 a11y labels split out of concatenations, 5 new rows for the language switch). Conventions: [translations.md](./translations.md).

## Settings tab: route `app/(app)/(tabs)/settings.tsx`

### Screen (`mobile/app/(app)/(tabs)/settings.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `settings.title` | Cài đặt | Settings | settings.tsx:151 | Screen title. Same text as `nav.tab.settings`, separate key (title vs tab) |
| `settings.group.money` | Tài chính | Money | settings.tsx:65 | Group header over wallets, categories, transaction history |
| `common.label.yourWallets` | Ví của bạn | (common) | settings.tsx:67 | Row to the Wallets screen |
| `nav.title.categories` | Danh mục | (common) | settings.tsx:68 | Row |
| `nav.title.auditLogs` | Nhật ký giao dịch | (common) | settings.tsx:69 | Row |
| `settings.group.account` | Tài khoản | Account | settings.tsx:73 | Group header |
| `nav.title.security` | Bảo mật | (common) | settings.tsx:75 | Row |
| `nav.title.userSettings` | Cài đặt người dùng | (common) | settings.tsx:78 | Row ("Preferences") |
| `nav.title.members` | Thành viên gia đình | (common) | settings.tsx:84 | Row, admin only |
| `settings.group.other` | Khác | Other | settings.tsx:88 | Group header |
| `settings.row.helpSupport` | Trợ giúp & hỗ trợ | Help & support | settings.tsx:90 | Disabled row, no screen yet |
| `nav.title.developer` | Nhà phát triển | (common) | settings.tsx:91 | Row |
| `settings.logout.inProgress` | Đang đăng xuất… | Signing out… | settings.tsx:170 | Row title while signing out |
| `common.action.signOut` | Đăng xuất | (common) | settings.tsx:170 | Row title. Implementation: rows and groups use `key={label}` / `key={group.header}`; switch to `href`/a fixed id so a language change does not remount the list |

### Profile card (`mobile/src/features/settings/components/ProfileSummaryCard.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `settings.profileCard.editProfileA11y` | Sửa hồ sơ | Edit profile | ProfileSummaryCard.tsx:16 | a11y, used twice (card and avatar) |
| `settings.profileCard.netWorth` | Tài sản ròng | Net worth | ProfileSummaryCard.tsx:78 | Stat label |
| `common.txType.income` | Thu nhập | (common) | ProfileSummaryCard.tsx:88 | Stat label, this month |
| `common.txType.expense` | Chi tiêu | (common) | ProfileSummaryCard.tsx:98 | Stat label, this month ("Spending") |

### Sign out with unsynced transactions (`mobile/src/features/settings/components/LogoutGuardDialog.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `settings.logoutGuard.title` | Còn ${n} giao dịch chưa đồng bộ | one: {{count}} transaction hasn't synced · other: {{count}} transactions haven't synced | LogoutGuardDialog.tsx:20 | VI: "Còn {{count}} giao dịch chưa đồng bộ" |
| `settings.logoutGuard.message` | Giữ lại: giao dịch được lưu trên máy này và tự đồng bộ khi bạn đăng nhập lại. | If you keep them, they stay on this phone and sync when you sign in again. | LogoutGuardDialog.tsx:21 | VI quotes the button in a "Giữ lại:" prefix; EN says it as a condition so it does not depend on the button label |
| `settings.logoutGuard.syncNow` | Đồng bộ ngay | Sync now | LogoutGuardDialog.tsx:22 | Button, online only |
| `settings.logoutGuard.keep` | Giữ lại và đăng xuất | Keep and sign out | LogoutGuardDialog.tsx:23 | Button |
| `settings.logoutGuard.discard` | Bỏ và đăng xuất | Discard and sign out | LogoutGuardDialog.tsx:24 | Button |
| `common.action.cancel` | Huỷ | (common) | LogoutGuardDialog.tsx:25 | Old spelling, VI value becomes "Hủy" |
| `settings.logoutGuard.discardTitle` | Bỏ ${n} giao dịch và đăng xuất? | one: Discard {{count}} transaction and sign out? · other: Discard {{count}} transactions and sign out? | LogoutGuardDialog.tsx:26 | VI: "Bỏ {{count}} giao dịch và đăng xuất?" |
| `settings.logoutGuard.discardMessage` | Các giao dịch này sẽ bị xoá khỏi máy và không bao giờ được gửi lên tài khoản. | They'll be deleted from this phone and never reach your account. | LogoutGuardDialog.tsx:27 | VI: old spelling "xoá", passive "bị/được"; proposed VI "Giao dịch bị xóa khỏi máy và không gửi lên tài khoản." |
| `settings.logoutGuard.discardConfirm` | Bỏ | Discard and sign out | LogoutGuardDialog.tsx:28 | Destructive confirm; EN names both effects of the tap. Proposed VI "Bỏ và đăng xuất". The dialog passes no cancelLabel, so it shows ConfirmDialog's default "Hủy" (shared table); per glossary it should be `common.action.keep` |

## Preferences: route `app/(app)/user-settings.tsx`

### Screen (`mobile/app/(app)/user-settings.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.title.userSettings` | Cài đặt người dùng | (common) | user-settings.tsx:26 | Screen title ("Preferences") |
| `userSettings.transactions.header` | Giao dịch | Transactions | user-settings.tsx:12 | Group header over the pin-location switch |

### Appearance (`mobile/src/features/settings/components/ThemePicker.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `userSettings.appearance.header` | Giao diện | Appearance | ThemePicker.tsx:26 | Group header |
| `userSettings.appearance.optionA11y` | Giao diện ${label} | {{theme}} theme | ThemePicker.tsx:53 | a11y, radio. VI: "Giao diện {{theme}}". `{{theme}}` is the theme name ("Tối"/"Sáng", `src/theme/palettes.ts`, keyed in translations-shared.md) |

### Language (new, this feature)

Same pattern as Appearance: a group with a header, one cell per option, applied on tap, no save step, no toast.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `userSettings.language.header` | Ngôn ngữ | Language | new | Group header. VI is proposed copy, not current |
| `userSettings.language.option.vi` | Tiếng Việt | Tiếng Việt | new | Endonym: each option is written in its own language whatever the app language, so a user who switched by mistake can find the way back. Keep as a constant in the supported-languages list, not in vi.json/en.json |
| `userSettings.language.option.en` | English | English | new | Endonym, same rule |
| `userSettings.language.optionA11y` | Ngôn ngữ: {{language}} | Language: {{language}} | new | a11y, radio role with selected state, mirrors `userSettings.appearance.optionA11y`. `{{language}}` = the endonym |
| `userSettings.language.footer` | Tin nhắn trợ lý và thông báo đã có giữ nguyên ngôn ngữ cũ. | Assistant replies and notifications you already have keep their language. | new | Optional. Only if spec.md keeps backend-rendered text (AI replies, stored notifications) in the language it was created in |

### Pin location default (`mobile/src/features/settings/components/PinLocationDefaultRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `userSettings.pinLocation.title` | Ghim vị trí khi tạo giao dịch | Pin location on new transactions | PinLocationDefaultRow.tsx:6 | Toggle label, names what is on (patterns §11) |
| `userSettings.pinLocation.footer` | Tắt được riêng cho từng giao dịch. | Can be turned off for a single transaction. | PinLocationDefaultRow.tsx:8 | Exported and imported by user-settings.tsx but not rendered today |

## Profile: route `app/(app)/edit-profile.tsx`

### Screen (`mobile/app/(app)/edit-profile.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `profile.title` | Hồ sơ | Profile | edit-profile.tsx:20 | Screen title |

### Edit form (`mobile/src/features/profile/components/EditProfileForm.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `profile.edit.nameLabel` | Tên hiển thị | Display name | EditProfileForm.tsx:28 | Glossary: display name |
| `common.field.username` | Tên đăng nhập | (common) | EditProfileForm.tsx:29 | Read-only row label |
| `profile.edit.usernameHint` | Đặt một lần lúc kích hoạt, không đổi được. | Set once at activation. It can't be changed. | EditProfileForm.tsx:30 | Group footer |
| `profile.edit.namePlaceholder` | Nguyễn Văn A | Alex Nguyen | EditProfileForm.tsx:31 | Placeholder, example name per locale |
| `profile.edit.changePhoto` | Đổi ảnh | Change photo | EditProfileForm.tsx:32 | Upload button |
| `profile.edit.removePhotoA11y` | Xóa ảnh | Remove photo | EditProfileForm.tsx:34 | a11y of the icon-only trash button |
| `common.action.save` | Lưu | (common) | EditProfileForm.tsx:35 | Inline button in the name field |
| `profile.edit.saved` | Đã lưu | Saved | EditProfileForm.tsx:36 | Toast |
| `profile.edit.photoChanged` | Đã đổi ảnh | Photo changed | EditProfileForm.tsx:37 | Upload button done label |
| `profile.edit.photoRemoved` | Đã xóa ảnh | Photo removed | EditProfileForm.tsx:38 | Toast |
| `profile.edit.saveFailed` | Chưa lưu được tên. Thử lại. | Couldn't save the name. Try again. | EditProfileForm.tsx:39 | Fallback of `getErrorMessage`: today the server `message` wins; after migration map by `error_code` (translations-errors.md) |
| `profile.edit.photoFailed` | Chưa đổi được ảnh. Thử lại. | Couldn't change the photo. Try again. | EditProfileForm.tsx:40 | Same fallback note |
| `profile.edit.removeFailed` | Chưa xóa được ảnh. Thử lại. | Couldn't remove the photo. Try again. | EditProfileForm.tsx:41 | Same fallback note |
| `profile.edit.photosDenied` | Chưa có quyền truy cập ảnh. Cấp quyền trong cài đặt của máy. | No access to photos. Allow it in your phone's settings. | EditProfileForm.tsx:42 | Toast (warning) |

### Username claim (`mobile/src/features/profile/components/UsernameClaimField.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.field.username` | Tên đăng nhập | (common) | UsernameClaimField.tsx:15 | Field label |
| `profile.username.placeholder` | vd: lan.nguyen | e.g. lan.nguyen | UsernameClaimField.tsx:16 | Placeholder, diacritic-free |
| `profile.username.hint` | Đặt một lần, không đổi được. | Set once. It can't be changed. | UsernameClaimField.tsx:17 | |
| `profile.username.submit` | Đặt | Set | UsernameClaimField.tsx:19 | Inline button, keep to one word |
| `profile.username.confirmTitle` | Đặt tên đăng nhập ${username}? | Set username {{username}}? | UsernameClaimField.tsx:75 | Dialog title. VI: "Đặt tên đăng nhập {{username}}?" |
| `profile.username.confirmMessage` | Tên này không đổi được sau khi đặt. | This name can't be changed once set. | UsernameClaimField.tsx:20 | |
| `profile.username.confirm` | Đặt tên | Set username | UsernameClaimField.tsx:21 | Confirm button |
| `profile.username.cancel` | Sửa lại | Edit | UsernameClaimField.tsx:22 | Back to the field to change the name |
| `profile.username.done` | Đã đặt tên đăng nhập | Username set | UsernameClaimField.tsx:23 | Toast |
| `profile.username.failed` | Chưa đặt được tên đăng nhập. Thử lại. | Couldn't set the username. Try again. | UsernameClaimField.tsx:24 | Fallback only; `USERNAME_TAKEN` / `INVALID_USERNAME` / `USERNAME_ALREADY_SET` come from translations-errors.md |

### Identity fallback (`mobile/src/features/profile/use-profile-identity.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `profile.fallbackName` | Thành viên | Member | use-profile-identity.ts:18 | Name shown in Settings header / Home top bar when neither name nor email is known. Separate from `common.role.member` (a name, not a role) |

## Security: route `app/(app)/security.tsx`

### Screen (`mobile/app/(app)/security.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.title.security` | Bảo mật | (common) | security.tsx:17 | Screen title |
| `security.protections.header` | Khóa và xác minh | Lock and verification | security.tsx:18 | Group header over app lock |

### Signed-in devices (`mobile/src/features/security/components/DeviceSessionsSection.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.devices.title` | Thiết bị đang đăng nhập | Signed-in devices | DeviceSessionsSection.tsx:17 | Group header (glossary) |
| `security.devices.unnamed` | Thiết bị không rõ tên | Unnamed device | DeviceSessionsSection.tsx:18 | |
| `security.devices.current` | Thiết bị này | This device | DeviceSessionsSection.tsx:19 | Row subtitle |
| `common.action.signOut` | Đăng xuất | (common) | DeviceSessionsSection.tsx:20 | Inline row action |
| `security.devices.confirmLabel` | Đăng xuất thiết bị | Sign out device | DeviceSessionsSection.tsx:21 | Confirm button |
| `common.action.keep` | Giữ lại | (common) | DeviceSessionsSection.tsx:22 | |
| `security.devices.loadFailed` | Chưa tải được danh sách thiết bị. | Couldn't load devices. | DeviceSessionsSection.tsx:23 | |
| `common.action.retry` | Thử lại | (common) | DeviceSessionsSection.tsx:24 | |
| `security.devices.offline` | Cần kết nối mạng để đăng xuất thiết bị. | Connect to the internet to sign out a device. | DeviceSessionsSection.tsx:25 | Toast (warning) |
| `security.devices.failed` | Chưa đăng xuất được thiết bị. Thử lại sau. | Couldn't sign out the device. Try again later. | DeviceSessionsSection.tsx:26 | Toast (warning) |
| `security.devices.confirmTitle` | Đăng xuất ${name}? | Sign out {{device}}? | DeviceSessionsSection.tsx:30 | VI: "Đăng xuất {{device}}?" |
| `security.devices.confirmMessage` | ${name} cần đăng nhập lại để vào tài khoản này. | {{device}} will need to sign in again to use this account. | DeviceSessionsSection.tsx:31 | |
| `security.devices.signedOut` | Đã đăng xuất ${name} | {{device}} signed out | DeviceSessionsSection.tsx:32 | Toast |
| `security.devices.lastActive` | Hoạt động ${formatDateDMY(s.last_used_at)} | Active {{date}} | DeviceSessionsSection.tsx:33 | `{{date}}` formatted for the active locale |
| `security.devices.signOutA11y` | `${COPY.signOut} ${nameOf(s)}` | Sign out {{device}} | DeviceSessionsSection.tsx:100 | a11y. refactor: two strings joined; VI "Đăng xuất {{device}}" |

### Change password row (`mobile/src/features/security/components/ChangePasswordRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.title.changePassword` | Đổi mật khẩu | (common) | ChangePasswordRow.tsx:7 | Row |
| `security.changePassword.footer` | Thiết bị khác sẽ phải đăng nhập lại. | Other devices will need to sign in again. | ChangePasswordRow.tsx:9 | Group footer |

### App lock switch (`mobile/src/features/security/components/AppLockToggleRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.appLock.title` | Khóa ứng dụng | App lock | AppLockToggleRow.tsx:11 | Toggle label (glossary) |
| `security.appLock.footer` | Hỏi mã PIN, vân tay, khuôn mặt hoặc mã khóa màn hình khi mở ứng dụng. | Asks for the app PIN, fingerprint, face or screen lock when the app opens. | AppLockToggleRow.tsx:13 | Group footer |
| `security.appLock.noLock` | Máy chưa cài khóa màn hình nên chưa bật được khóa ứng dụng. Đặt mã PIN để bật. | This phone has no screen lock, so app lock can't turn on. Set an app PIN to use it. | AppLockToggleRow.tsx:14 | Toast (warning) |
| `security.verifyFailed` | Không xác minh được. | Couldn't verify. | AppLockToggleRow.tsx:15 | Toast (warning). Same text and key as PinSection.tsx:13 |

### App PIN (`mobile/src/features/security/components/PinSection.tsx`, `mobile/src/features/security/pin/pin-copy.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.verifyFailed` | Không xác minh được. | (same key) | PinSection.tsx:13 | Same key as AppLockToggleRow.tsx:15 |
| `security.pin.section` | Mã PIN | App PIN | pin-copy.ts:5 | Group header (glossary) |
| `security.pin.footer` | Dùng 6 số để mở khóa ứng dụng và xác minh khi chuyển tài khoản. Sai 5 lần liên tiếp thì mọi tài khoản trên máy bị đăng xuất. | 6 digits to unlock the app and verify account switches. After 5 wrong tries in a row, every account on this phone is signed out. | pin-copy.ts:7 | Group footer. 6 and 5 are hardcoded; better `{{length}}` / `{{tries}}` from `PIN_LENGTH` and the wipe limit |
| `security.pin.setRow` | Đặt mã PIN | Set app PIN | pin-copy.ts:8 | Row |
| `security.pin.changeRow` | Đổi mã PIN | Change app PIN | pin-copy.ts:9 | Row |
| `security.pin.offRow` | Tắt mã PIN | Turn off app PIN | pin-copy.ts:10 | Destructive row |
| `security.pin.set` | Đã đặt mã PIN | PIN set | pin-copy.ts:29 | Toast |
| `security.pin.changed` | Đã đổi mã PIN | PIN changed | pin-copy.ts:30 | Toast |
| `security.pin.off` | Đã tắt mã PIN | PIN turned off | pin-copy.ts:31 | Toast |
| `security.pin.offWithLock` | Đã tắt mã PIN và khóa ứng dụng. | PIN and app lock turned off | pin-copy.ts:32 | Toast. VI ends with a period; toasts take none |

### Account-switch check (`mobile/src/features/security/components/IdentityCheckToggleRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.identityCheck.title` | Xác minh khi chuyển tài khoản | Verify when switching accounts | IdentityCheckToggleRow.tsx:10 | Toggle label |
| `security.identityCheck.footer` | Hỏi mã PIN, vân tay, khuôn mặt hoặc mã khóa màn hình trước khi chuyển sang tài khoản đã lưu. | Asks for the app PIN, fingerprint, face or screen lock before switching to a saved account. | IdentityCheckToggleRow.tsx:13 | Group footer |

### Passkeys (`mobile/src/features/security/components/PasskeysSection.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.passkeys.title` | Passkey | Passkeys | PasskeysSection.tsx:19 | Group header, diacritic-free. Glossary keeps "passkey" in both languages |
| `security.passkeys.hint` | Không bắt buộc. Đăng nhập không cần mật khẩu, kể cả trên máy mới. | Optional. Sign in without a password, even on a new phone. | PasskeysSection.tsx:22 | Group footer |
| `security.passkeys.add` | Thêm passkey | Add passkey | PasskeysSection.tsx:23 | Row button |
| `security.passkeys.unsupported` | Bản ứng dụng này chưa dùng được passkey. | This version of the app can't use passkeys yet. | PasskeysSection.tsx:24 | |
| `security.passkeys.empty` | Chưa có passkey. | No passkeys yet. | PasskeysSection.tsx:25 | |
| `security.passkeys.loadFailed` | Chưa tải được danh sách passkey. | Couldn't load passkeys. | PasskeysSection.tsx:26 | |
| `security.passkeys.added` | Đã thêm passkey | Passkey added | PasskeysSection.tsx:27 | Toast |
| `security.passkeys.addFailed` | Chưa thêm được passkey. Thử lại. | Couldn't add the passkey. Try again. | PasskeysSection.tsx:28 | Toast; same key as passkey-messages.ts:13 |
| `security.passkeys.offline` | Cần kết nối mạng để thêm passkey. | Connect to the internet to add a passkey. | PasskeysSection.tsx:29 | Toast |
| `security.passkeys.deleted` | Đã xóa passkey | Passkey deleted | PasskeysSection.tsx:30 | Toast |
| `security.passkeys.deleteFailed` | Chưa xóa được passkey. Thử lại. | Couldn't delete the passkey. Try again. | PasskeysSection.tsx:31 | Toast; fallback, `PASSKEY_NOT_FOUND` mapped in translations-errors.md |
| `security.passkeys.confirmTitle` | Xóa passkey này? | Delete this passkey? | PasskeysSection.tsx:32 | |
| `security.passkeys.confirmLabel` | Xóa passkey | Delete passkey | PasskeysSection.tsx:33 | |
| `security.passkeys.confirmMessage` | ${name} sẽ không đăng nhập bằng passkey này được nữa. | {{device}} can't sign in with this passkey anymore. | PasskeysSection.tsx:36 | `{{device}}` = the passkey's name, which is the phone it was made on |
| `security.passkeys.addedLine` | Thêm ${formatDateDMY(p.created_at)} | Added {{date}} | PasskeysSection.tsx:39 | Row subtitle |
| `security.passkeys.addedUsedLine` | ${added} · Dùng ${formatDateDMY(p.last_used_at)} | Added {{added}} · Used {{used}} | PasskeysSection.tsx:40 | refactor: builds on line 39; one key, VI "Thêm {{added}} · Dùng {{used}}" |
| `security.passkeys.deleteA11y` | `${COPY.confirmLabel} ${p.name}` | Delete passkey {{device}} | PasskeysSection.tsx:136 | a11y. refactor: two strings joined; VI "Xóa passkey {{device}}" |
| `common.action.keep` | Giữ lại | (common) | PasskeysSection.tsx:180 | |

### Passkey failures (`mobile/src/features/security/passkeys/passkey-messages.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.passkeys.noProvider` | Máy chưa lưu được passkey. Đăng nhập tài khoản Google trên máy rồi thử lại. | This phone can't save the passkey. Sign in to a Google account on the phone and try again. | passkey-messages.ts:6 | Add and sign-in |
| `security.passkeys.timeout` | Máy không phản hồi khi mở passkey. Thử lại. | The phone didn't respond while opening the passkey. Try again. | passkey-messages.ts:7 | Add and sign-in |
| `security.passkeys.exists` | Máy này đã có passkey cho tài khoản này. | This phone already has a passkey for this account. | passkey-messages.ts:12 | Add |
| `security.passkeys.addFailed` | Chưa thêm được passkey. Thử lại. | (same key) | passkey-messages.ts:13 | Same key as PasskeysSection.tsx:28 |
| `security.passkeys.noCredential` | Máy này chưa có passkey. Đăng nhập bằng mật khẩu, rồi thêm passkey trong Bảo mật. | This phone has no passkey yet. Sign in with your password, then add one in Security. | passkey-messages.ts:18 | Sign-in (login screen) |
| `security.passkeys.signInFailed` | Không xác minh được passkey. Thử lại. | Couldn't verify the passkey. Try again. | passkey-messages.ts:19 | Same text as `PASSKEY_FAILED` in login-error.ts:17: share one key with translations-auth.md / translations-errors.md |

### Passkey setup guide (`mobile/src/features/security/components/PasskeyProviderHelp.tsx`)

Android 14+ variant (`provider`) and pre-14 variant (`account`).

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.passkeyHelp.provider.title` | Máy chưa lưu được passkey | This phone can't save passkeys yet | PasskeyProviderHelp.tsx:25 | Card title |
| `security.passkeyHelp.provider.why` | Passkey nằm trong trình quản lý mật khẩu của máy, thường là Google. | Passkeys live in the phone's password manager, usually Google. | PasskeyProviderHelp.tsx:26 | |
| `security.passkeyHelp.provider.step1` | Bấm Mở Cài đặt. | Tap Open Settings. | PasskeyProviderHelp.tsx:27 | Quotes the button label: interpolate `{{button}}` = `common.action.openSettings` so the two never drift |
| `security.passkeyHelp.provider.step2` | Kiểm tra Google đang bật trong danh sách dịch vụ. | Check that Google is turned on in the list of services. | PasskeyProviderHelp.tsx:27 | Second item on the same line |
| `common.action.openSettings` | Mở Cài đặt | (common) | PasskeyProviderHelp.tsx:28 | Button |
| `security.passkeyHelp.provider.notFound` | Không thấy danh sách: tìm “khóa truy cập” trong Cài đặt. | Can't find the list? Search Settings for “passkeys”. | PasskeyProviderHelp.tsx:29 | Names Android's own wording, which follows the PHONE language, not the app language. A user with an EN app on a VI phone still sees "khóa truy cập" (see open question) |
| `security.passkeyHelp.provider.stillMissing` | Vẫn chưa lưu được passkey. Google đã bật thì thử lại sau. | Still couldn't save the passkey. If Google is on, try again later. | PasskeyProviderHelp.tsx:30 | |
| `security.passkeyHelp.account.title` | Máy chưa có tài khoản Google | No Google account on this phone | PasskeyProviderHelp.tsx:35 | "tài khoản" here is a Google account, not a wallet: correct per glossary |
| `security.passkeyHelp.account.why` | Passkey được lưu vào tài khoản Google trên máy. | Passkeys are saved to the Google account on the phone. | PasskeyProviderHelp.tsx:36 | |
| `security.passkeyHelp.account.step1` | Bấm Thêm tài khoản Google. | Tap Add Google account. | PasskeyProviderHelp.tsx:37 | Quotes the button: interpolate `{{button}}` = `security.passkeyHelp.account.open` |
| `security.passkeyHelp.account.step2` | Đăng nhập một tài khoản Google. | Sign in to a Google account. | PasskeyProviderHelp.tsx:37 | Second item on the same line |
| `security.passkeyHelp.account.open` | Thêm tài khoản Google | Add Google account | PasskeyProviderHelp.tsx:38 | Button |
| `security.passkeyHelp.account.stillMissing` | Máy vẫn chưa có tài khoản Google. Thêm tài khoản rồi quay lại. | Still no Google account on this phone. Add one, then come back. | PasskeyProviderHelp.tsx:40 | |
| `security.passkeyHelp.returnStep` | Quay lại đây, passkey tự thêm tiếp. | Come back here and the passkey is added automatically. | PasskeyProviderHelp.tsx:43 | Last step of both variants |
| `common.action.retry` | Thử lại | (common) | PasskeyProviderHelp.tsx:44 | |
| `security.passkeyHelp.closeA11y` | Đóng hướng dẫn | Close guide | PasskeyProviderHelp.tsx:80 | a11y |

### Sign out other devices (`mobile/src/features/security/components/RevokeAllSessionsRow.tsx`, `mobile/src/features/security/api/use-revoke-all-sessions-mutation.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.revokeAll.label` | Đăng xuất mọi thiết bị | Sign out other devices | RevokeAllSessionsRow.tsx:12 | Destructive row. EN says "other": this device stays signed in (footer). Not the same key as the admin action in users/RevokeSessionsButton.tsx, which does sign out every device |
| `security.revokeAll.footer` | Mọi thiết bị khác phải đăng nhập lại bằng mật khẩu. Thiết bị này vẫn giữ đăng nhập. | Every other device must sign in again with the password. This device stays signed in. | RevokeAllSessionsRow.tsx:14 | Group footer |
| `security.revokeAll.confirmTitle` | Đăng xuất mọi thiết bị? | Sign out other devices? | RevokeAllSessionsRow.tsx:15 | |
| `common.action.signOut` | Đăng xuất | (common) | RevokeAllSessionsRow.tsx:16 | Confirm button. Dialog passes no cancelLabel, so ConfirmDialog's default "Hủy" shows (shared table) |
| `security.revokeAll.confirmMessage` | Tài khoản ${email} sẽ bị đăng xuất khỏi mọi thiết bị khác, kể cả các máy đã lưu tài khoản để chuyển nhanh. | {{email}} will be signed out on every other device, including phones that saved it for quick switching. | RevokeAllSessionsRow.tsx:19 | VI: "Tài khoản {{email}} sẽ bị đăng xuất…" |
| `security.revokeAll.success` | Đã đăng xuất mọi thiết bị khác. | Signed out other devices | use-revoke-all-sessions-mutation.ts:15 | Toast. VI ends with a period; toasts take none |
| `security.revokeAll.offline` | Cần kết nối mạng để đăng xuất mọi thiết bị. | Connect to the internet to sign out other devices. | use-revoke-all-sessions-mutation.ts:16 | Toast. Same VI as users/RevokeSessionsButton.tsx:23 (admin, other table) but a different action, so a separate key |
| `security.revokeAll.failed` | Chưa đăng xuất được mọi thiết bị. Thử lại sau. | Couldn't sign out other devices. Try again later. | use-revoke-all-sessions-mutation.ts:17 | Toast |

### Identity check helpers (`mobile/src/features/security/identity-check.ts`)

Prompts go to the phone's own fingerprint/face sheet (`expo-local-authentication`): they follow the app language, the rest of that sheet follows the phone.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.identityCheck.switchPrompt` | Xác minh để chuyển tài khoản | Verify to switch accounts | identity-check.ts:13 | OS prompt title |
| `security.identityCheck.changeSettingPrompt` | Xác minh để đổi cài đặt bảo mật | Verify to change security settings | identity-check.ts:15 | OS prompt title (app lock, PIN, account-switch switches) |
| `common.action.cancel` | Hủy | (common) | identity-check.ts:16 | OS prompt cancel button |
| `security.identityCheck.failed` | Không xác minh được. Chưa chuyển tài khoản. | Couldn't verify. Account not switched. | identity-check.ts:17 | Toast (warning) |
| `security.identityCheck.noLockWarning` | Máy chưa cài khóa màn hình nên ai cầm máy cũng chuyển được tài khoản. Đặt mã PIN trong Bảo mật để chặn. | This phone has no screen lock, so anyone holding it can switch accounts. Set an app PIN in Security to stop that. | identity-check.ts:20 | Toast, shown once |
| `security.identityCheck.noLockAdminBlocked` | Máy chưa có khóa màn hình nên chưa chuyển sang tài khoản admin. Đặt mã PIN trong Bảo mật rồi thử lại. | This phone has no screen lock, so it can't switch to an admin account. Set an app PIN in Security and try again. | identity-check.ts:22 | Toast. VI uses "admin"; glossary role term is "quản trị" (proposed VI "tài khoản quản trị") |
| `security.identityCheck.useFingerprint` | Dùng vân tay | Use fingerprint | identity-check.ts:25 | Button on the PIN pad |
| `security.identityCheck.useFace` | Dùng khuôn mặt | Use face unlock | identity-check.ts:26 | Button on the PIN pad |
| `security.identityCheck.useScreenLock` | Dùng khóa màn hình | Use screen lock | identity-check.ts:27 | Button on the PIN pad |

## App lock and PIN prompt (global overlays, no route)

Rendered over the signed-in area by the root layout: `AppLockOverlay` / `AppLockPinScreen` while the app is locked, `PinPromptHost` (with `PinPad`, `PinAltActions`) whenever a PIN is asked for.

### Lock screen (`mobile/src/features/security/components/AppLockOverlay.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.appLock.locked` | Ứng dụng đang khóa | App locked | AppLockOverlay.tsx:26 | Under the user's name |
| `security.appLock.unlock` | Mở khóa | Unlock | AppLockOverlay.tsx:27 | Button |
| `security.appLock.prompt` | Mở khóa ứng dụng | Unlock app | AppLockOverlay.tsx:28 | OS prompt title; same key as AppLockPinScreen.tsx:19 |
| `security.appLock.hint` | Dùng vân tay hoặc mã khóa màn hình | Use fingerprint or screen lock | AppLockOverlay.tsx:29 | Line under the button |
| `security.biometricFailed` | Xác thực chưa khớp. Thử lại. | Didn't match. Try again. | AppLockOverlay.tsx:30 | Same text and key as pin-copy.ts:21 |

### PIN lock screen (`mobile/src/features/security/components/AppLockPinScreen.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.appLock.prompt` | Mở khóa ứng dụng | (same key) | AppLockPinScreen.tsx:19 | Same key as AppLockOverlay.tsx:28 |

### PIN prompt, pad and alternatives (`mobile/src/features/security/pin/pin-copy.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.pin.enter` | Nhập mã PIN | Enter app PIN | pin-copy.ts:12 | Prompt title |
| `security.pin.create` | Nhập mã PIN gồm ${PIN_LENGTH} số | Enter a {{length}}-digit PIN | pin-copy.ts:13 | VI: "Nhập mã PIN gồm {{length}} số" |
| `security.pin.repeat` | Nhập lại mã PIN | Re-enter PIN | pin-copy.ts:14 | |
| `security.pin.current` | Nhập mã PIN hiện tại | Enter current PIN | pin-copy.ts:15 | |
| `security.pin.forSwitch` | Nhập mã PIN để chuyển tài khoản | Enter PIN to switch accounts | pin-copy.ts:16 | |
| `security.pin.mismatch` | Hai mã PIN chưa khớp. Nhập lại. | The PINs don't match. Enter it again. | pin-copy.ts:18 | |
| `security.pin.checkFailed` | Chưa kiểm tra được mã PIN. Thử lại. | Couldn't check the PIN. Try again. | pin-copy.ts:19 | |
| `security.pin.saveFailed` | Chưa lưu được mã PIN. Nhập lại. | Couldn't save the PIN. Enter it again. | pin-copy.ts:20 | |
| `security.biometricFailed` | Xác thực chưa khớp. Thử lại. | (same key) | pin-copy.ts:21 | Same key as AppLockOverlay.tsx:30 |
| `common.action.close` | Đóng | (common) | pin-copy.ts:23 | a11y of the prompt's X |
| `security.pin.forgot` | Quên mã PIN? | Forgot PIN? | pin-copy.ts:24 | Link, also the confirm dialog title |
| `security.pin.forgotMessage` | Mọi tài khoản trên máy sẽ bị đăng xuất và mã PIN bị xóa. Đăng nhập lại bằng mật khẩu để dùng tiếp. | Every account on this phone will be signed out and the PIN deleted. Sign in again with your password to continue. | pin-copy.ts:25 | |
| `security.pin.forgotConfirm` | Đăng xuất mọi tài khoản | Sign out all accounts | pin-copy.ts:26 | Destructive confirm |
| `common.action.keep` | Giữ lại | (common) | pin-copy.ts:27 | |
| `security.pin.wipedWrong` | Nhập sai mã PIN 5 lần. Đã đăng xuất mọi tài khoản trên máy. | Wrong PIN 5 times. Every account on this phone was signed out. | pin-copy.ts:33 | Toast after the wipe (sign-out-device.ts). "5" could be `{{tries}}` |
| `security.pin.wipedForgot` | Đã đăng xuất mọi tài khoản trên máy. | Every account on this phone was signed out. | pin-copy.ts:34 | Toast |
| `security.pin.deleteDigitA11y` | Xóa một số | Delete digit | pin-copy.ts:36 | a11y of the backspace key |
| `security.pin.wrong` | Sai mã PIN. Còn ${triesLeft} lần thử. | one: Wrong PIN. {{count}} try left. · other: Wrong PIN. {{count}} tries left. | pin-copy.ts:40 | VI: "Sai mã PIN. Còn {{count}} lần thử." |
| `security.pin.digitKeyA11y` | Phím ${digit} | {{digit}} | pin-copy.ts:44 | a11y of each digit key; EN reads just the digit, like a phone dialer |
| `security.pin.enteredA11y` | Đã nhập ${count} trên ${PIN_LENGTH} số | {{count}} of {{length}} digits entered | pin-copy.ts:48 | a11y of the dots; no plural needed ("digits" follows `{{length}}` = 6) |

## Change password: route `app/(app)/change-password.tsx`

### Screen (`mobile/app/(app)/change-password.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.title.changePassword` | Đổi mật khẩu | (common) | change-password.tsx:11 | Screen title |

### Form (`mobile/src/features/security/components/ChangePasswordForm.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.changePassword.current` | Mật khẩu hiện tại | Current password | ChangePasswordForm.tsx:13 | Field |
| `common.field.newPassword` | Mật khẩu mới | (common) | ChangePasswordForm.tsx:14 | Field |
| `security.changePassword.hint` | Ít nhất ${MIN_PASSWORD_LENGTH} ký tự. | At least {{min}} characters. | ChangePasswordForm.tsx:15 | Group footer. `{{min}}` = 8, constant, so no plural forms |
| `common.field.confirmNewPassword` | Nhập lại mật khẩu mới | (common) | ChangePasswordForm.tsx:16 | Field |
| `security.changePassword.submit` | Đổi mật khẩu | Change password | ChangePasswordForm.tsx:17 | Button. Same text as `nav.title.changePassword`, separate key (button vs title) |
| `security.changePassword.enterCurrent` | Nhập mật khẩu hiện tại. | Enter your current password. | ChangePasswordForm.tsx:18 | Inline error |
| `security.changePassword.wrongCurrent` | Mật khẩu hiện tại không đúng. | Incorrect current password. | ChangePasswordForm.tsx:19 | `WRONG_CURRENT_PASSWORD` |
| `security.changePassword.tooShort` | Mật khẩu mới cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự. | New password needs at least {{min}} characters. | ChangePasswordForm.tsx:20 | Also `WEAK_PASSWORD` |
| `security.changePassword.mismatch` | Hai mật khẩu mới chưa khớp. | The new passwords don't match. | ChangePasswordForm.tsx:21 | |
| `security.changePassword.same` | Mật khẩu mới trùng mật khẩu hiện tại. | New password is the same as the current one. | ChangePasswordForm.tsx:22 | Also `SAME_PASSWORD` |
| `security.changePassword.offline` | Không có kết nối mạng. Thử lại sau. | No connection. Try again later. | ChangePasswordForm.tsx:23 | |
| `errors.tooManyAttempts` | Thử quá nhiều lần. Thử lại sau 15 phút. | Too many attempts. Try again in {{minutes}} min. | ChangePasswordForm.tsx:24 | `RATE_LIMITED`. Shared with password-reset-copy.ts:47; defined in translations-errors.md. VI: "Thử lại sau {{minutes}} phút." |
| `security.changePassword.failed` | Chưa đổi được mật khẩu. Thử lại sau. | Couldn't change the password. Try again later. | ChangePasswordForm.tsx:25 | |
| `security.changePassword.done` | Đã đổi mật khẩu. Thiết bị khác cần đăng nhập lại. | Password changed. Other devices need to sign in again. | ChangePasswordForm.tsx:26 | Toast (two short sentences, kept) |

## Developer: route `app/(app)/developer.tsx`

### Screen (`mobile/app/(app)/developer.tsx`)

The only control here is the debug bubble switch; the bubble and log viewer themselves (`src/components/debug/`) are in translations-shared.md.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.title.developer` | Nhà phát triển | (common) | developer.tsx:28 | Screen title |
| `developer.debugBubble.label` | Hiển thị Debug Bubble | Show debug bubble | developer.tsx:12 | Toggle. VI mixes an English term; proposed VI "Hiện bong bóng debug" or keep (developer-only) |
| `developer.debugBubble.footer` | Khi ẩn, log API và điều hướng vẫn được ghi. | API and navigation logs are still recorded while it's hidden. | developer.tsx:13 | Group footer |

## Family members: delete-accounts tool (super admin, rendered on `app/(app)/users.tsx`)

Lives in `src/features/security`, shown on the Family members screen only when `GET /users/me` returns `can_delete_accounts`.

### Section (`mobile/src/features/security/components/DeleteAccountsSection.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `security.deleteAccounts.title` | Tất cả tài khoản | All accounts | DeleteAccountsSection.tsx:19 | Group header |
| `security.deleteAccounts.footer` | Tìm và xóa bất kỳ tài khoản nào, kể cả ngoài gia đình. | Find and delete any account, including ones outside the family. | DeleteAccountsSection.tsx:20 | Group footer |
| `security.deleteAccounts.placeholder` | Tìm theo email, tên đăng nhập | Search by email or username | DeleteAccountsSection.tsx:21 | Placeholder |
| `security.deleteAccounts.noResults` | Không tìm thấy tài khoản | No accounts found | DeleteAccountsSection.tsx:22 | |
| `security.deleteAccounts.searchFailed` | Chưa tải được kết quả. | Couldn't load results. | DeleteAccountsSection.tsx:23 | |
| `common.action.retry` | Thử lại | (common) | DeleteAccountsSection.tsx:24 | |
| `security.deleteAccounts.confirmTitle` | Xóa tài khoản này? | Delete this account? | DeleteAccountsSection.tsx:25 | |
| `security.deleteAccounts.confirmLabel` | Xóa tài khoản | Delete account | DeleteAccountsSection.tsx:26 | |
| `common.action.keep` | Giữ lại | (common) | DeleteAccountsSection.tsx:27 | |
| `security.deleteAccounts.offline` | Cần kết nối mạng để xóa tài khoản. | Connect to the internet to delete accounts. | DeleteAccountsSection.tsx:28 | Toast |
| `security.deleteAccounts.notFound` | Không tìm thấy tài khoản. | This account wasn't found. | DeleteAccountsSection.tsx:29 | Toast (404) |
| `security.deleteAccounts.failed` | Chưa xóa được tài khoản. Thử lại. | Couldn't delete the account. Try again. | DeleteAccountsSection.tsx:30 | Toast; fallback after the server message today |
| `security.deleteAccounts.confirmMessage` | ${email} bị đăng xuất khỏi mọi thiết bị và không đăng nhập lại được. Không thể hoàn tác. | {{email}} is signed out everywhere and can't sign in again. This can't be undone. | DeleteAccountsSection.tsx:34 | |
| `security.deleteAccounts.success` | Đã xóa tài khoản ${email} | Account {{email}} deleted | DeleteAccountsSection.tsx:35 | Toast. Puts a full email in a toast (i18n-rules §6); proposed both languages drop it: "Đã xóa tài khoản" / "Account deleted" |

### Result row (`mobile/src/features/security/components/AccountSearchRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.delete` | Xóa | (common) | AccountSearchRow.tsx:24 | Inline destructive button |
| `security.deleteAccounts.rowA11y` | Xóa tài khoản ${user.email} | Delete account {{email}} | AccountSearchRow.tsx:28 | a11y |

## Not translated

- `testID`s, code comments, query keys, native error codes in `passkeys/native-passkey.ts` and `passkeys/passkey-play-services.ts` ("UserCancelled", "NoCreateOption", …): never shown.
- User and device data inserted into strings: display names, emails, usernames, device names (`device_name`, e.g. "Samsung SM-S918B"), passkey names. Shown as-is in both languages.
- Theme names "Tối" / "Sáng" (`src/theme/palettes.ts`) used by ThemePicker: owned by translations-shared.md.
- Android's own Settings wording quoted in comments ("Mật khẩu, khóa truy cập và tài khoản"): comment only; the user-visible mention is `security.passkeyHelp.provider.notFound`.
- Implementation notes found while reading (not copy): settings.tsx uses the translated label and header as React keys; `PIN_LOCATION_FOOTER` is imported in user-settings.tsx but never rendered; `RevokeAllSessionsRow` and the LogoutGuard discard dialog rely on ConfirmDialog's default cancel label "Hủy" instead of "Giữ lại".
