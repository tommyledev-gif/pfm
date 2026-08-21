# Feature Spec: Mobile Debug Console (floating bubble + fullscreen log viewer)

> Source: explicit user request (not an SRS-numbered feature) — "thêm 1 cái FAB như là bubble có thể move dc quanh app, khi open thì nó display fullscreen là các log, ở trong screen nào, những j đã xảy ra dùm => để debug mobile".
> Status: new — `mobile/` only. No backend/web changes.
> Related: [mobile-session-refresh](../mobile-session-refresh/spec.md) (the refresh-token retry/failure events are exactly the kind of thing this console must surface); `mobile/src/lib/axios.ts` (existing `__DEV__`-only `console.error` logging this feature generalizes into a persistent, always-on log).

## Context

QA/the user test `mobile/` only via EAS-built `.apk`/`.ipa` on a real device (`CLAUDE.md`: "Không deploy App Store/Play Store — chỉ build .apk/.ipa để test") — there is no Metro/Chrome DevTools console attached to that build. Today the only diagnostic signal is `mobile/src/lib/axios.ts`'s `console.error` calls, which are gated behind `__DEV__` (`false` in a release `.apk`) and invisible without a attached debugger anyway. This feature adds an in-app, always-visible diagnostic tool: a small draggable circular button ("bubble") that floats above every screen; tapping it opens a fullscreen log viewer showing which screen the user is currently on and a chronological log of what has happened (navigation changes, API calls, API errors, uncaught JS errors).

**Resolved design decisions:**

1. **In-memory ring buffer, not persisted storage.** Logs live only for the current app session (cleared on cold start/app kill). Persisting across restarts (e.g. AsyncStorage/SQLite) is unnecessary complexity for a live debugging tool — the user reproduces the bug, then immediately opens the console. See Out of Scope.
2. **No new native dependency.** A drag-anywhere bubble does not require `react-native-gesture-handler` or `react-native-reanimated` (neither is currently installed — `mobile/package.json`) — React Native core's `PanResponder` + `Animated.ValueXY` is sufficient for single-finger drag and is what this spec mandates, to avoid a new native dependency (which would need a fresh EAS build to test given SDK 54 pinning constraints, `mobile/AGENTS.md`).
3. **Visible in every build, not just `__DEV__`.** Unlike the existing `axios.ts` console logging, the bubble itself must render in release `.apk`/`.ipa` builds too — that is the only build the user actually tests on (Context above). Explicit assumption, flagged in Open Questions #1 since a visible always-on debug affordance in a "production-like" build is a deliberate but unusual choice.
4. **Rendered once, globally, in the root layout — not per-screen.** Mounted in `app/_layout.tsx` above the `Stack`, so it survives navigation between `(auth)` and `(app)` groups and never needs to be added to each screen individually. It is visible on the login screen too, since login/session failures are exactly what needs debugging (see [mobile-session-refresh](../mobile-session-refresh/spec.md)).
5. **Log sources for this MVP: navigation changes, API request/response/error, and uncaught JS errors** — not a full `console.log` override. Capturing every `console.log` call app-wide risks flooding the buffer with noise from third-party libraries; this spec scopes to the three sources that answer the user's own framing ("screen nào" = navigation, "những j đã xảy ra" = API activity/errors).

Actor: **Developer/QA tester** running the mobile app (any build), diagnosing a bug live on-device.

## Preconditions (feature-level)

- App has mounted past the root layout (`app/_layout.tsx`) — the bubble is available before and after login.
- No feature flag / build-time toggle: the bubble ships in every build (Context decision #3).

## Domain Concept: Log Entry

| Field | Meaning |
|---|---|
| `id` | Monotonic sequence number (not UUID — purely for React `key`/ordering, never sent anywhere) |
| `timestamp` | `Date` captured at append time, device-local clock (this is an on-device debug tool, not a server record — no UTC-normalization requirement) |
| `category` | `"navigation"` \| `"api"` \| `"error"` |
| `summary` | One-line string (e.g. `"→ /transactions"`, `"200 GET /wallets/"`, `"401 GET /transactions/"`, `"TypeError: ..."`) |
| `detail` | Optional structured payload (request/response body, stack trace) shown only in the expanded view |

**Business invariant**: the ring buffer holds at most **500** entries — once full, the oldest entry is dropped as a new one is appended (FIFO), so a long-running debug session cannot grow memory unboundedly.

---

## US-01: Open and Use the Debug Console

**As a** developer/QA tester,
**I want** a persistent, draggable on-screen control that opens a fullscreen log of navigation/API/error activity,
**so that** I can diagnose a bug on a real device build without an attached debugger.

**Client:** `mobile/` only — no API.

### Preconditions
- Same as feature-level preconditions above; no per-scenario precondition beyond that.

### Main Flow
1. App launches; root layout mounts a `DebugLogProvider` (log ring buffer, see Domain Concept) and a `DebugBubble` component above the navigation `Stack`.
2. As the user interacts with the app, three sources append entries to the log store: (a) `expo-router`'s active pathname changes → a `navigation` entry; (b) every `apiClient` request/response/error (via existing axios interceptors) → an `api` entry; (c) any uncaught JS error via a global error handler → an `error` entry.
3. The bubble renders as a small floating circle, default position bottom-right, above all screen content, draggable via single-finger touch-and-drag (`PanResponder`) to anywhere on screen; releasing leaves it at the drop position for the rest of the app session (not persisted across restarts).
4. User taps the bubble (a tap = touch without significant movement, distinguished from a drag).
5. App opens a fullscreen modal showing: the current route/screen name at the top, and a reverse-chronological list of log entries below (newest first), each showing a relative timestamp, a category badge (`nav`/`api`/`error`), and a one-line summary.
6. User taps a log entry to expand it and see full detail (e.g. full request URL/method/status/response body for an `api` entry, or stack trace for an `error` entry).
7. User can clear the log (empties the ring buffer) or copy/share the full log as text (via React Native's built-in `Share` API — no new dependency) to send off-device for a bug report.
8. User closes the fullscreen modal (back button/close icon); the bubble returns to its last dragged position.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-DBG-01 | App just launched, on the login screen | User looks at the screen | A small draggable bubble is visible, floating above the login form | Bubble renders pre-login (Context decision #4) |
| S-DBG-02 | Bubble is at its default bottom-right position | User touches the bubble and drags it to the top-left of the screen, then releases | Bubble stays at the top-left drop position | Drag-to-reposition |
| S-DBG-03 | Bubble is at some position | User taps the bubble without dragging | Fullscreen log viewer opens | Tap vs. drag disambiguation |
| S-DBG-04 | User is on the Transactions screen and just navigated there from Home | User opens the log viewer | Log viewer's current-screen indicator shows the Transactions route; the log list has a `navigation` entry `"→ /transactions"` near the top | Screen-awareness |
| S-DBG-05 | An API call to `GET /wallets/` succeeds with `200` | User opens the log viewer | An `api` entry shows `"200 GET /wallets/"` | Success calls are logged too, not just errors |
| S-DBG-06 | An API call fails with `401` (e.g. expired session) | User opens the log viewer | An `api` entry shows `"401 GET /transactions/"`, expandable to see the full response body | This is the primary use case — diagnosing the logout-after-a-few-minutes bug |
| S-DBG-07 | An uncaught JS exception is thrown anywhere in the app | User opens the log viewer | An `error` entry appears with the error message, expandable to the stack trace | Covers crashes, not just network issues |
| S-DBG-08 | Log viewer has entries | User taps "Clear" | Log list becomes empty; a fresh entry for the clear action itself is not required | Reset for a new repro attempt |
| S-DBG-09 | Log viewer has entries | User taps "Share"/"Copy" | Device's native share sheet opens with the full log serialized as plain text | Get logs off-device for a bug report |
| S-DBG-10 | 501 log entries have been appended during the session | User opens the log viewer | Only the most recent 500 entries are present; the oldest has been evicted | Ring-buffer cap (Business invariant) |
| S-DBG-11 | Log viewer is open, showing entries | New API calls happen while it's open | The list updates live to include new entries without the user needing to close/reopen | Live view, not a snapshot |

### Edge Cases

1. **Bubble must never intercept touches meant for underlying UI when idle.** Only the bubble's own small hit area captures touches; the rest of the screen behind it must remain fully interactive. Implementation must use an absolutely-positioned, small-footprint container, not a full-screen transparent overlay.
2. **Bubble must stay within screen bounds after a drag**, including after a device rotation or on screens with a notch/safe-area inset — clamp the drop position to the visible safe area so it can never be dragged fully off-screen and become unreachable.
3. **Rapid successive API calls (e.g. `TanStack Query`'s parallel wallet/category/transaction fetches on Home) must not drop entries or race on the ring buffer** — the log store's append must be a single synchronous operation (e.g. a Zustand `set` with a functional updater), not susceptible to lost updates from concurrent callers.
4. **The debug console's own rendering/log-writing must never throw** — a bug in the debug tool itself must not crash the app it's trying to help debug. Any error thrown while appending a log entry is caught and silently dropped, never rethrown.
5. **Logging must not capture the JWT access/refresh token values themselves** — per `CLAUDE.md`'s "Không log sensitive data (password, token, email trong prod log)," the `Authorization` header and any request/response field containing a raw token must be redacted (e.g. `Bearer ***`) before being stored in a log entry, even though this is an on-device (not server) log — a shared screen or screenshot of the debug console must not leak a live session token.
6. **Tap-vs-drag threshold**: a touch that moves less than a small pixel threshold (e.g. 10px) before release counts as a tap (opens the viewer); anything beyond that threshold counts as a drag (repositions, does not open the viewer) — without this, every drag would also incorrectly open the fullscreen view on release.

### Definition of Done
- `DebugLogProvider`/log store, `DebugBubble` (draggable, tap-to-open), and a fullscreen log viewer (list + expandable detail + clear + share) are implemented and mounted once in `app/_layout.tsx`.
- Navigation, API (success/error), and uncaught-error sources all append correctly-categorized entries; token/email values are redacted before storage (Edge Case #5).
- Ring buffer caps at 500 entries, FIFO eviction confirmed (S-DBG-10).
- Manual on-device verification (an `.apk`/`.ipa` test build, per `mobile/AGENTS.md`): bubble is draggable and stays within bounds after rotation, tap reliably opens the viewer without misfiring on drag-release, an induced `401` produces a visible `api` log entry.

### Idempotency
N/A — this is a client-only, non-persisted UI/logging feature; there is no write to a shared resource that could be duplicated.

## Out of Scope

- **Persisting logs across app restarts** — resolved out of scope (Context decision #1); this is a live debugging tool for the current session only.
- **Capturing every raw `console.log`/`console.warn` call app-wide** — resolved out of scope (Context decision #5); only navigation/API/uncaught-error sources are captured for this MVP.
- **Remote log shipping (e.g. sending logs to a backend/Sentry-like service)** — the Share action hands off to the OS share sheet only; no network call is made by this feature itself.
- **A build-time flag to disable the bubble in a "real" production build** — not needed yet since the project has no App Store/Play Store release track (`CLAUDE.md`); revisit if that changes (Open Questions #1).
- **Web (`frontend/`) equivalent** — this is a mobile-only tool; the web app has React DevTools/browser console available already.

## Open Questions

1. **Always-visible in every build (Context decision #3)**: this spec assumes the debug bubble should render in every build including what will eventually be a "release" `.apk`, since the project has no store-gated release track today and every build is a test build. **Recommend the current assumption** for now, but flag that if/when a genuinely public-facing build track is introduced later, this should be gated behind an env flag (e.g. `EXPO_PUBLIC_DEBUG_CONSOLE=1`) rather than always-on.
2. **Redaction scope (Edge Case #5)**: this spec requires redacting `Authorization`/token fields; it does not enumerate every other potentially sensitive field (e.g. email in request bodies) for redaction, since `CLAUDE.md`'s rule is specific to password/token/email — **recommend also redacting email fields** in logged request/response bodies for full compliance with that rule; flagging so `plan.md` doesn't scope this down to tokens only.
