# Feature Spec: F-10 Notification Handling (MVP)

> Source: `SRS.md` Feature-10 (US-01 View list [MVP], US-02 View a Notification [MVP], US-03 Mark as Read), BF-09, BF-01 step 11 ("views Notifications if any Budget limit or condition is reached"); `SDS.md` §2 Domain Model (Notification: `id, user_id, type, title, body, is_read, created_at`), §4 Scenario Index (`S-NOT-01 | Feature-10 | US-10-01 View the list of Notifications | MVP | User awareness`); `CLAUDE.md` MVP Features table (`F-10 | Notification Handling | MVP`) and Core DB Schema (`notifications(id, user_id, type, title, body, is_read, created_at)`)
> Status: MVP — last unimplemented MVP feature per `docs/features.md` roadmap (2026-08-13). F-01 through F-07 are all implemented backend + web; this closes the MVP scope.
> Related: [F-05 Budget Management](../budget-management/spec.md) (Context decision #4 + Open Questions #5 **already commit** F-10 to owning the "budget-crossing" trigger as an asynchronous/background process, explicitly *not* synchronous inside `POST /transactions` — this spec is the authoritative closure of that deferral), [F-06 Transaction Management](../transaction-management/spec.md) (the write path that indirectly causes a Budget to cross its limit; this spec never hooks into it directly), [F-03 Wallet Management](../wallet-management/spec.md) / [F-04 Category Management](../category-management/spec.md) (cursor-pagination and ownership-check conventions reused verbatim)

## Context

A Notification is a system-generated, read-only (except for a one-way `is_read` toggle) message to a User, per SDS §2 Domain Model. Per SRS BF-01 step 11 and the Notification domain object's own example ("e.g. budget limit reached"), and per `specs/budget-management/spec.md`'s explicit deferral (Context decision #4: *"Budget-crossing Notifications are asynchronous... The exact schedule/cadence belongs to F-10's own spec"*), **this spec's only MVP trigger is a Budget crossing from `"within"` to `"exceeded"`** for one of its per-currency limits.

**Resolved design decisions:**

1. **MVP trigger scope = Budget-limit-crossing only.** No other trigger type (low Wallet balance, large single Transaction, Financial Goal milestones) has any basis in SRS/SDS for this feature — all are explicitly out of scope (see Out of Scope). This mirrors Budget spec's own Out-of-Scope note that "percentage-based/early-warning alerts" (e.g. 80% of limit) are a Release-1+ concern, not MVP.
2. **Generation is a periodic background job, never synchronous with `POST /transactions`.** This is not a new decision — it is the mandatory closure of `specs/budget-management/spec.md` Context decision #4 and Open Questions #5. The job periodically re-evaluates every User's active Budgets against their live-computed `spent` (per Budget spec's own "always computed live, never stored" rule) and creates a Notification the first time, per calendar period, that a specific currency's `spent` crosses from `≤ amount_limit` to `> amount_limit`.
3. **Notification content is denormalized (static) at creation time, never a live join.** A Notification's `title`/`body` are fully rendered human-readable strings baked in when the row is inserted — not references re-resolved against the Budget/Category at read time. This is a deliberate departure from every prior MVP feature's live-join convention (e.g. F-06's `category_name` join), because a Notification is a historical event record: the underlying Budget can later be edited or soft-deleted, and the Notification must keep displaying accurately regardless (explicit assumption — flagged in Open Questions #4).
4. **Dedup/correlation requires extending `CLAUDE.md`'s minimal `notifications` schema** with `related_budget_id` (nullable UUID), `currency` (nullable text), and `period_start` (nullable date) — used only when `type = "budget_exceeded"` — plus a partial unique index on `(related_budget_id, currency, period_start)` to guarantee the job can run repeatedly (even concurrently) without ever creating a duplicate Notification for the same crossing event. This mirrors the project's established pattern of pushing concurrency-sensitive invariants into the DB (F-03's one-default-Wallet index, F-05's one-active-Budget index), not trusting a check-then-insert race in application code. Flagged in Open Questions #2, since it is a schema extension beyond `CLAUDE.md`'s literal table definition — the same kind of extension Budget's own spec made with its `limits` child table.
5. **`is_read` is a one-way toggle (`false → true` only).** SRS lists no "mark as unread" story; once read, a Notification stays read.

Actors:
- **User** — any `active` user (`role = admin` or `member`); Notifications are personal, never shared or admin-broadcast. Acts on US-01/US-02/US-03 (list, view, mark-as-read).
- **System (Scheduler)** — a background process, not an HTTP caller, that runs the Budget-crossing evaluation job on a fixed interval and is the sole creator of Notifications in MVP.

## Preconditions (feature-level)

- Caller (User-facing endpoints) holds a valid access JWT.
- `notifications` table exists per the schema below (**new migration required** — `009_notifications.sql`; current migrations are `001_init.sql` through `008_transactions.sql`).
- Budget Management (F-05) and Transaction Management (F-06) already exist (both implemented) — the job reads Budget's live-computed `spent` exactly as `GET /budgets` already does, no new aggregation logic invented here.

### Domain Fields (conceptual — full schema/index design belongs in `plan.md`)

This extends the `notifications` entity already named in `CLAUDE.md`'s Core DB Schema; the last three columns are this spec's own addition (Context decision #4), not present in `CLAUDE.md`'s literal table definition.

| Field | Meaning |
|---|---|
| `id` | Unique identifier |
| `user_id` | Owner — Notifications are never shared or system-broadcast |
| `type` | Free-text, forward-compatible column (mirrors Budget's `period` pattern). **MVP emits only `"budget_exceeded"`** |
| `title` / `body` | Fully rendered, static human-readable text at creation time (Context decision #3) — e.g. `title: "Budget exceeded: Food"`, `body: "You've spent 2,200,000 VND against a 2,000,000 VND monthly limit for Food."` |
| `is_read` | Boolean, one-way `false → true` (Context decision #5) |
| `related_budget_id` | Nullable UUID, no enforced FK cascade (Budgets are soft-deleted, never hard-deleted — `CLAUDE.md`: "không hard delete financial records"). `NULL` for any future non-Budget notification type |
| `currency` | Nullable text, one of `{VND, USD}` (F-03's allow-list). Set only when `type = "budget_exceeded"` |
| `period_start` | Nullable `DATE` — the first day of the calendar month this crossing event belongs to (mirrors Budget's own calendar-month period window, `specs/budget-management/spec.md` Context decision #3) |
| `created_at` | Audit timestamp — also the effective "notified at" time; there is no separate `read_at` (see Open Questions #3) |

**Business invariant**: `user_id` on a Notification is always the same `user_id` that owns the referenced Budget — a Notification is never created for, or visible to, any User other than the Budget's owner.

**Business invariant**: for `type = "budget_exceeded"`, the triple `(related_budget_id, currency, period_start)` is unique — enforced by a partial unique index — so the background job can run any number of times (including concurrently) for the same period without ever producing two Notifications for the same Budget/currency/period crossing.

**Business invariant**: `is_read` only ever transitions `false → true`; there is no operation in this spec that sets it back to `false`.

No money rule applies to the Notification entity itself — it stores no computed monetary field, only a pre-rendered string; the underlying amounts it describes are already governed by Budget's own ⚠️ money rule (`specs/budget-management/spec.md`).

---

## US-00: Generate Budget-Crossing Notifications [MVP, system-triggered]

> Not a numbered User Story in SRS — SRS/SDS describe this only implicitly (BF-01 step 11, the Notification domain object's own example). Included here as its own section, with the same structure as every other US, because it is this feature's sole notification-producing mechanism and needs its own testable scenarios. Flagged explicitly in Open Questions #1.

**As the** System (Scheduler),
**I want** to periodically detect when a User's Budget crosses from within-limit to over-limit for a given currency,
**so that** the User is informed without needing to synchronously slow down `POST /transactions` (per `specs/budget-management/spec.md` Context decision #4).

**API:** None — internal background process, not exposed over HTTP.

### Preconditions
- Runs on a fixed interval, independent of any specific HTTP request (**explicit assumption: every 5 minutes** — no SRS/SDS source states an SLA; see Open Questions #1).
- Reads only non-deleted, active Budgets (`deleted_at IS NULL`) across all Users, and each Budget's live-computed per-currency `spent` (same computation `GET /budgets`, F-05, already performs — no new aggregation logic).

### Main Flow
1. System (Scheduler) triggers the job on its fixed interval.
2. For every active Budget, for every currency entry in its `limits`, System computes `spent` for the current calendar-month period (identical rule to F-05's own `GET /budgets`).
3. System compares `spent` against `amount_limit` for that currency: if `spent > amount_limit`, the currency is `"exceeded"` this period.
4. For each `"exceeded"` `(budget_id, currency, period_start)` found, System checks whether a `budget_exceeded` Notification already exists for that exact triple (the partial unique index makes this check-then-insert safe even under concurrent job runs — see Edge Cases #3).
5. If none exists, System creates one Notification: `user_id` = the Budget's owner, `type = "budget_exceeded"`, `related_budget_id`, `currency`, `period_start` = first day of the current calendar month, and a rendered `title`/`body` naming the Category, the limit, and the actual spend.
6. System does not re-notify for a currency that is already `"exceeded"` and was already notified this period; it does not retract a Notification if the Budget is later edited to raise the limit back above `spent` within the same period (see Edge Cases #4).

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-NOT-01 | User has a "Food" Budget with a `VND 2,000,000` monthly limit; this month's spend is `VND 2,200,000` | Job runs | Exactly one Notification created: `type = "budget_exceeded"`, `related_budget_id` = the Food Budget, `currency = "VND"`, `period_start` = 1st of this month | Happy path — single-currency crossing |
| S-NOT-02 | Same Budget as S-NOT-01, already notified this period | Job runs again (next interval, still exceeded) | No new Notification created — the existing one is left as-is | Idempotent per period — ⚠️ duplicate-alert spam would defeat the feature's purpose |
| S-NOT-03 | User has a "Travel" Budget with limits `{ VND: 5,000,000, USD: 100,000 }`; this month, VND spend is `5,500,000` (exceeded) and USD spend is `50,000` (within) | Job runs | Exactly one Notification created, for the `VND` entry only | Per-currency independence — mirrors Budget's own no-currency-blending rule |
| S-NOT-04 | User has no Budgets at all | Job runs | No Notifications created; no error | Not an error path — an empty Budget set is valid |
| S-NOT-05 | User's "Food" Budget was exceeded and notified in July; August arrives and spend resets below the limit, then crosses again in August | Job runs in August after the second crossing | A **second**, distinct Notification is created for `period_start` = 1st of August | New calendar period → new dedup key → a fresh crossing is notifiable again |
| S-NOT-06 | Two overlapping job executions evaluate the same newly-exceeded Budget/currency/period at nearly the same time (e.g. a slow run overlapping the next scheduled tick) | Both attempt to insert a Notification for the same `(related_budget_id, currency, period_start)` | Exactly one insert succeeds; the other is rejected by the partial unique index and is treated as a no-op, not an error surfaced anywhere | ⚠️ Data-integrity critical — same class of guard as F-03 S-WAL-10 / F-05 S-BUD-13 |

### Edge Cases
1. **`spent` is computed live, identically to F-05's `GET /budgets`** — this job introduces no new aggregation query or cached "spent" value; it reuses Budget's existing repository method to avoid the two computations ever silently diverging.
2. **A Budget with multiple currencies can produce multiple, independent Notifications in the same job run** — one `(budget_id, currency, period_start)` triple at a time (S-NOT-03).
3. **Concurrent job runs never double-notify** — closed at the data layer via the partial unique index (S-NOT-06), not by relying on the job being a documented singleton process (`plan.md` may still choose to make it a singleton for efficiency, but correctness does not depend on it).
4. **Editing a Budget's limit upward mid-period after a Notification was already sent does not retract or update that Notification** — the Notification is a historical record of a moment when the limit was crossed, not a live status indicator (Context decision #3); a User who wants current status uses `GET /budgets` (F-05), not their Notification history.
5. **Deleting the underlying Budget after a Notification was created does not delete or orphan-hide the Notification** — its `title`/`body` remain fully readable (denormalized text), and `related_budget_id` simply points to a soft-deleted row, which is never dereferenced for display.

### Definition of Done
- A scheduled background process (interval configurable, defaulting to 5 minutes) evaluates every active Budget's per-currency `spent` vs. `amount_limit` and creates at most one `budget_exceeded` Notification per `(related_budget_id, currency, period_start)`.
- The `(related_budget_id, currency, period_start)` uniqueness is enforced by a partial unique index, not only in-process logic.
- The job reuses Budget's existing `spent` computation rather than duplicating it.
- Integration tests for S-NOT-01 through S-NOT-05 pass. A concurrency test for S-NOT-06 (two simultaneous evaluations of the same crossing) passes.

### Idempotency
Each job execution is idempotent per `(related_budget_id, currency, period_start)` — re-running the job any number of times against unchanged data produces zero additional Notifications after the first successful insert (enforced at the DB layer, not just by an in-process check).

---

## US-01: View the List of Notifications [MVP]

**As a** User,
**I want** to see my Notifications, most recent first,
**so that** I know about Budget-related events without checking every Budget manually (SRS BF-01 step 11).

**API:** `GET /notifications`

### Preconditions
- Caller is authenticated.
- Query parameters (all optional): `is_read` (`true`|`false`), `cursor` (from a previous response's `next_cursor`), `limit` (default 20, max 100 — same convention as F-01's `GET /admin/users`).

### Main Flow
1. User opens the Notifications screen.
2. App calls `GET /notifications` with no filters.
3. System returns the caller's own Notifications, `created_at DESC, id DESC`, cursor-paginated (same `{id, created_at}` base64 cursor convention as F-01's `GET /admin/users`).
4. User can optionally filter by `is_read`.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-NOT-07 | Caller has 3 Notifications, all unread | Caller calls `GET /notifications` | `200`; 3 items, most recent first | Happy path |
| S-NOT-08 | Caller has zero Notifications | Caller calls `GET /notifications` | `200`; `data: []`, `next_cursor: null` | Not a `404` — empty is valid, mirrors F-01/F-06 list precedent |
| S-NOT-09 | Caller has 2 unread and 1 read Notification | Caller calls `GET /notifications?is_read=false` | `200`; only the 2 unread items | Filter, mirrors F-01's `status` filter |
| S-NOT-10 | — | Caller calls `GET /notifications?is_read=maybe` | `400 INVALID_INPUT` | Shape validation, handler-level |
| S-NOT-11 | Caller A and Caller B (different users) each have their own Notifications | Caller A calls `GET /notifications` | `200`; only Caller A's Notifications appear | User isolation — ⚠️ cross-user leak would be critical |
| S-NOT-12 | No/invalid JWT | Caller calls `GET /notifications` | `401 UNAUTHENTICATED` | Authentication failure |

### Response Shape
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "budget_exceeded",
      "title": "Budget exceeded: Food",
      "body": "You've spent 2,200,000 VND against a 2,000,000 VND monthly limit for Food.",
      "is_read": false,
      "created_at": "2026-08-13T09:00:00Z"
    }
  ],
  "pagination": { "next_cursor": "eyJpZCI6...", "total": 3 }
}
```

### Edge Cases
1. **Cursor pagination, not offset** — reuses F-01's exact `{id, created_at}` base64 cursor convention (`CLAUDE.md` data convention: cursor-based pagination).
2. **No maximum age/retention cutoff on listed Notifications in MVP** — every historical Notification remains listable indefinitely; archival/cleanup is not designed here.
3. **`related_budget_id`, `currency`, `period_start` are internal dedup fields, not part of the public response shape** — the response exposes only `title`/`body` (already human-readable), keeping the API surface stable even if the dedup schema changes later.

### Definition of Done
- `GET /notifications` implemented, strictly scoped to `user_id = caller`, cursor-paginated, with an optional `is_read` filter.
- Integration tests for S-NOT-07 through S-NOT-09, S-NOT-11 pass. Unit test for S-NOT-10 passes.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-02: View a Notification [MVP]

**As a** User,
**I want** to open a single Notification and read its full detail,
**so that** I can understand exactly which Budget/Category triggered it.

**API:** `GET /notifications/:id`

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-NOT-13 | Caller owns Notification `N1` | Caller calls `GET /notifications/N1` | `200`; full Notification detail | Happy path |
| S-NOT-14 | `id` does not exist | Caller calls `GET /notifications/<random-uuid>` | `404 NOTIFICATION_NOT_FOUND` | Same existence semantics as every other MVP resource |
| S-NOT-15 | `id` belongs to a *different* user | Caller calls `GET /notifications/<other's>` | `403 NOTIFICATION_ACCESS_DENIED` | Ownership check, mirrors F-03/F-04/F-05/F-06 |
| S-NOT-16 | No/invalid JWT | Caller calls `GET /notifications/N1` | `401 UNAUTHENTICATED` | Authentication failure |

### Edge Cases
1. **Viewing a Notification does not itself mark it as read** — that is a distinct, explicit action (US-03), not an automatic side effect. SRS lists View and Mark-as-Read as separate User Stories; conflating them would remove the User's ability to preview without dismissing.

### Definition of Done
- `GET /notifications/:id` implemented with the same ownership/existence semantics as every other MVP resource. Integration test S-NOT-13 passes. Unit tests S-NOT-14, S-NOT-15 pass.

### Idempotency
N/A — read-only (`GET`), naturally idempotent.

---

## US-03: Mark a Notification as Read

**As a** User,
**I want** to mark a Notification as read,
**so that** my unread list only shows things I haven't acknowledged yet.

**API:** `POST /notifications/:id/read`

> Modeled as a dedicated action endpoint — like F-03's `POST /wallets/:id/set-default` — rather than a generic `PATCH /notifications/:id`, because `is_read` is a single one-way boolean toggle, not a general resource update. Flagged in Open Questions #5 since every other MVP feature besides Wallet's set-default uses generic `PATCH`.

### Main Flow
1. User opens a Notification (US-02) or taps "mark as read" from the list (US-01).
2. App calls `POST /notifications/:id/read`.
3. System verifies the Notification exists and `user_id = caller`.
4. System sets `is_read = true` (no-op if already `true`).
5. System returns `200` with the updated Notification.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-NOT-17 | Caller owns unread Notification `N1` | Caller calls `POST /notifications/N1/read` | `200`; `N1.is_read = true` | Happy path |
| S-NOT-18 | Caller owns Notification `N1`, already `is_read = true` | Caller calls `POST /notifications/N1/read` again | `200`; `is_read` remains `true`, no error | Idempotent — calling twice is a safe no-op |
| S-NOT-19 | `id` does not exist | Caller calls `POST /notifications/<random-uuid>/read` | `404 NOTIFICATION_NOT_FOUND` | Same existence semantics as US-02 |
| S-NOT-20 | `id` belongs to a *different* user | Caller calls `POST /notifications/<other's>/read` | `403 NOTIFICATION_ACCESS_DENIED` | Ownership check |
| S-NOT-21 | No/invalid JWT | Caller calls `POST /notifications/N1/read` | `401 UNAUTHENTICATED` | Authentication failure |
| S-NOT-22 | Caller owns unread Notification `N1`; two `POST /notifications/N1/read` calls race concurrently | Both requests race | Both succeed with `200`; final state is `is_read = true` (a boolean-set update has no lost-update hazard, unlike a numeric increment) | No special locking needed — assignment, not accumulation |

### Edge Cases
1. **There is no "mark as unread" operation anywhere in this spec** — `is_read` only ever moves `false → true` (Context decision #5); SRS defines no reverse story.
2. **No "mark all as read" bulk action in MVP** — not in SRS scope (see Out of Scope).

### Definition of Done
- `POST /notifications/:id/read` implemented, idempotent, with the same ownership/existence semantics as US-02.
- Integration tests S-NOT-17, S-NOT-18 pass. Unit tests S-NOT-19, S-NOT-20 pass.

### Idempotency
Idempotent by construction — setting a boolean to `true` any number of times yields the same end state; no idempotency key required (mirrors F-03's `POST /wallets/:id/set-default`, which is idempotent for the same reason).

---

## Out of Scope (Feature F-10)

- **Non-Budget trigger types** (low Wallet balance, large single Transaction, Financial Goal milestones, etc.) — no SRS/SDS basis for MVP; resolved out of scope (Context decision #1).
- **Push notifications, email, or SMS delivery** — MVP is in-app, poll-based (`GET /notifications`) only. No real-time channel (WebSocket/SSE) is designed here.
- **"Mark all as read" bulk action** — not in SRS scope (US-03 Edge Cases #2).
- **Marking a Notification back to unread** — one-way transition only (Context decision #5).
- **Deleting Notifications** — no `DELETE` endpoint; SRS defines no such story.
- **Percentage-based/early-warning thresholds** (e.g. "notify at 80% of limit") — Release-1+ concern, matching Budget spec's own Out-of-Scope note.
- **Cross-user or admin-facing Notification broadcast** — every Notification is personal, matching every prior MVP feature's precedent.
- **`read_at` timestamp / read-receipt analytics** — only the boolean `is_read` is tracked in MVP (see Open Questions #3).
- **Synchronous creation inside `POST /transactions`** — explicitly and permanently ruled out by `specs/budget-management/spec.md` Context decision #4, not merely deferred here.

## Open Questions

1. **US-00 is not a numbered SRS User Story.** SRS/SDS only imply Notification creation (BF-01 step 11, the domain object's own example); this spec formalizes it as its own section for testability. **Recommend accepting this structure** — flagging since a reviewer expecting only 3 User Stories (matching SRS's literal list) should understand the 4th section is a deliberate addition, not scope creep.
2. **Background job cadence**: assumed **every 5 minutes**, with no SRS/SDS-stated SLA — `specs/budget-management/spec.md` explicitly left this open (its own Open Questions #5). **Recommend the 5-minute default** as a reasonable balance between alert staleness and system load; flag for explicit product sign-off since it directly shapes how "immediate" the feature feels to a User.
3. **Schema extension** (`related_budget_id`, `currency`, `period_start` beyond `CLAUDE.md`'s literal `notifications` table): necessary for the dedup unique index (Context decision #4). **Recommend accepting the extension** — mirrors Budget's own precedent of extending its `CLAUDE.md`-listed table — but flagging since it is a deviation from the schema as literally written in `CLAUDE.md`.
4. **No `read_at` timestamp in MVP**: only `is_read` (boolean) is tracked. `SDS.md` §10.3.4 ("Critical Alert Acknowledgement Rate") implies a *future* metric need for when a Notification was acknowledged, not just whether. Low priority for MVP; revisit if that metric is actually implemented.
5. **Denormalized (static) `title`/`body` vs. live-joined display** (Context decision #3): assumed static, since a Notification is a historical event record and every prior MVP feature's live-join convention would otherwise break once the referenced Budget is edited or soft-deleted. No explicit SRS/SDS statement confirms this; flagging as the single most consequential design decision in this spec, same treatment F-07's spec gave its own single-endpoint decision.
6. **Mark-as-read as a dedicated action endpoint** (`POST /notifications/:id/read`) **vs. generic `PATCH /notifications/:id`**: this spec recommends the dedicated-endpoint form (mirrors F-03's `set-default`), since every other MVP feature's generic `PATCH` updates a multi-field resource, while this is a single one-way boolean. Flagging since it's a minority pattern in this codebase (only Wallet's `set-default` precedes it).
