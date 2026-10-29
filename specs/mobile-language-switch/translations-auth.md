# Translations: auth and accounts

> Scope: `app/(auth)/login.tsx`, `app/(auth)/request-access.tsx`, `app/(auth)/reset-password.tsx`, `app/(app)/add-account.tsx`, `src/features/auth/`, `src/features/accounts/` (saved accounts, switching, sign out). 103 rows. Conventions: [translations.md](./translations.md).

## Login: `app/(auth)/login.tsx`

Invite-only sign-in: identifier first, then password; shortcuts (passkey, saved accounts) under "hoặc"; request-access link at the foot.

### Screen copy (`mobile/app/(auth)/login.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `auth.login.title` | Đăng nhập | Sign in | login.tsx:20 | Screen heading. Separate key from the button `common.action.signIn` |
| `auth.login.or` | hoặc | or | login.tsx:21 | Divider above the shortcuts, lower case |
| `auth.login.noAccount` | Chưa có tài khoản? | No account yet? | login.tsx:22 | |
| `auth.login.requestAccess` | Gửi yêu cầu tạo tài khoản | Request access | login.tsx:23 | Link. Glossary: access request |

### Brand mark (`mobile/src/features/auth/components/BrandMark.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.brand` | Budgest | (common) | BrandMark.tsx:12 | a11y label; product name, constant, not in locale files |
| `common.brand` | Budgest | (common) | BrandMark.tsx:14 | |

### Login form (`mobile/src/features/auth/components/LoginForm.tsx`)

Also rendered on Add account (`mode="add-account"`) and in the saved-account sign-in.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.signIn` | Đăng nhập | (common) | LoginForm.tsx:40 | Submit button, login mode |
| `nav.title.addAccount` | Thêm tài khoản | (common) | LoginForm.tsx:41 | Submit button, add-account mode |
| `common.field.identifier` | Email hoặc tên đăng nhập | (common) | LoginForm.tsx:46 | Field label, also its a11y label (AuthField) |
| `auth.emailPlaceholder` | ten@email.com | name@email.com | LoginForm.tsx:47 | placeholder, no diacritics (missed by the extractor). Also RequestAccessForm.tsx:17, password-reset-copy.ts:10 |
| `auth.loginForm.passwordLabel` | Mật khẩu | Password | LoginForm.tsx:48 | |
| `auth.loginForm.passwordPlaceholder` | Nhập mật khẩu | Enter password | LoginForm.tsx:49 | placeholder |
| `common.action.showPassword` | Hiện mật khẩu | (common) | LoginForm.tsx:50 | a11y, eye toggle |
| `common.action.hidePassword` | Ẩn mật khẩu | (common) | LoginForm.tsx:51 | a11y, eye toggle |
| `common.action.continue` | Tiếp tục | (common) | LoginForm.tsx:52 | Button at the identifier step |
| `auth.loginForm.forgotPassword` | Quên mật khẩu? | Forgot password? | LoginForm.tsx:53 | Link (glossary: forgot password) |
| `common.validation.enterIdentifier` | Nhập email hoặc tên đăng nhập. | (common) | LoginForm.tsx:54 | Inline field error |
| `auth.loginForm.passwordMissing` | Nhập mật khẩu. | Enter your password. | LoginForm.tsx:55 | Inline field error |

### Login errors (`mobile/src/features/auth/login-error.ts`)

Mapped by `error_code`; also used by the passkey sign-in button. The full backend code table lives in [translations-errors.md](./translations-errors.md).

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `auth.loginError.failed` | Chưa đăng nhập được. Thử lại. | Couldn't sign in. Try again. | login-error.ts:4 | Fallback for any other code |
| `auth.loginError.INVALID_CREDENTIALS` | Tài khoản hoặc mật khẩu không đúng. | Incorrect email, username or password. | login-error.ts:10 | Never says which one was wrong (skill: no account enumeration) |
| `auth.loginError.RATE_LIMITED` | Đăng nhập sai quá nhiều lần. Thử lại sau 15 phút. | Too many failed sign-ins. Try again in {{minutes}} min. | login-error.ts:12 | VI locale: "…Thử lại sau {{minutes}} phút."; pass 15 from the limiter constant |
| `auth.loginError.ACCOUNT_NOT_ACTIVATED` | Tài khoản chưa kích hoạt. Mở email mời để kích hoạt. | This account isn't activated yet. Open the invite email to activate it. | login-error.ts:13 | |
| `auth.loginError.ACCOUNT_AWAITING_APPROVAL` | Yêu cầu tạo tài khoản đang chờ admin duyệt. | Your access request is awaiting admin approval. | login-error.ts:14 | |
| `auth.loginError.ACCOUNT_DISABLED` | Tài khoản đã bị khóa. Liên hệ admin. | This account is locked. Contact your admin. | login-error.ts:15 | |
| `auth.loginError.PASSKEY_FAILED` | Không xác minh được passkey. Thử lại. | Couldn't verify the passkey. Try again. | login-error.ts:17 | Same VI as passkey-messages.ts:19 (settings area); one key if both mean sign-in |
| `auth.loginError.PASSKEYS_UNAVAILABLE` | Chưa dùng được passkey. Đăng nhập bằng mật khẩu. | Passkeys aren't available yet. Sign in with your password. | login-error.ts:18 | |

### Passkey sign-in (`mobile/src/features/auth/components/PasskeySignInButton.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `auth.passkey.signIn` | Đăng nhập bằng passkey | Sign in with a passkey | PasskeySignInButton.tsx:14 | Glossary: "passkey" lower case mid-sentence |

### Saved accounts entry (`mobile/src/features/accounts/components/SavedAccountsEntry.tsx`)

The one-line shortcut under "hoặc" that opens the saved-accounts view.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `accounts.savedEntry.title` | Chọn tài khoản đã lưu | Choose a saved account | SavedAccountsEntry.tsx:18 | |
| `accounts.savedEntry.count` | ${n} tài khoản trên thiết bị này | one: {{count}} account on this device · other: {{count}} accounts on this device | SavedAccountsEntry.tsx:19 | VI: "{{count}} tài khoản trên thiết bị này" |
| `accounts.savedEntry.a11y` | `${COPY.title}, ${count}` | one: Choose a saved account, {{count}} account on this device · other: Choose a saved account, {{count}} accounts on this device | SavedAccountsEntry.tsx:43 | a11y. refactor: label is concatenated from the two keys above; one key with `{{count}}` |

### Saved accounts view (`mobile/src/features/accounts/components/SavedAccountLogin.tsx`, `LoginCandidateViews.tsx`, `CandidateSignIn.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.back` | Quay lại | (common) | SavedAccountLogin.tsx:19 | a11y, back chevron |
| `accounts.saved.pick` | Chọn tài khoản | Choose account | SavedAccountLogin.tsx:20 | View title |
| `accounts.saved.removeRequestMessage` | Yêu cầu đã gửi không bị hủy. | The request you sent stays open. | SavedAccountLogin.tsx:22 | Body of the remove dialog when the row is a sent access request |
| `common.status.awaitingApproval` | Chờ duyệt | (common) | LoginCandidateViews.tsx:18 | Status pill on a sent request |
| `common.action.signIn` | Đăng nhập | (common) | CandidateSignIn.tsx:17 | One-tap sign-in button |
| `accounts.candidate.awaitingHint` | Đăng nhập được sau khi admin duyệt. | You can sign in once an admin approves. | CandidateSignIn.tsx:18 | |
| `accounts.candidate.approvedHint` | Mở email kích hoạt để đặt mật khẩu, rồi đăng nhập. | Open the activation email to set a password, then sign in. | CandidateSignIn.tsx:19 | |

### Remove a saved account (`mobile/src/features/accounts/account-copy.ts`)

Shared by the switch dialog's trash button and the login screen's per-row ×.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `accounts.remove.action` | Gỡ ${name} khỏi thiết bị | Remove {{name}} from this device | account-copy.ts:5 | a11y of the remove button (AccountRow.tsx:64, LoginCandidateViews.tsx:115) |
| `accounts.remove.title` | Gỡ ${name} khỏi thiết bị? | Remove {{name}} from this device? | account-copy.ts:6 | Confirm title. `{{name}}` is a display name or masked email; can be long |
| `accounts.remove.message` | Tài khoản không bị xóa. Lần sau phải nhập lại email và mật khẩu. | The account isn't deleted. Next time, enter the email and password again. | account-copy.ts:7 | |
| `accounts.remove.confirm` | Gỡ | Remove | account-copy.ts:9 | Half-width dialog button; the title names the account |
| `common.action.keep` | Giữ lại | (common) | account-copy.ts:10 | |

## Request access: `app/(auth)/request-access.tsx`

Entry: login "Gửi yêu cầu tạo tài khoản". Someone without an invite asks an admin for an account.

### Screen (`mobile/app/(auth)/request-access.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `auth.requestAccess.title` | Yêu cầu tạo tài khoản | Request access | request-access.tsx:13 | Glossary: access request |
| `auth.requestAccess.sub` | Sau khi admin duyệt, email kích hoạt sẽ được gửi tới email của bạn. | Once an admin approves, you'll get an activation email. | request-access.tsx:14 | |
| `auth.requestAccess.sent` | Đã gửi yêu cầu. Chờ admin duyệt. | Request sent. Awaiting admin approval. | request-access.tsx:15 | toast |
| `common.action.back` | Quay lại | (common) | request-access.tsx:16 | a11y, back chevron |

### Form (`mobile/src/features/auth/components/RequestAccessForm.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `auth.requestAccess.emailLabel` | Email của bạn | Your email | RequestAccessForm.tsx:16 | |
| `auth.emailPlaceholder` | ten@email.com | name@email.com | RequestAccessForm.tsx:17 | placeholder, no diacritics |
| `auth.requestAccess.adminLabel` | Email admin | Admin email | RequestAccessForm.tsx:18 | No diacritics (missed by the extractor) |
| `auth.requestAccess.adminPlaceholder` | admin@email.com | admin@email.com | RequestAccessForm.tsx:19 | placeholder, same in both languages |
| `auth.requestAccess.submit` | Gửi yêu cầu | Send request | RequestAccessForm.tsx:20 | |
| `auth.requestAccess.emptyEmail` | Nhập email. | Enter an email. | RequestAccessForm.tsx:21 | Inline field error (both fields) |
| `auth.requestAccess.badEmail` | Nhập email đúng dạng ten@email.com. | Enter an email like name@email.com. | RequestAccessForm.tsx:22 | |
| `auth.requestAccess.sameEmail` | Email admin phải khác email của bạn. | The admin email must be different from yours. | RequestAccessForm.tsx:23 | |
| `auth.requestAccess.failed` | Chưa gửi được yêu cầu. Thử lại. | Couldn't send the request. Try again. | RequestAccessForm.tsx:24 | |
| `auth.requestAccess.ADMIN_NOT_FOUND` | Không có admin nào dùng email này. | No admin uses this email. | RequestAccessForm.tsx:29 | Field error on "Email admin", by `error_code` |
| `auth.requestAccess.RATE_LIMITED` | Đã gửi quá nhiều yêu cầu. Thử lại sau 1 giờ. | one: Too many requests. Try again in {{count}} hour. · other: Too many requests. Try again in {{count}} hours. | RequestAccessForm.tsx:33 | VI: "Đã gửi quá nhiều yêu cầu. Thử lại sau {{count}} giờ."; count = 1 from the limiter window |

## Reset password: `app/(auth)/reset-password.tsx`

Forgot password (specs/forgot-password). Two steps on one screen: request a code, then code + new password. All copy lives in `password-reset-copy.ts` and is rendered by `reset-password.tsx`, `ResetRequestForm.tsx`, `ResetConfirmForm.tsx`, `ResendCodeLink.tsx`.

### Copy (`mobile/src/features/auth/password-reset-copy.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `auth.resetPassword.title` | Đặt lại mật khẩu | Reset password | password-reset-copy.ts:7 | Screen heading |
| `auth.resetPassword.requestSub` | Mã đặt lại gửi tới email của tài khoản. | A reset code goes to the account's email. | password-reset-copy.ts:8 | Step 1 line under the title |
| `common.field.identifier` | Email hoặc tên đăng nhập | (common) | password-reset-copy.ts:9 | |
| `auth.emailPlaceholder` | ten@email.com | name@email.com | password-reset-copy.ts:10 | placeholder, no diacritics |
| `auth.resetPassword.sendCode` | Gửi mã | Send code | password-reset-copy.ts:11 | Button (skill: "Gửi mã", not "Nhận mã") |
| `auth.resetPassword.codeLabel` | Mã đặt lại | Reset code | password-reset-copy.ts:12 | Glossary: forgot password |
| `auth.resetPassword.codePlaceholder` | 6 số trong email | {{length}} digits from the email | password-reset-copy.ts:13 | placeholder. VI: "{{length}} số trong email"; length = `PASSWORD_RESET_CODE_LENGTH` |
| `common.field.newPassword` | Mật khẩu mới | (common) | password-reset-copy.ts:14 | |
| `auth.resetPassword.passwordPlaceholder` | Ít nhất ${MIN_PASSWORD_LENGTH} ký tự | one: At least {{count}} character · other: At least {{count}} characters | password-reset-copy.ts:15 | placeholder. VI: "Ít nhất {{count}} ký tự" |
| `common.field.confirmNewPassword` | Nhập lại mật khẩu mới | (common) | password-reset-copy.ts:16 | |
| `common.action.showPassword` | Hiện mật khẩu | (common) | password-reset-copy.ts:17 | a11y |
| `common.action.hidePassword` | Ẩn mật khẩu | (common) | password-reset-copy.ts:18 | a11y |
| `auth.resetPassword.submit` | Đặt lại mật khẩu | Reset password | password-reset-copy.ts:19 | Button; same words as the title, separate key |
| `auth.resetPassword.resend` | Gửi lại mã | Resend code | password-reset-copy.ts:20 | Link |
| `common.action.back` | Quay lại | (common) | password-reset-copy.ts:21 | a11y, back chevron |
| `auth.resetPassword.done` | Đã đặt lại mật khẩu | Password reset | password-reset-copy.ts:22 | toast after sign-in |
| `auth.resetPassword.confirmSub` | Nếu ${identifier} có tài khoản, mã ${PASSWORD_RESET_CODE_LENGTH} số đã gửi tới email của tài khoản đó. Mã dùng được trong 15 phút. | If {{identifier}} has an account, a {{length}}-digit code was sent to its email. The code works for {{minutes}} minutes. | password-reset-copy.ts:27 | Step 2 line. VI: "…mã {{length}} số… trong {{minutes}} phút." Never says whether the account exists |
| `auth.resetPassword.resendIn` | Gửi lại mã sau ${seconds} giây | one: Resend code in {{count}} second · other: Resend code in {{count}} seconds | password-reset-copy.ts:31 | Countdown link. VI: "Gửi lại mã sau {{count}} giây" |
| `common.validation.enterIdentifier` | Nhập email hoặc tên đăng nhập. | (common) | password-reset-copy.ts:35 | |
| `auth.resetPassword.codeMissing` | Nhập mã ${PASSWORD_RESET_CODE_LENGTH} số. | Enter the {{length}}-digit code. | password-reset-copy.ts:36 | VI: "Nhập mã {{length}} số." |
| `auth.resetPassword.codeInvalid` | Mã không đúng hoặc đã hết hạn. | The code is wrong or has expired. | password-reset-copy.ts:37 | `RESET_CODE_INVALID` |
| `auth.password.tooShort` | Mật khẩu cần ít nhất ${MIN_PASSWORD_LENGTH} ký tự. | one: Use at least {{count}} character. · other: Use at least {{count}} characters. | password-reset-copy.ts:38 | VI: "Mật khẩu cần ít nhất {{count}} ký tự." Same rule as change password / activation; one key if the settings area agrees |
| `auth.password.tooLong` | Mật khẩu tối đa ${MAX_PASSWORD_BYTES} ký tự không dấu. | Use at most {{count}} characters without accents. | password-reset-copy.ts:39 | VI: "…tối đa {{count}} ký tự không dấu." The limit is bytes, hence "without accents" |
| `auth.password.mismatch` | Hai mật khẩu chưa khớp. | The passwords don't match. | password-reset-copy.ts:40 | |
| `auth.resetPassword.sendFailed` | Chưa gửi được mã. Thử lại. | Couldn't send the code. Try again. | password-reset-copy.ts:44 | |
| `auth.resetPassword.sendLimited` | Đã gửi quá nhiều mã. Thử lại sau 15 phút. | Too many codes sent. Try again in {{minutes}} min. | password-reset-copy.ts:45 | VI: "…Thử lại sau {{minutes}} phút." |
| `auth.resetPassword.resetFailed` | Chưa đặt lại được mật khẩu. Thử lại. | Couldn't reset the password. Try again. | password-reset-copy.ts:46 | |
| `errors.tooManyAttempts` | Thử quá nhiều lần. Thử lại sau 15 phút. | Too many attempts. Try again in {{minutes}} min. | password-reset-copy.ts:47 | Shared with ChangePasswordForm.tsx:24 (settings area); defined in translations-errors.md. VI: "…sau {{minutes}} phút." |

## Add account: `app/(app)/add-account.tsx`

Entry: "+ Thêm tài khoản" in the switch dialog, or an expired saved account (email prefilled). Renders `LoginForm` (add-account mode) and the passkey button above.

### Screen (`mobile/app/(app)/add-account.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.title.addAccount` | Thêm tài khoản | (common) | add-account.tsx:11 | Screen title |
| `accounts.add.hint` | Đăng nhập tài khoản khác. Tài khoản hiện tại vẫn được lưu trên thiết bị này. | Sign in to another account. The current one stays saved on this device. | add-account.tsx:12 | |

## Switch account: Settings row and dialog

### Settings row (`mobile/src/features/accounts/components/AccountSwitchRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.title.switchAccount` | Chuyển tài khoản | (common) | AccountSwitchRow.tsx:11 | Settings row, directly above "Đăng xuất" |

### Dialog (`mobile/src/features/accounts/components/AccountSwitchDialog.tsx`, `AccountRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `nav.title.switchAccount` | Chuyển tài khoản | (common) | AccountSwitchDialog.tsx:22 | Dialog title |
| `accounts.switch.add` | + Thêm tài khoản | + Add account | AccountSwitchDialog.tsx:23 | Link. Proposal: draw "+" as an icon and reuse `nav.title.addAccount` |
| `accounts.switch.limitHint` | Đã đạt tối đa ${MAX_SAVED_ACCOUNTS} tài khoản trên thiết bị này | one: This device holds the maximum of {{count}} account · other: This device holds the maximum of {{count}} accounts | AccountSwitchDialog.tsx:24 | VI: "Đã đạt tối đa {{count}} tài khoản trên thiết bị này" |
| `accounts.row.active` | Đang dùng | Current | AccountRow.tsx:25 | Status of the account in use. Not the access-request status "Đang dùng" (users area) |
| `accounts.row.expired` | Cần đăng nhập lại | Signed out | AccountRow.tsx:26 | Status label of a saved account whose session ended. Glossary: label is "Hết phiên" / "signed out"; VI here still differs (proposed VI fix: "Hết phiên"). Also shown on the login candidate rows |

### Switch outcomes (`mobile/src/features/accounts/switch-account.ts`)

All shown as warning toasts, except the system biometric prompt title.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `accounts.switch.expired` | Cần đăng nhập lại tài khoản này. | Sign in to this account again. | switch-account.ts:21 | toast. Glossary: session ended |
| `accounts.switch.interrupted` | Lần chuyển trước bị gián đoạn. Cần đăng nhập lại tài khoản này. | The last switch was interrupted. Sign in to this account again. | switch-account.ts:22 | toast |
| `accounts.switch.offline` | Cần kết nối mạng để chuyển tài khoản. | Connect to the internet to switch accounts. | switch-account.ts:23 | toast |
| `accounts.switch.generic` | Chưa chuyển được tài khoản. Thử lại sau. | Couldn't switch accounts. Try again later. | switch-account.ts:24 | toast |
| `accounts.switch.needsPassword` | Cần đăng nhập lại bằng mật khẩu. | Sign in again with your password. | switch-account.ts:25 | toast |
| `accounts.switch.notVerified` | Không xác minh được. Thử lại sau. | Couldn't verify. Try again later. | switch-account.ts:26 | toast |
| `accounts.switch.unlockPrompt` | Mở khóa tài khoản | Unlock account | switch-account.ts:30 | Title of the OS fingerprint/screen-lock prompt; follows app language (passed at call time) |

### Sign-in outcome (`mobile/src/features/accounts/complete-login.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `accounts.login.alreadyActive` | Bạn đang dùng tài khoản này. | You're already using this account. | complete-login.ts:17 | toast |

### Sign out and remove (`mobile/src/features/accounts/hooks/use-logout.ts`, `mobile/src/features/accounts/remove-account.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `accounts.logout.noLockRemoved` | Máy chưa cài khóa màn hình nên tài khoản đã được gỡ khỏi máy. | This phone has no screen lock, so the account was removed from it. | use-logout.ts:15 | toast |
| `accounts.remove.verifyPrompt` | Xác minh để gỡ tài khoản | Verify to remove the account | remove-account.ts:10 | Title of the OS biometric prompt |

## Not translated

| Source | Text | Reason |
|---|---|---|
| LoginCandidateViews.tsx:19 | Test | Pill on debug test accounts (`lib/dev-login.ts`), shown only in dev builds. Debug surface, English already |
| switch-account.ts:210 | `capitalize(getErrorMessage(error, SWITCH_COPY.generic))` | Shows the server's raw `message`. refactor: map by `error_code` (see translations-errors.md), fall back to `accounts.switch.generic`; never display server text |
| AvatarGroup.tsx (`+N`) | +{{n}} | Number only, no words |
