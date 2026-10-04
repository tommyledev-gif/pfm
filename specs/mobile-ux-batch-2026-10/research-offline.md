# Feasibility: Offline Support (mobile)

> Request 2026-10-04: "research the codebase and best practices for offline support — a must-have feature for this app."
> Status: **Research only — no code, no spec.** Verdict at the bottom.

---

## 1. What "offline" has to mean for PFM

A personal finance app is used at the till, in a basement parking lot, on a bus. The must-have, in priority order:

| # | Capability | Why it is must-have |
|---|---|---|
| O1 | **Stay logged in** when the network is gone | Today the app logs the user out (see §2) — the worst possible offline behaviour |
| O2 | **Read** last-known wallets, balances, categories, recent transactions, budgets | Opening the app to a spinner/error is useless |
| O3 | **Record an expense/income** offline, sync later, never lose it, never double-book it | The core job of the app |
| O4 | Clear status: offline banner, "N giao dịch chờ đồng bộ", per-item failure | Money data must never be silently dropped |

**Not** must-have (v1 stays online-only, disabled with a clear message): editing/deleting transactions, wallet/category/budget CRUD, AI chat & image capture, reports beyond cached data, import/export.

---

## 2. Current state (verified in code)

There is **no** offline support today: no NetInfo / `expo-network`, no `onlineManager` / `focusManager`, no `AppState` listener, no query persister, no `onMutate`, no offline banner.

### Blockers (must fix before anything else)

| # | Finding | Where | Effect |
|---|---|---|---|
| B1 ✅ fixed 2026-10-04 | `refreshSession()` calls `clear()` + "Phiên đăng nhập đã hết hạn" on **any** failure, including a network error | `mobile/src/stores/session-store.ts:124-136` | Opening the app offline > 12 min after the last token issue (refresh is due → `remainingDelayMs` = 0) **logs the user out**. Same if the network drops when the proactive timer fires. Logout also wipes the local chat thread (`session-scoped-reset.ts:43-45`). |
| B2 ✅ fixed 2026-10-04 | `setTokens()` calls `queryClient.clear()` on **every** call — including each proactive rotation, not only login | `session-store.ts:80-94` | The whole TanStack cache is wiped ~every 12 min. Incompatible with any persisted cache. The intent (no cross-account flash) only needs a clear when the **user changes**. |
| B3 | Refresh tokens rotate (old JTI revoked after the new pair is issued) | `backend/internal/service/auth_service.go:150-196` | If the refresh response is lost on a flaky network, the client keeps a revoked token → next refresh 401 → logout. Lower priority; a short server-side grace window for the previous JTI is the usual fix. |
| B4 | Network errors have no distinct message; `getErrorMessage` falls back to per-screen text | `mobile/src/lib/api-envelope.ts:27-32`, `axios.ts:138-144` | Users can't tell "offline" from "server broken". |

### Assets we can reuse

| Asset | Where | Use for offline |
|---|---|---|
| **Create is already idempotent end-to-end** — client sends `idempotency_key` (UUID), server dedupes via partial unique index, replay returns 200 | `use-transaction-form.ts:66,104,172` · `transaction_service_create.go:35-43, 86-96` · `010_transactions_idempotency_key.sql` | Safe replay of a queued create — the hardest backend piece already exists |
| Wallet balance + insert in one DB tx | `transaction_service_create.go:119-150` | Server stays the authority on balance |
| AsyncStorage + Zustand `persist` already used (6 stores) | `mobile/src/stores/*`, `chat-store.ts:113` | Same mechanism for an outbox; no new native dep |
| `@tanstack/react-query` v5 | `package.json` | `onlineManager`, `networkMode`, `PersistQueryClientProvider`, paused mutations |
| Chat thread sync pattern (`client_message_id` + `UNIQUE(user_id, client_message_id)`) | `chat-store.ts`, `015_chat_thread_sync.sql:19` | Precedent for client-keyed, retry-safe sync |

### Gaps

| Gap | Where | Note |
|---|---|---|
| Idempotency lookup ignores soft-deleted rows but the unique index doesn't | `queries/transactions.sql:27-29` vs `010_…sql` | Replay of a key whose tx was later deleted → unique violation → error instead of replay. Edge case; fix by dropping the `deleted_at` filter in that lookup. |
| Replay response has no `wallet_balance` | `transaction_handler.go:43-57` | Client must invalidate `["wallets"]` after sync anyway — fine |
| Expense uses `DecrementWalletBalanceIfSufficient` | `transaction_service_create.go:129-140` | **A queued expense can be rejected on replay with `INSUFFICIENT_BALANCE`** → outbox must keep it as "failed", not drop it |
| Update/delete: no version / `updated_at` check | `queries/transactions.sql:132+` | Reason to keep update/delete online-only in v1 |
| No delta sync (`updated_since`) | — | Not needed for v1 (cache + refetch on reconnect is enough for one user, few devices) |
| `newIdempotencyKey()` uses `Math.random` | `mobile/src/lib/idempotency-key.ts:9-15` | Acceptable (scoped per user); `expo-crypto.randomUUID()` is in Expo Go if we want CSPRNG |

### Constraints

- **Expo Go SDK 54** (`mobile/AGENTS.md:5`): `@react-native-community/netinfo`, `expo-network`, `expo-sqlite`, AsyncStorage are in Expo Go. **MMKV, WatermelonDB, PowerSync need a dev build** → out.
- CLAUDE.md rule: server data lives in TanStack Query only, never copied into Zustand. An outbox of **not-yet-sent** writes is client state, not server data — allowed, but it must not mirror server rows.

---

## 3. Options

| Option | How | Pros | Cons | Verdict |
|---|---|---|---|---|
| **A. Full local DB (offline-first)** | `expo-sqlite` mirror of wallets/tx/… + sync engine + delta endpoints | Full offline incl. edits, reports | Big: delta sync API, conflict rules, balance recomputation on device, duplicates server business rules; WatermelonDB/PowerSync need dev build | ❌ over-scoped |
| **B. TanStack-only** | Persist query cache + persist **paused mutations** (`setMutationDefaults` + `resumePausedMutations`) | Least code, official pattern | Paused mutations are opaque: no "N pending" list, no edit/discard of a failed one; a non-network rejection (INSUFFICIENT_BALANCE) is dropped after retries; cache & queue share one blob | ⚠️ OK for reads, weak for money writes |
| **C. Hybrid** — TanStack persisted cache for **reads** + a small explicit **outbox** for transaction **create** | Outbox = Zustand `persist` (AsyncStorage), per-user, FIFO, flushed by `onlineManager` | Visible, user-controllable queue; reuses existing idempotency; no native deps; tiny backend change | Must render pending items next to server list (merge in the UI layer) | ✅ **Recommended** |

---

## 4. Recommended design (Option C), phased

### Phase 0 — stop the bleeding (S, do first, valuable even without offline)
1. ✅ **Done 2026-10-04:** `refreshSession()` now only `clear()`s when `/auth/refresh` answers 400/401/403; offline / timeout / 5xx keeps the session and retries after `REFRESH_RETRY_DELAY_SECONDS` (30 s). Remaining for the spec: also retry immediately on reconnect (`onlineManager.subscribe`) and on app foreground.
2. ✅ **Done 2026-10-04:** `setTokens()` clears the query cache only when the user id in the access token changes (login / different account), not on rotation.
3. Wire `onlineManager` to NetInfo and `focusManager` to `AppState` (standard RN setup for TanStack v5) → queries pause offline and refetch on reconnect/foreground.
4. Global offline banner ("Đang ngoại tuyến — hiển thị dữ liệu đã lưu") + a distinct network-error message in `getErrorMessage`.

### Phase 1 — read offline (S–M)
- `PersistQueryClientProvider` + `@tanstack/query-async-storage-persister` (both pure JS).
- `gcTime` ≥ `maxAge` (e.g. 24 h–7 d), `buster` = app version, storage key **per user** (e.g. `pfm_query_cache:<user_id>`), removed on logout.
- `shouldDehydrateQuery` allow-list: wallets, categories, budgets, report-summary, first page of transactions. Never AI/chat/audit/export.
- Keep financial PII on-device in mind: AsyncStorage is unencrypted (same exposure as the chat thread today). Acceptable for v1; document it.

### Phase 2 — record offline (M)
- `src/stores/outbox-store.ts` (Zustand persist, key `pfm_outbox:<user_id>`): items `{ idempotency_key, payload, enqueued_at, status: pending|sending|failed, error_code? }`.
- `occurred_at` is **always** set on enqueue (device time, UTC) — otherwise the server stamps sync time.
- Create flow: online → normal mutation; offline or network error → enqueue (same `idempotency_key`), toast "Đã lưu, sẽ đồng bộ khi có mạng".
- Flusher: on reconnect / foreground / app start → send FIFO, one at a time; 201/200 → remove + invalidate `transactions`, `wallets`, `report-summary`, `budgets` (then `checkBudgetLimit`); network error → stop, retry later; 4xx (e.g. `INSUFFICIENT_BALANCE`, deleted wallet/category) → mark `failed`, user can edit / retry / discard.
- UI: pending rows shown at the top of the transaction list with a "chờ đồng bộ" badge; wallet balance shows a hint "chưa tính N giao dịch chờ" (don't fake a projected balance in v1).
- Logout with a non-empty outbox → confirm dialog (sync now / discard). Another user logging in never sees or flushes it (per-user key).
- Offline: AI chat send, update/delete, wallet/category/budget CRUD are disabled with "Cần kết nối mạng"; the manual form stays usable.

### Backend (S)
- Fix the soft-deleted idempotency lookup (§2 Gaps).
- Optionally return `wallet_balance` on replay too.
- No new endpoint for v1. Delta sync (`GET /transactions/changes?since=`) only if multi-device offline becomes a real need.

---

## 5. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Double-booked transaction on retry | Wrong balance | Existing `idempotency_key` + unique index; key generated once per entry and persisted with it |
| Lost queued transaction (app killed, logout, user switch) | Missing record | Persisted outbox; logout guard; per-user key; never auto-discard failed items |
| Replay rejected (insufficient balance, wallet/category deleted elsewhere) | Item stuck | `failed` state with edit/discard; error code shown in Vietnamese |
| Stale balances/budgets shown offline | User misreads money left | Banner + "cập nhật lúc HH:mm" on cached screens; pending hint on balances |
| Budget alert fires late (after sync) | Late warning | Run `checkBudgetLimit` after each flushed item |
| Unencrypted cache on device | Financial data at rest | Same as today's chat thread; exclude sensitive queries; clear on logout |
| Token expired while offline > 7 days | Must re-login | Outbox survives re-login of the **same** user, flushes after |
| Device clock wrong | Odd `occurred_at` | User can see/edit before sync; server keeps its own `created_at` |

---

## 6. Effort estimate (rough)

| Phase | Work | Size |
|---|---|---|
| 0 | session refresh fix, cache-clear fix, NetInfo/AppState wiring, banner | S |
| 1 | persister, per-user key, dehydrate allow-list | S–M |
| 2 | outbox store, flusher, list/balance UI, disabled states, logout guard | M |
| BE | idempotency lookup fix (+ optional replay balance), tests | S |
| QA | airplane-mode matrix on device: cold start, mid-save, kill app, reconnect, user switch | ~1 day |

New deps (all Expo Go SDK 54-compatible): `@react-native-community/netinfo`, `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister`.

---

## 7. Verdict

**Feasible without leaving Expo Go, and without a local database.** The hard backend part (idempotent create) already exists. Phase 0 is effectively a bug fix — today the app logs users out when offline and wipes its cache on every token rotation — and should ship first regardless. Phases 1–2 give the must-have (read + record offline) with roughly one M-sized mobile feature.

Next steps if approved:
1. Add a Feature user story to `SRS.md` §6 ("Use the app without network").
2. `/cook-ba` → `/cook-plan` for `specs/mobile-offline-support/` (Phase 0 can be its own small spec).

Sources: [TanStack Query — Mutations (persisting offline mutations)](https://tanstack.com/query/latest/docs/framework/vue/guides/mutations) · [TanStack Query — Network mode](https://www.mintlify.com/tanstack/query/guides/network-mode) · [TanStack Query in React Native 2026 (onlineManager/focusManager, persistence)](https://reactnativerelay.com/de/article/tanstack-query-react-native-datenfetching) · [Expo SDK 54 — AsyncStorage](https://docs.expo.dev/versions/v54.0.0/sdk/async-storage/) · [Offline-first LLD: local store, sync queue, idempotency](https://www.techinterview.org/post/3233470567/lld-offline-first/)
