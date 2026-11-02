# Feature Spec: Mobile language switch (Vietnamese and English)

> Source: owner request 2026-10-29 ("tính năng chuyển ngôn ngữ Việt → Anh, kèm bảng dịch đầy đủ cho mọi màn hình").
> Status: **proposal**. This is the "adopting i18next is its own decision" that CLAUDE.md (UX Copy) defers; nothing is built yet.
> Clients: `mobile/` only. `frontend/` (web) is out of scope. Backend and AI service changes are listed per phase (§7).
> Cross-cutting: no F-code of its own; touches F-10 (notifications) and every mobile screen. Scenario prefix `S-LNG-NN`, task prefix `LNG`.
> Translation table: [translations.md](./translations.md) (conventions + common keys) and 11 area files linked from it, about 1,390 keys over 1,848 rows.

## 1. Context

Every string in the mobile app is Vietnamese, hardcoded in components (1,588 literals in 307 files on 2026-10-29). Some users of the household app read English more comfortably, and a few screens already leak English (the `budget_exceeded` notification is rendered in English by the backend, while the other notification types are Vietnamese).

This feature lets a User pick **Tiếng Việt** or **English** for the app's UI on their phone, and puts in the i18n layer that every later screen uses.

Actor: **User**, anyone using the app on their phone, signed in or not (the login screens are translated too). Admin-only screens follow the same setting.

Users today write Vietnamese to the assistant, and the backend and AI service answer in Vietnamese. Phase 1 changes only the app's own text. Text that the server writes is handled in Phases 2 and 3 (§5.6–5.8).

## 2. Decisions

| # | Decision | Why |
|---|---|---|
| D-01 | **i18next + react-i18next**, resources bundled in the JS bundle. No `expo-localization` in v1. | De-facto RN standard; plural/interpolation format the skill's `i18n-rules.md` and `lint_copy.py` already assume; pure JS, so the whole client side ships by OTA (no fingerprint change, §5.1). |
| D-02 | Two languages: `vi` (default, fallback) and `en`. | Scope of the request. Adding a third later starts from intent + glossary (`i18n-rules.md` §1). |
| D-03 | **Default is Vietnamese** on first launch, whatever the phone's language. | The user base is Vietnamese; many Vietnamese phones are set to English; the assistant parser reads Vietnamese. Following the phone would flip most users to EN without asking. A "follow phone" option is Open Question 2. |
| D-04 | The choice is **per device**, stored in `ui-prefs-store` (AsyncStorage), like the theme. Not reset by sign-out, account switch, or app PIN lockout. | One phone, one reader; the account registry already treats the device as the unit. No backend column needed in Phases 1–2. |
| D-05 | The picker lives in **Preferences** (`app/(app)/user-settings.tsx`, Settings → "Cài đặt người dùng"), as a "Ngôn ngữ / Language" section of two radio rows, each written in its own language ("Tiếng Việt", "English"). Applies on tap, no save step, no restart. | Same pattern as the theme tiles on that screen. Endonyms let someone who switched by mistake find the way back. |
| D-06 | The language is applied **before the splash hides**, and a switch re-renders in one transition. | Standing "no flash on render" rule: no frame of Vietnamese before English on launch, no half-translated frame on a switch. |
| D-07 | ⚠️ **Money formatting does not change with the language.** `formatCurrency` keeps following the currency (VND: "1.250.000 ₫"; others: "$1,250"), and the keypad keeps its separators. | `lib/currency.ts` and `lib/calculator/format.ts` deliberately tie separators to the currency; switching "." and "," by UI language is how a 1000× entry error happens. Revisit only with the keypad (Open Question 3). |
| D-08 | Dates, weekday/month names, relative day labels and plural forms **do** follow the language (§5.10). Time stays 24-hour in both. | Pure display; no data risk. |
| D-09 | The client **never shows the server's `message`**. Errors map from `error_code` to a key; unknown codes fall back to the caller's key, then `errors.unknown` (§5.6). | `i18n-rules.md` §6. The `message` is a mix of Vietnamese sentences and English log fragments today. |
| D-10 | **Notifications are rendered by the client** from `type` + `params`; the stored title/body is only the fallback (§5.7). | Rows are stored once in one language. Rendering at read time also fixes today's mixed EN/VI list. |
| D-11 | **System categories** show `categories.system.<system_key>`; user-created categories are never translated (§5.9). | `system_key` exists since migration 019; names are seed data. |
| D-12 | Assistant replies, analysis answers, import reasons and other **server prose stay Vietnamese until Phase 3**, which adds `Accept-Language` handling to the backend (§5.8). Bubbles already in the chat keep the language they were written in. | ~250 literals across Go templates and AI prompts; a separate, backend-heavy piece of work. |
| D-13 | Migration is **incremental, one feature per PR**. The picker stays hidden (dev-only) until every screen is migrated and the hardcoded-string check is clean (§7). | A half-translated app in EN is worse than no EN. |
| D-14 | OS permission strings (`app.json`) and the Android/iOS system sheets (passkey, biometric, installer) follow the **phone's** language, not the app's. | Owned by the OS; changing them needs an APK (Open Question 7). |

## 3. Business rules

| # | Rule |
|---|---|
| BR-01 | Supported languages are exactly `vi` and `en`. Any other stored value (corrupt storage, older build) is read as `vi`. |
| BR-02 | Fresh install and every existing install updated to this version start in `vi`. Nothing changes for a User until they pick English. |
| BR-03 | The stored language is device-wide: every saved account on the phone, the login screens, the lock/PIN screens and the account-switch flow use it. |
| BR-04 | A switch is local and offline-safe: it never calls the server in Phases 1–2, never clears data, never signs out, and never discards a form being filled in. |
| BR-05 | Every user-visible string comes from the locale files. VI and EN have the same key set and the same placeholders per key (lint). Plural keys: VI `_other` only, EN `_one` + `_other`. |
| BR-06 | Values inside strings are formatted before interpolation: money by `formatCurrency` (D-07), dates by the date helpers (D-08). No currency symbol, date pattern or digit grouping is written in a locale file. |
| BR-07 | User data is never translated: wallet names, user category names, notes, item names, place names, saved phrases, display names. |
| BR-08 | The server `message` is never displayed (D-09). The money-state sentence ("Số dư chưa thay đổi." / "Your balance hasn't changed.") appears only where the write is atomic, as today. |
| BR-09 | A key missing in `en` falls back to `vi` at runtime (never a raw key on screen), and is reported in the debug log in development builds. |
| BR-10 | Text the app writes into persisted places from now on (chat bubbles the client composes, outbox failure reasons, notification params) is stored as key + params or code, not as a finished sentence, so it re-renders in the current language. Text stored before this change keeps its language. |

## 4. User stories

### US-01: Choose the app language

**As a** User, **I want** to switch the app between Vietnamese and English **so that** I can read it in the language I prefer.

Main flow
1. Settings → "Cài đặt người dùng" (EN "Preferences"). The screen shows a "Ngôn ngữ" section with two rows, "Tiếng Việt" (checked) and "English".
2. User taps "English".
3. App stores `en`, switches i18next, re-renders every mounted screen in one transition (D-06). The Preferences screen itself now reads "Preferences", "Language", "Appearance".
4. User goes back: Settings, the tab bar labels, and every other screen are in English.

| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-LNG-01 | App in `vi` | Tap "English" in Preferences | Whole UI in EN at once; "English" row checked; no restart, no save button | Happy path |
| S-LNG-02 | App in `en` | Tap "Tiếng Việt" | Whole UI back in VI | Endonym rows read the same in both languages |
| S-LNG-03 | App in `en` | Tap "English" again | Nothing changes, no re-render storm | Idempotent |
| S-LNG-04 | Transaction form open with a typed amount (another tab of the stack), user switches language | Return to the form | Amount, wallet, category, note unchanged; labels in the new language | BR-04 |
| S-LNG-05 | Offline | Switch language | Works; offline strip text switches too | Bundled resources |
| S-LNG-06 | TalkBack on | Focus a language row | Announces "Language: English, selected" (EN) / "Ngôn ngữ: Tiếng Việt, đã chọn" (VI), radio role | `userSettings.language.optionA11y` |

Edge cases
1. A toast already on screen keeps its text until it hides (toasts are 2–4 s; not worth re-rendering).
2. A confirm dialog open during a switch cannot happen from Preferences (dialogs are modal); dialogs opened afterwards are in the new language.
3. A calendar or month sheet is only mounted inside modals, so none is open during a switch; the next one opens with the new month/day names (`LocaleConfig.defaultLocale` updated on switch).

Definition of Done
- [ ] S-LNG-01..06 pass on an Android release APK and in Expo Go.
- [ ] The switch shows no intermediate frame mixing languages (screen recording, 60 fps, frame-by-frame).

### US-02: First launch and existing installs

**As a** User installing or updating the app, **I want** it to open in Vietnamese as today **so that** nothing changes until I choose.

| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-LNG-07 | Fresh install, phone set to English | Open app | Login screen in VI | D-03 |
| S-LNG-08 | Existing install receives the OTA with this feature | Open app | Every screen as before, in VI; `ui-prefs` migrates v3→v4 with `language: "vi"` | BR-02 |
| S-LNG-09 | Storage holds `language: "fr"` (tampered/older build) | Open app | VI; value rewritten to `vi` on next write | BR-01 |

DoD: [ ] S-LNG-07..09 pass; [ ] persisted-store migration covered by a unit test of the `migrate` function.

### US-03: The choice sticks

**As a** User who picked English, **I want** the app to stay in English **so that** I don't set it again.

| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-LNG-10 | `en` chosen | Kill and reopen the app | Splash, then EN; no VI frame | D-06 |
| S-LNG-11 | `en` chosen | Receive an OTA update | Still EN | Stored in AsyncStorage, outside the bundle |
| S-LNG-12 | `en`, two saved accounts | Switch account (PIN/biometric) | Switch dialog, PIN screen and the other account's Home in EN | BR-03 |
| S-LNG-13 | `en` | Sign out of the last account | Login screen in EN | D-04 |
| S-LNG-14 | `en` | PIN wrong 5 times (every account signed out) | Login screen in EN | `ui-prefs` is not session-scoped |

DoD: [ ] S-LNG-10..14 pass.

### US-04: Dates, counts and amounts read naturally

**As a** User reading in English, **I want** dates, plurals and labels to follow English conventions **so that** the app does not read like a word-for-word translation.

| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-LNG-15 | `en`, a transaction today and one yesterday | Open Transactions | Day headers "Today", "Yesterday", then "Sep 6, 2026" | VI unchanged: "Hôm nay", "Hôm qua", "06 Th09, 2026" |
| S-LNG-16 | `en` | Open any date picker | Month title "October 2026", weekday row "Sun Mon … Sat" | VI: "Tháng 10, 2026", "CN T2 … T7" |
| S-LNG-17 | `en`, filter with 1 category, then 3 | Look at the filter chip | "1 category", "3 categories" | VI "1 danh mục", "3 danh mục" (one form) |
| S-LNG-18 | `en`, a VND wallet | Any amount | "1.250.000 ₫", exactly as in VI | D-07 ⚠️ |
| S-LNG-19 | `en`, a USD wallet | Any amount | "$1,250" as today | D-07 |
| S-LNG-20 | `en` | Long-press an amount (reveal popup) | Exact amount shown, spelled out in English underneath ("one million two hundred fifty thousand dong") | Open Question 4 (resolved 2026-11-02) |

Edge cases
1. Hermes lacks some `Intl` APIs (`PluralRules`, `RelativeTimeFormat`, `formatRange` on some builds). Plurals use a polyfill if `Intl.PluralRules` is missing; relative labels and ranges are built by the helpers, not `Intl` (§5.10).
2. Times stay "14:05" in EN (D-08); 12-hour is Open Question 5.
3. A date near midnight is labelled by the device's local day in both languages (existing `calendarDay` rule; the language does not move it).

DoD: [ ] S-LNG-15..20 pass; [ ] `format-date.ts` helpers have per-language unit tests for today/yesterday/older/ranges across a year boundary.

### US-05: Errors in my language

**As a** User, **I want** errors in the language I chose **so that** I know what failed and what to do.

Resolver: §5.6. Keys: [translations-errors.md](./translations-errors.md).

| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-LNG-21 | `en`, offline | Save something that needs the network | "Connect to the internet to do this." | `errors.needsConnection` |
| S-LNG-22 | `en` | Create a budget on a category that has one | "This category already has a budget." | `BUDGET_ALREADY_EXISTS` (409); server `message` ignored |
| S-LNG-23 | `en` | Server answers a code the app does not know | The screen's own fallback ("Couldn't save the budget."), else "Something went wrong. Try again." | Never the raw `message` |
| S-LNG-24 | `vi` | Same as S-LNG-22 | Proposed VI "Danh mục này đã có ngân sách." instead of today's lower-case "danh mục này đã có một ngân sách đang hoạt động" | VI copy improves as a side effect; owner to approve (Open Question 8) |
| S-LNG-25 | `en`, change password | Wrong current password | "Current password is incorrect." | `WRONG_CURRENT_PASSWORD` |

Edge cases
1. `INVALID_USERNAME` / `INVALID_FULL_NAME` / image `INVALID_INPUT` carry the reason only in the VI `message` today. Until the backend sends `details.reason` (Phase 2 backend task), EN shows the code-level fallback ("This username can't be used.") and VI keeps showing the server sentence (transitional exception to D-09, removed when the reasons ship).
2. `WEAK_PASSWORD` has two causes (too short, too long); the client already checks both before sending, so the server copy is a backstop.
3. Rate-limit copy with a known window (login, password reset) keeps its specific key and passes `{{minutes}}`.

DoD: [ ] every `error_code` in `backend/internal/common` has a row in translations-errors.md and a key in both locale files (script check); [ ] `getErrorMessage` no longer returns `response.data.message`.

### US-06: Data the server stores, shown in my language

**As a** User reading in English, **I want** notifications and built-in category names in English **so that** lists don't mix two languages.

| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-LNG-26 | `en`, system category "Ăn uống" (`system_key` food) | Any list, chart, picker or toast that names it | "Food & drink" | D-11 |
| S-LNG-27 | `en`, user category "Đi chợ" | Same | "Đi chợ" | BR-07 |
| S-LNG-28 | `en`, a `wallet_invite` notification created after Phase 2 | Open Notifications | "Shared wallet invitation" / "Lan invited you to Gia đình." | D-10 |
| S-LNG-29 | `en`, a `wallet_invite` row created before Phase 2 (no params) | Open Notifications | Stored VI text, unchanged | Fallback; BR-10 |
| S-LNG-30 | `vi`, a `budget_exceeded` row created after Phase 2 | Open Notifications | "Ăn uống vượt ngân sách" / "Đã chi 1.200.000 ₫ trên hạn mức 1.000.000 ₫." (no longer English) | Fixes today's mixed list |

Edge cases
1. A system category the User soft-deleted is not shown anywhere, so it needs no name.
2. A DTO that carries `category_name` but whose `category_id` is not in the cached category list (e.g. a shared wallet's owner category): show `category_name` as sent.
3. ⚠️ The AI chat stores the category **name** in a proposal's draft; on confirm the app sends `category_id`, never the name, so a translated label cannot change what is saved.

DoD: [ ] S-LNG-26..30 pass; [ ] one `categoryLabel(category)` helper used by every screen that prints a category name (grep shows no other `category.name` / `category_name` render).

### US-07 (Phase 3): Server-written replies in my language

**As a** User reading in English, **I want** the assistant's replies, analysis answers and import reasons in English **so that** the conversation matches the UI.

API: every request carries `Accept-Language: vi|en` (sent from Phase 1; ignored by the backend until Phase 3). Backend middleware reads it into the request context; template renderers pick the language. No new endpoint.

| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-LNG-31 | `en` | Ask "Tháng này tiêu bao nhiêu?" chip (EN label "How much did I spend this month?") | Answer sentence, period labels and follow-up chips in EN; figures identical to VI | Templates over computed numbers, no LLM |
| S-LNG-32 | `en` | Type a Vietnamese transaction ("ăn trưa 50k") | Parsed as today; lead-in "Check the transaction below before saving." | Input language independent of UI language |
| S-LNG-33 | Chat has VI bubbles, user switches to `en` | Scroll up | Old bubbles stay VI; new ones EN | D-12 |
| S-LNG-34 | `en`, import an Excel file with a bad row | Preview | "Row 12: amount is missing" style reasons from a reason code | Backend returns codes + params |

DoD: [ ] every Go template in the §7 inventory of translations-errors.md has an EN version; [ ] the reply validator (`llm-runtime-prompt.md` "Tầng kiểm tra") runs on EN output too.

### US-08 (Developer): No new hardcoded text

**As a** developer, **I want** the build to catch hardcoded Vietnamese and key drift **so that** English never silently falls behind.

| ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-LNG-35 | A component with `<Text>Đã lưu</Text>` | Run `npm run check-i18n` | Fails with file:line | AST scan, same method as the inventory |
| S-LNG-36 | `en/*.json` missing a key that `vi` has, or a placeholder differs | Run `lint_copy.py mobile/src/locales` | ERROR | Existing skill script |
| S-LNG-37 | `t("wallets.form.titel")` (typo) | `tsc` | Type error | Typed keys (§5.2) |

DoD: [ ] the three checks run in the release script (`npm run apk` / `ota:publish` preflight) and fail it on error.

## 5. Technical design

### 5.1 Libraries and compatibility (Expo SDK 54, RN 0.81, React 19.1, Hermes)

- `i18next` and `react-i18next` (current majors at install time; react-i18next 15+ supports React 19). Both pure JS: no autolinked native module, so `runtimeVersion: { policy: "fingerprint" }` does not change and Phases 0–2 ship by OTA (`npm run ota:publish`). Verify with `npm run ota:check` / the fingerprint diff after `npm install`.
- `intl-pluralrules` polyfill, loaded only when `typeof Intl.PluralRules === "undefined"` (Hermes builds have shipped without it; i18next v4 plurals need it). Pure JS. Check on the release APK in Phase 0.
- `expo-localization`: **not needed in v1** (D-03, default is VI). It is a native module: adding it changes the fingerprint and needs a new APK. Add it with the next planned APK only if "follow phone" is chosen (Open Question 2).
- No ICU MessageFormat plugin: i18next's own `{{var}}` + `_one/_other` is what `lint_copy.py` parses.

### 5.2 Locale resources and keys

```
mobile/src/locales/
  index.ts             # builds resources, exports SUPPORTED_LANGUAGES
  vi/common.json  en/common.json      # common.*, nav.*
  vi/errors.json  en/errors.json      # errors.*
  vi/auth.json    en/auth.json        # auth.*, accounts.*
  ... one file per top-level namespace in translations.md
mobile/src/lib/i18n.ts  # init + helpers (t outside React, changeLanguage)
```

- One i18next namespace (`translation`); each file holds its top-level object (`{ "wallets": { … } }`) and `index.ts` deep-merges them. Keys in code are the full dotted keys from the tables (`t("wallets.form.title")`), so a grep for a key finds both the table row and the call site.
- `lint_copy.py` reads this layout as is (`locales/vi/common.json` form).
- Typed keys: `declare module "i18next" { interface CustomTypeOptions { defaultNS: "translation"; resources: { translation: typeof vi } } }`, with `vi` as the source of truth. A missing or misspelled key is a `tsc` error.
- Init (synchronous, resources bundled): `lng` = stored language, `fallbackLng: "vi"`, `supportedLngs: ["vi", "en"]`, `interpolation.escapeValue: false` (React escapes), `skipOnVariables` left at its default (`i18n-rules.md` §3), `returnNull: false`, `react.useSuspense: false`, synchronous init (`initAsync: false`). Missing keys are logged to the existing debug log store in dev.
- Size: ~1,390 keys × 2 languages ≈ 150–200 KB of JSON in the bundle; no lazy loading needed.
- The language-option labels ("Tiếng Việt", "English") are constants in `SUPPORTED_LANGUAGES`, not translated keys.

### 5.3 Language state and startup

- `ui-prefs-store.ts` gains `language: "vi" | "en"` + `setLanguage`. Persist `version` 3 → 4; `migrate` sets `language: "vi"` when absent or not in the supported list (BR-01).
- `lib/i18n.ts` subscribes to the store: on hydration and on every `setLanguage` it calls `i18n.changeLanguage` and sets `LocaleConfig.defaultLocale` for `react-native-calendars`.
- `app/_layout.tsx` already holds the splash until `useUiPrefsHydrated()`; it additionally waits for `i18n.language === store.language` (one tick after hydration), so the first visible frame is already in the stored language (D-06). Import `@/lib/i18n` at the top of the root layout so `t` works before any screen mounts.
- Not session-scoped: `session-scoped-reset.ts` must not touch it (BR-03, S-LNG-13/14).

### 5.4 Switching at runtime

- Components use `useTranslation()`; a language change re-renders them.
- Modules outside React (`*-copy.ts`, `*-dialogs.ts`, toast helpers, `login-error.ts`, `save-error-message.ts`, `pin-copy.ts`, `password-reset-copy.ts`...) export **functions or key maps**, never translated constants evaluated at import time: `export const SWITCH_COPY = { generic: "accounts.switch.generic" } as const` and the caller does `t(SWITCH_COPY.generic)`, or `i18n.t(...)` at call time.
- The switch reuses the theme switch's snapshot crossfade (`useThemeTransition`) so the change reads as one transition (D-06).
- TanStack Query cache is untouched in Phases 1–2 (no server text depends on the language). Phase 3: after a switch, invalidate the queries whose payload carries server prose (analytics answers, import previews); the persisted offline cache keeps old-language prose until refetched online (edge case §6.6).

### 5.5 Where the switch lives

Preferences (`app/(app)/user-settings.tsx`), new `ListSection` "Ngôn ngữ" between the theme picker ("Giao diện") and "Giao dịch". Two rows with a check mark on the selected one, `accessibilityRole="radio"` + `accessibilityState.selected`. Keys (in [translations-settings.md](./translations-settings.md), Preferences):

| Key | VI | EN |
|---|---|---|
| `userSettings.language.header` | Ngôn ngữ | Language |
| `userSettings.language.option.vi` | Tiếng Việt | Tiếng Việt |
| `userSettings.language.option.en` | English | English |
| `userSettings.language.optionA11y` | Ngôn ngữ: {{language}} | Language: {{language}} |
| `userSettings.language.footer` (optional) | Tin nhắn trợ lý và thông báo đã có giữ nguyên ngôn ngữ cũ. | Assistant replies and notifications you already have keep their language. |

During migration (D-13) the section renders only when a dev flag is on (Developer screen toggle, same mechanism as the debug bubble).

### 5.6 Errors from the backend

Replace `getErrorMessage(error, fallback)` (`lib/api-envelope.ts:44`) with `errorText(error, fallbackKey)`:

1. `isNetworkError` → `errors.network`.
2. Screen-specific map passed by the caller (login, transaction save, access requests, image capture) → its key.
3. `errors.code.<CODE>` exists → that key, placeholders from `details` (`available_at` → `{{minutes}}`, `retry_after_seconds` → `{{minutes}}`).
4. Caller's `fallbackKey`, else `errors.unknown`.

Every call site of `getErrorMessage` (and `capitalize(getErrorMessage(...))` in `switch-account.ts:210`) moves to `errorText`. The outbox stores the failing `error_code` (and `details`) instead of `error_message`, so a queued failure re-renders in the current language (BR-10); entries already stored keep their text.

Backend tasks (Phase 2, small): add `details.reason` to `INVALID_USERNAME`, `INVALID_FULL_NAME`, `WEAK_PASSWORD`; give the image upload failures their own codes (`IMAGE_MISSING`, `IMAGE_UNREADABLE`) instead of `INVALID_INPUT` with a VI sentence. The `message` field stays for logs and old builds.

### 5.7 Notifications

Today `notifications.title`/`body` are rendered once at creation (`notification_service.go:128`, `wallet_member_service.go:101/200`, `access_request_service.go:81`).

Phase 2:
- Backend: next free migration adds `params JSONB NULL` to `notifications`; the four creators fill it (`budget_exceeded`: `category_id`, `category_name`, `category_system_key`, `spent`, `limit`, `currency`; `access_request`: `requester_email`; `wallet_invite`: `owner_name`, `wallet_name`; `wallet_member_joined`: `member_name`, `wallet_name`). Money stays integer minor units in params (no float). `GET /api/v1/notifications` and `GET /api/v1/notifications/:id` return `params`. Title/body keep being stored (fallback, old builds).
- Client: `notificationText(n)` renders `notifications.type.<type>.title/body` with formatted params when `params` is present and the type is known; otherwise the stored text (S-LNG-29). Keys: [translations-errors.md](./translations-errors.md) §5.
- The new `budget_exceeded` copy drops "monthly" (budgets follow the user's cycle since the v2 wizard).

### 5.8 Server-rendered text and the AI service (Phase 3)

- Client: axios request interceptor sends `Accept-Language: <stored language>` on every call from Phase 1 (harmless before the backend reads it).
- Backend: middleware parses it to `vi` | `en` (anything else → `vi`) into the request context. Every template in the inventory (translations-errors.md §7: chat lead-ins, photo replies, analytics/consult answers, period labels, follow-ups, anomaly answers, budget wizard notices, import reasons) gets a per-language table keyed like the client (`analytics.reply.sum`...). The numbers are computed before rendering, so EN output has exactly the VI figures.
- AI service: extraction prompts and Vietnamese NLU are unchanged; the user can keep typing Vietnamese in EN mode (S-LNG-32). Category name suggestion (`/ai/suggest-category-name`) receives a `locale` so a suggested name matches the UI. EN input understanding is Open Question 6.
- Replies are stored as text (chat thread sync, migration 011/015) and keep the language they were written in (D-12). Bubbles the **client** composes (`reply-fanout.ts`, `message-copy.ts`, `removal-copy.ts`) are stored as key + params from Phase 1 (BR-10).
- `users.locale` is not needed for any of this (the header travels with each request). It becomes necessary only for push or email (§5.12).

### 5.9 System categories and seed data

- `categoryLabel(category)` → `t("categories.system." + system_key)` when `system_key` is set (system category), else `category.name`.
- DTOs that embed `category_name` (transactions, budgets, reports, analytics) also carry `category_id`; the helper looks the category up in the cached categories query (`/categories`, already loaded for pickers and persisted for offline). No backend change.
- 14 system keys today: food, transport, entertainment, shopping, health, housing, utilities, salary, bonus, investment, savings, children_education, other, transfer. A new system category needs a key in both locale files in the same PR as its migration.
- Wallet types, adjustment kinds, transaction types are client enums already (`common.walletType.*`, `common.adjustment.*`, `common.txType.*`).

### 5.10 Formatting

| What | VI (unchanged) | EN | How |
|---|---|---|---|
| Money | "1.250.000 ₫", "$1,250", compact "~7m100k" | Same as VI | D-07 ⚠️. `formatCurrency*` and the keypad untouched |
| Day label | Hôm nay / Hôm qua / 31/10/2026 | Today / Yesterday / Oct 31, 2026 | `dayLabel(iso)` reads the active language; the unused English `dayLabel` is removed |
| Group header | 06 Th09, 2026 | Sep 6, 2026 | `Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" })`, cached per language like the currency formatters (warm-up in `warm-up-formatting.ts`) |
| Date range | 01/09 – 30/09/2026 | Sep 1 – Sep 30, 2026 | Built by the helper (no `formatRange` on Hermes) |
| Month + year | Tháng 10, 2026 | October 2026 | Month names from the locale arrays (`format.calendar.*`) |
| Calendar | Tháng 1…12, CN T2…T7 | January…December, Sun…Sat | `LocaleConfig.locales.vi/en` from the locale files; `defaultLocale` follows the language |
| Time | 14:05 | 14:05 | 24-hour in both (Open Question 5) |
| Plurals | `{{count}} danh mục` (`_other`) | `{{count}} category` / `{{count}} categories` | i18next v4 + `Intl.PluralRules` (polyfill if missing). Zero is an empty state, not a plural |
| Percent | 80% | 80% | `lib/percent.ts`, unchanged |
| Amount in words | "một triệu hai trăm nghìn đồng" | "one million two hundred thousand dong" | `amountInWords` (`lib/amount-in-words.ts`) picks `number-to-words-vi.ts` / `number-to-words-en.ts`; units from `format.amountWords.currency.*` |

VI date output stays hand-built: `Intl` for `vi` gives "tháng 10" and "Th 2", not the app's "Tháng 10" and "T2".

### 5.11 Code conventions for the migration

- One string = one key; sentences built from fragments (the `refactor:` rows in the tables) become one key with named placeholders.
- `<Trans>` with `components` for inline bold/links; no markup inside strings.
- `accessibilityLabel` / `accessibilityHint` go through `t()` like visible text.
- Keys are stable once shipped; renaming a key is a breaking change for the other language.
- Copy changes in VI made during migration are limited to the "proposed VI" fixes flagged in the tables and approved by the owner (Open Question 8). Everything else is moved verbatim.

### 5.12 Push notifications and emails

The app has no push (no `expo-notifications`); notifications are in-app only (§5.7). Emails (activation, access request, approval, password reset) and the activation web pages stay Vietnamese: invite emails go to people who have no app setting yet. If push or EN emails are added later, they need `users.locale` (`PATCH /api/v1/users/me { locale }`, written when the User switches while signed in) and backend templates; out of scope here.

## 6. Edge cases

1. **Untranslated string reached in EN** (missed during migration): shows the VI text via `fallbackLng` (BR-09), never a key; dev log records the key. The picker stays hidden until `check-i18n` is clean (D-13).
2. **Long EN strings**: EN is usually shorter than VI, but some labels grow ("Chi" → "Spending"). Chips, tab labels, segmented controls and buttons are checked in EN at 360 dp width; truncation rules from the skill (ellipsis at the end for names) apply.
3. **User data inside sentences**: wallet/category names of 60 characters, emoji or `{{…}}` text stay literal (`skipOnVariables`), and are cut at the UI layer.
4. **Device name fallback**: `device-identity.ts` sends a VI fallback device name that the server stores; another device would show it in the language active at sign-in. Send an empty name instead and render `security.devices.unnamed` at display time.
5. **AI drafts and examples in EN mode**: the recording-mode example chips and the photo caption placeholder are text the user sends to the parser. They stay Vietnamese examples in EN mode until EN input is supported (Open Question 6), with EN UI around them.
6. **Offline after a switch (Phase 3)**: persisted query data rendered by the server keeps the old language until the next online refetch; nothing breaks, nothing is lost.
7. **Shared wallet with a member using the other language**: each phone renders its own UI; stored notifications follow D-10 per reader. Server prose (Phase 3) follows each requester's header.
8. **OS sheets**: passkey creation, biometric prompt chrome, the APK installer and Android Settings paths ("khóa truy cập") follow the phone's language. Copy that names an OS button keeps the OS wording and says so in the table notes.
9. ⚠️ **Amount entry**: no change to separators or parsing (D-07). A regression test types "1.000.000" in a VND wallet in both languages and expects 100,000,000 xu.
10. **Screen reader voice**: TalkBack reads with the phone's TTS voice; a VI-language phone reading the EN UI (or the reverse) is the user's own setup and out of the app's control.

## 7. Rollout and migration plan

| Phase | Content | Ships by | Visible to users |
|---|---|---|---|
| 0 Foundation | Install i18next/react-i18next (+ polyfill check), `lib/i18n.ts`, locale folder, `common`/`nav`/`errors` keys, `language` in ui-prefs (v4), splash gating, `Accept-Language` header, `errorText` resolver, `check-i18n` script, picker behind the dev flag | OTA | No |
| 1 Screens | Migrate one area per PR in this order: shared components + navigation → auth/accounts → Home → Transactions → Wallets → Insights/Budgets → Settings/Security → Categories/History/Notifications/Members → Assistant → Budget wizard → Developer/debug. Each PR: replace literals with keys from its translations file, add VI+EN keys, apply `refactor:` rows, run `check-i18n`, `lint_copy.py`, `tsc`, smoke both languages | OTA | No |
| 1.5 Launch | `check-i18n` clean for app code; EN walkthrough of every route; glossary updated with the new EN terms (§9); remove the dev flag | OTA | **Yes** |
| 2 Server data, client-side | `categoryLabel` everywhere; notifications `params` (backend migration + DTO) and client rendering; `details.reason` and image codes in the backend; outbox stores codes | OTA + backend deploy | Yes |
| 3 Server prose | Backend locale middleware + EN templates; AI service `locale` for category suggestion; invalidate localized queries on switch | Backend deploy (+ OTA) | Yes |
| Later | `expo-localization` + "follow phone" option, per-language OS permission strings | APK | If chosen |

Per-PR checklist (Phase 1): no Vietnamese literal left in the touched files (script); every key in both languages with the same placeholders; no module-level translated constants; plural keys for every count; EN read once on a phone; VI screen unchanged except approved "proposed VI" fixes.

Effort shape: ~1,390 keys, of which ~125 common. The heaviest areas are Transactions (259 rows), Assistant (246), Settings/Security (216), Wallets (172), Shared (171).

## 8. Tooling and QA

- `npm run check-i18n` (new, `mobile/scripts/check-i18n.mjs`): the TypeScript-AST scan used to build the inventory (string/template literals and JSX text with Vietnamese letters, comments excluded) over `app/` and `src/`, minus an allowlist (parsing vocabularies such as `draft-from-text.ts`, `number-to-words-vi.ts`, test fixtures). Prints file:line; non-zero exit when anything is found. Also verifies that every backend `ErrCode*` constant has an `errors.code.*` key.
- `python .claude/skills/pfm-ux-copy/scripts/lint_copy.py mobile/src/locales`: key/placeholder parity, plural forms, banned words, length per slot. ERROR blocks merge. Note: the current VI has lint ERRORs ("Vui lòng", "—"); those are exactly the rows flagged with a proposed VI fix (Open Question 8).
- `tsc` with typed keys.
- Manual matrix per release: every route in `vi` and `en`; switch while offline; account switch in `en`; PIN lockout in `en`; one long wallet name; TalkBack on the language rows.
- Optional during migration: a pseudo-locale in dev builds (EN with brackets and +30% length) to spot layout breaks and leftovers.

## 9. Follow-ups to project docs

- CLAUDE.md "UX Copy": replace "neither client has an i18n layer" with the mobile setup (locale folder, `t()` rule, `check-i18n`), keep the web statement.
- `glossary.md`: add the EN terms the tables had to coin, for owner approval: Preferences (Cài đặt người dùng), Money (settings group "Tài chính"), Current (account in use), Upcoming transactions, Top spending, Within budget, Left today, limit (hạn mức), buffer (dự phòng), fixed costs, set aside, living situation, cycle, payday, receiving wallet (ví nhận), item details, available balance, current balance, starting balance, suggestion (đề xuất, an AI draft), low confidence, Join/Decline (invitation), withdraw invitation, remove from wallet, make view only / allow recording, Yours (category group), awaiting activation, Active, Locked, sign out other devices (own account) vs sign out everywhere (admin, a member's devices), unnamed device, Back online.
- `i18n-rules.md`: note D-07 (money format follows the currency, not the language) since its §5 suggests `Intl.NumberFormat(locale, …)` with the user locale.

## 10. Out of scope

- Web client (`frontend/`).
- Languages other than VI and EN; right-to-left.
- Translating user data (wallet names, user categories, notes, items, places, saved phrases).
- English input understanding in the assistant parser and the fixed-cost text box (Open Question 6).
- Emails, the activation/approval web pages, and push (none exists).
- Changing money formatting or keypad separators by language (D-07).
- Per-account language synced to the server.

## 11. Open questions

1. **Approve the EN copy and coined terms** (§9). The tables are a proposal; the owner reviews per area before its Phase 1 PR.
2. **"Follow phone" option?** Proposed: no for v1 (D-03). If yes: a third row "Theo máy / Use phone language", `expo-localization` in the next APK.
3. ⚠️ **EN money format**: keep "1.250.000 ₫" in EN (proposed, D-07) or move to "1,250,000 ₫" (the skill's EN examples) together with the keypad, as its own change with its own tests.
4. **Amount in words in EN**: hide the line (proposed for v1) or write an EN converter ("one million two hundred fifty thousand dong"). Resolved 2026-11-02: EN converter (`number-to-words-en.ts`, US short scale, no "and").
5. **12-hour time in EN**: keep 24-hour (proposed) or follow en-US "2:05 PM".
6. **English input to the assistant and the fixed-costs box**: today both read Vietnamese only ("50k", "triệu", "ăn trưa"). Keep VI examples in EN mode (proposed) or extend the parser/prompts and examples to English.
7. **OS permission strings in English** (`app.json` → Expo `locales`, needs an APK): do it with the next APK, or leave VI.
8. **VI copy fixes during migration**: many current VI strings break the skill ("Vui lòng", "—", "thành công", lower-case server messages) and fail `lint_copy.py`. Proposed: apply the "proposed VI" from the table notes in the same PR that moves the string, with owner approval per area; otherwise run lint with a temporary baseline.
9. **EN spelling**: the glossary fixes "card colour" (British) while the rest of the EN copy is US. Pick one (proposed: US, change the glossary to "card color").
10. **Language per device vs per account**: proposed per device (D-04). Revisit if push/email ever need `users.locale`.
11. **Insights naming**: glossary open decision #3 ("Phân tích" / "Tổng quan" / "Thống kê") applies to EN too; the tables use "Insights".
