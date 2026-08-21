# Feature Spec: Mobile Loading Skeletons (replace spinners on 5 screens)

> Source: explicit user request — "nên display skeleton khi loading data thay vì spinner trong mobile/app/(app)/index.tsx, transactions.tsx, insights.tsx, categories.tsx, users.tsx".
> Status: new — `mobile/` UI-only change, no API/DTO/backend impact.
> Related: `frontend/src/components/ui/skeleton.tsx` + per-feature `*-table-skeleton.tsx`/`*-detail-card-skeleton.tsx` components already ship this exact pattern on web (`wallets`, `categories`, `budgets`, `transactions`, `reports`, `users`, `notifications`) — this spec ports the same pattern to `mobile/`, which currently has no `Skeleton` primitive at all.

## Context

Every one of the 5 target screens currently renders a bare `<ActivityIndicator>` (a spinning circle) while its TanStack Query hook(s) are in their initial `isLoading` state, then swaps to the real content once data arrives. A spinner conveys "something is happening" but nothing about *what* is about to appear or *how much* of it — a skeleton (gray placeholder blocks shaped like the eventual content: wallet cards, list rows, chart, stat tiles) reduces perceived load time and lets the user start visually parsing the layout before data arrives. This is purely a loading-state UI change — no query, mutation, type, or API contract is touched.

**Resolved design decisions:**

1. **No new dependency for the shimmer effect.** `frontend/`'s skeleton likely uses a CSS animation; `mobile/` has no CSS. This spec uses React Native's built-in `Animated` API (already used implicitly via `react-native-screens`/core) to pulse each skeleton block's opacity (e.g. 0.4 ↔ 1.0, looping) — no new package (`react-native-reanimated`, `react-content-loader`, etc.) is added, consistent with [mobile-debug-console](../mobile-debug-console/spec.md) decision #2's same no-new-native-dependency stance.
2. **One shared primitive, five screen-specific shapes.** A single `SkeletonBlock` primitive component (a pulsing rounded rectangle of configurable width/height) lives in `src/components/ui/`, mirroring `frontend/src/components/ui/skeleton.tsx`. Each of the 5 screens composes it into a layout that approximates that screen's real content shape (e.g. Home's skeleton has a hero-balance block + row of wallet-card-shaped blocks + list-row-shaped blocks), mirroring `frontend/`'s per-feature `*-skeleton.tsx` composition pattern rather than one generic "gray box everywhere" component.
3. **Skeleton replaces the loading branch only — not the empty-state branch.** Each screen today branches on `isLoading` (spinner) vs. loaded-with-data vs. loaded-with-empty-data (a "no X yet" message). This spec changes only the `isLoading` branch; the empty-state text/copy is unchanged.
4. **Pagination/fetch-more spinners are unchanged.** `transactions.tsx`'s `ListFooterComponent` spinner (shown during `isFetchingNextPage`, i.e. loading *more* of an already-visible list) is a different UX moment from the initial full-screen load and is explicitly out of scope — replacing it with a skeleton row would be visually redundant directly beneath already-loaded real rows.

Actor: **any authenticated user**, on first navigating to (or pull-to-refreshing, if applicable) one of the 5 target screens while its data has not yet loaded.

## Preconditions (feature-level)

- No new migration, no new API endpoint, no new TanStack Query hook — every screen's existing `useXQuery()` calls and their `isLoading` flags are reused unchanged.
- `src/components/ui/SkeletonBlock.tsx` (new) has no dependency on any specific feature's data shape — it is a layout primitive only.

## Per-Screen Skeleton Shapes

| Screen | Current spinner location(s) | Skeleton composition |
|---|---|---|
| `app/(app)/index.tsx` (Home) | `wallets.isLoading` (wallet row), `recent.isLoading` (transaction list `ListEmptyComponent`) | Wallet section: 2–3 horizontally-scrolling wallet-card-shaped blocks (matches `WalletCard` dimensions). Recent-transactions section: 4 list-row-shaped blocks (matches `TransactionRow` height/layout — icon circle + two text lines + amount). The hero balance amount itself already has its own inline `"…"` placeholder (`wallets.isLoading ? "…" : ...`, line 53) — unchanged, not a skeleton block. |
| `app/(app)/transactions.tsx` | `transactions.isLoading` (`ListEmptyComponent`) | 6–8 list-row-shaped blocks matching `TransactionRow`'s layout, filling the visible list area below the filter chips (which render immediately, unaffected by loading state). |
| `app/(app)/insights.tsx` | None today (`SpendingTab`/`BudgetsTab` are opaque sub-components; per Edge Cases #1, their own internal loading states are in scope too) | `SpendingTab`: stat-card-shaped blocks (matches its summary cards) + a circle block matching the `DonutChart`'s footprint + a few legend-row blocks. `BudgetsTab`: 3–4 `BudgetCard`-shaped blocks (matches `NewBudgetModal`/budget card dimensions). |
| `app/(app)/categories.tsx` | `categories.isLoading` (whole-screen branch, line 46–48) | 6–8 `CategoryListItem`-shaped blocks (icon circle + text line), filling the list area below the type chips. |
| `app/(app)/users.tsx` | `users.isLoading` (whole-screen branch, line 32–34) | 4–5 `UserListItem`-shaped blocks (avatar circle + two text lines), filling the list area below the header. |

---

## US-01: See a Skeleton Loading State Instead of a Spinner

**As a** user,
**I want** the app to show a content-shaped placeholder while a screen's data is first loading,
**so that** I perceive the app as faster and can anticipate the layout before data arrives.

**Client:** `mobile/` only — no API. Applies identically to all 5 screens listed in the Per-Screen table above.

### Preconditions
- Same as feature-level preconditions above; no per-scenario precondition beyond that.

### Main Flow
1. User navigates to one of the 5 target screens (or it is the initial screen on app launch).
2. The screen's query hook(s) are in their `isLoading` state (first fetch, no cached data yet — TanStack Query's `isLoading`, not `isFetching`, so a background refetch of already-cached data does **not** re-trigger the skeleton, only a genuinely first load does).
3. Instead of `<ActivityIndicator>`, the screen renders a skeleton layout shaped like its eventual content (see Per-Screen Skeleton Shapes), with each block gently pulsing.
4. Data arrives; `isLoading` becomes `false`; the skeleton unmounts and the real content (or empty-state message, per decision #3) renders in its place.

### Scenarios

| Scenario ID | Given | When | Then | Notes |
|---|---|---|---|---|
| S-SKL-01 | User opens the app fresh (no cached query data) | Home screen mounts | Wallet-card-shaped and transaction-row-shaped skeleton blocks render, pulsing, instead of `ActivityIndicator` | Home happy path |
| S-SKL-02 | Wallet/transaction data finishes loading | — | Skeleton blocks are replaced by real `WalletCard`/`TransactionRow` components; no layout jump/flash of unstyled content | Smooth handoff — skeleton dimensions must closely match real content dimensions to avoid this |
| S-SKL-03 | User has zero wallets (new account) | Data finishes loading | Skeleton disappears; the existing "no wallets" / relevant empty-state UI shows (unchanged copy) — not an empty skeleton, not a stuck skeleton | Decision #3 — loading vs. empty are distinct branches |
| S-SKL-04 | User navigates to Transactions screen | Screen mounts, `transactions.isLoading` is true | List-row-shaped skeleton blocks fill the list area; filter chips and the "+" button render immediately (unaffected by loading state) | Only the data-dependent region skeletonizes |
| S-SKL-05 | User is on Transactions, has already scrolled and triggered `fetchNextPage` (pagination) | `isFetchingNextPage` is true | The existing `ActivityIndicator` footer spinner still renders (unchanged) — no skeleton row is added beneath already-loaded rows | Decision #4 — pagination spinner explicitly untouched |
| S-SKL-06 | User navigates to Insights → Spending tab | Spending data is loading | Stat-card and donut-chart-shaped skeleton blocks render | Insights/Spending |
| S-SKL-07 | User navigates to Insights → Budgets tab | Budget data is loading | Budget-card-shaped skeleton blocks render | Insights/Budgets |
| S-SKL-08 | User (admin) navigates to Household Members (`users.tsx`) | `users.isLoading` is true | Avatar+text-shaped skeleton blocks render instead of the current whole-screen `ActivityIndicator` | Users screen |
| S-SKL-09 | User navigates to Categories screen | `categories.isLoading` is true | Icon+text-shaped skeleton blocks render instead of the current whole-screen `ActivityIndicator` | Categories screen |
| S-SKL-10 | User already has this screen's data cached from a prior visit (TanStack Query cache hit) and revisits it | Screen mounts | Cached data renders immediately — `isLoading` is already `false` (only `isFetching` may be `true` in the background) — no skeleton flashes at all | Skeleton only gates a genuine first load, never a cache-hit revisit (Main Flow step 2) |
| S-SKL-11 | Device has "reduce motion" accessibility setting enabled | Skeleton renders | Pulsing opacity animation is disabled/reduced (static semi-transparent blocks instead of animating) | Accessibility — see Edge Cases #4 |

### Edge Cases

1. **`insights.tsx` itself has no `isLoading` branch today** — the loading state lives inside `SpendingTab`/`BudgetsTab`, which this spec has not read line-by-line but which must expose (or already expose) their own query `isLoading` flags for `plan.md` to wire skeletons into; if either sub-component currently has *no* loading UI at all (not even a spinner), this spec still requires adding a skeleton there (not deferring it as "no regression to fix"), since the user explicitly named `insights.tsx` as a target screen.
2. **Skeleton block dimensions must be kept in sync with their real counterparts' dimensions** (`WalletCard`, `TransactionRow`, `CategoryListItem`, `UserListItem`, `BudgetCard` sizes) — a mismatch causes a visible layout shift the instant real content replaces the skeleton, which is worse UX than the spinner it's replacing. `plan.md` must specify exact heights/widths pulled from each real component's existing `StyleSheet`, not approximate them.
3. **List-shaped skeletons (Transactions, Categories, Users) must render a *fixed, small* number of placeholder rows** (per the Per-Screen table: 6–8, 6–8, 4–5 respectively) **regardless of how many real items will eventually load** — there is no way to know the real count in advance, and rendering e.g. 50 skeleton rows would be wasted render cost and visual noise; a short, viewport-filling count is the correct approximation, same convention `frontend/`'s own table skeletons use (fixed row count, not dynamic).
4. **Respect the OS "reduce motion" accessibility setting** (`AccessibilityInfo.isReduceMotionEnabled()`, React Native core API) — when enabled, skip the pulsing `Animated` loop and render static skeleton blocks instead, consistent with standard accessibility practice for shimmer/pulse effects.
5. **The pulsing animation must stop and its `Animated.Value` must be cleaned up on unmount** (e.g. via `useEffect`'s cleanup function calling `.stopAnimation()`) — an un-cleaned looping animation on an unmounted component is a common React Native memory/warning leak, especially relevant here since skeletons mount/unmount frequently (every screen visit until cache warms up).

### Definition of Done
- `SkeletonBlock` primitive implemented (pulsing rectangle, reduce-motion aware) in `src/components/ui/`.
- All 5 target screens' `isLoading` branches replaced with a screen-shaped skeleton composition per the Per-Screen table; empty-state and pagination-footer branches unchanged.
- Skeleton block dimensions verified against each real component's `StyleSheet` values (Edge Case #2) — no visible layout shift on data arrival.
- Manual on-device verification: throttle/slow the network (or use a fresh install with an empty TanStack Query cache) and confirm each of the 5 screens shows its skeleton, then transitions cleanly to real content or the correct empty state.

### Idempotency
N/A — this is a client-only, read-only UI change with no write operation.

## Out of Scope

- **Any screen not explicitly listed** (`ai-chat.tsx`, `notifications.tsx`, `profile.tsx`, `wallets.tsx`) — those already have their own loading treatments (or none) and were not named in the request; not touched by this spec.
- **Pagination/"load more" loading indicators** — resolved out of scope (Context decision #4); `transactions.tsx`'s `ListFooterComponent` spinner is unchanged.
- **Pull-to-refresh spinners**, if any exist on these screens today — this spec only addresses the *initial* `isLoading` state, not a `RefreshControl`'s own spinner (a different, already-conventional loading affordance during an explicit user-initiated refresh of already-visible data).
- **Skeleton for the Home screen's inline hero-balance `"…"` placeholder** — resolved out of scope (Per-Screen Shapes table, Home row) — that single-character placeholder is not worth skeletonizing as a block.
- **A generic/shared cross-app "page skeleton" abstraction beyond the one `SkeletonBlock` primitive** — resolved as decision #2: one shared low-level primitive, five screen-specific compositions, not a single one-size-fits-all component.

## Open Questions

1. **`insights.tsx` sub-component loading states (Edge Cases #1)**: this spec assumes `SpendingTab`/`BudgetsTab` either already have or can readily expose their own query loading flags for skeleton wiring — not confirmed by reading those files in this BA pass. **Recommend `plan.md`'s pre-flight step read both components first** to confirm this assumption before estimating effort for the Insights screen specifically.
2. **Exact skeleton row counts (6–8, 6–8, 4–5)**: chosen as "enough to plausibly fill a typical device viewport" without a specific design mock to match against (no skeleton mock exists in `mobile/design_handoff_pfm_app/`, which predates this request). Low priority — cosmetic tuning, not a functional requirement; recommend adjusting per actual on-device viewport testing rather than treating these counts as fixed requirements.
