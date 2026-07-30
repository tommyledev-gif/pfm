# MUST NOT VIOLATE — Implementation Coding (src code)

> Scope: Backend — every file under `internal/` or `cmd/` (Go) and `app/` or `src/` (Python) — handlers, services, repositories, schemas/DTOs, middleware. Frontend — every file under `lib/` (Flutter) — screens, widgets, blocs/providers, repositories, models.
> Violation = PR blocked. No exception without explicit tech-lead sign-off.

---

## BACKEND — LAYERING

### Go
- [ ] `*gin.Context` / `http.Request` / `http.ResponseWriter` **never** passed into or held by a Service (business-logic) struct — extract what's needed (actor, params) at the Handler layer and pass plain values/structs down.
- [ ] Auth/identity (`userID`, `role`, claims) resolved once in middleware and passed down via typed params or `context.Context` values — never re-parsed from the raw request inside a Service or Repository.
- [ ] Authorization checks (role/permission) live in the **Service** layer — never in the Handler, never in the Repository.
- [ ] Handlers are thin: bind/parse input → call service → map result to HTTP response. No business logic in Handlers.
- [ ] Repository layer only talks to the datastore — no business rules, no authorization, no HTTP concerns.

### Python
- [ ] The framework's request object (`Request` in FastAPI, `HttpRequest` in Django) **never** passed into or held by a Service class — extract what's needed at the View/Route layer.
- [ ] Auth/identity resolved once via dependency injection (FastAPI `Depends`) or middleware (Django) and passed down as explicit params — never re-derived inside a Service or Repository/Manager.
- [ ] Authorization checks (permission/role) live in the **Service** layer — never in the View/Route handler, never in the Repository/Manager.
- [ ] Views/Routes are thin: validate input (via Pydantic/serializer) → call service → return response. No business logic in Views/Routes.
- [ ] Repository/Manager/DAO layer only talks to the datastore — no business rules, no authorization.

---

## BACKEND — TRANSACTIONS

### Go
- [ ] DB writes spanning more than one statement are wrapped in an explicit transaction (`db.BeginTx` / `sqlx.Tx` / GORM `db.Transaction(func(tx *gorm.DB) error {...})`) — no implicit multi-statement writes on the raw connection.
- [ ] Every transaction has explicit commit/rollback handling — `defer` a rollback-on-error pattern, never leave a transaction "hanging" on an early return.
- [ ] Read-only queries never open a transaction — use the plain connection/session.
- [ ] Transaction boundaries live in the Service layer, not the Repository — a Repository method should not open its own transaction if it's meant to be composed with other writes.

### Python
- [ ] Multi-statement writes wrapped in an explicit transaction: SQLAlchemy `with session.begin():` / Django `transaction.atomic()` — no relying on autocommit for multi-step writes.
- [ ] Read-only operations (GET/list/find) never wrapped in `transaction.atomic()` or an explicit write transaction.
- [ ] Every transactional block has explicit, deliberate rollback behavior on exception — no bare `try/except: pass` swallowing a failed write.
- [ ] Transaction boundaries declared at the Service layer, not inside a Repository/Manager method meant to be composed with others.

---

## SECURITY

- [ ] Passwords always hashed before persistence — `bcrypt` (Go: `golang.org/x/crypto/bcrypt`; Python: `passlib`/`bcrypt`) — no plain-text comparison, no plain-text storage.
- [ ] User roles/claims fully resolved (from DB or JWT) **before** any authorization check runs — no partial-claims race.
- [ ] CSRF validation applied to every state-changing endpoint (POST/PUT/PATCH/DELETE) that is cookie-session authenticated. Pure token/JWT-bearer APIs may skip CSRF but must document why in the endpoint's doc comment.
- [ ] No sensitive field (password, token, secret, API key) ever appears in a log statement — mask/redact before logging, in both Go (`log.Printf`/structured logger) and Python (`logging`).
- [ ] No `.env` values, secrets, or credentials hardcoded in source — verified in diff before every push, in both backend repos.
- [ ] Flutter: no API keys, secrets, or backend credentials embedded in Dart source or committed `.env`/`--dart-define` files — injected via secure build config only.
- [ ] Flutter: tokens/session data stored via secure storage (`flutter_secure_storage`) — never in plain `SharedPreferences`.

---

## HTTP STATUS CODES (backend)

| Situation | Correct code |
|---|---|
| Unauthenticated (no/invalid token) | 401 |
| Authenticated but lacks permission | 403 |
| Malformed request / bad input format | 400 |
| Business/role validation failed (server understood request) | 422 |
| Duplicate / business conflict | 409 |

- [ ] 401/403 responses logged at `WARN` level with: method, path, userId (if available), required role.
- [ ] Error log messages describe the **specific** cause — no generic `"error occurred"` / `"something went wrong"`.
- [ ] Flutter: every non-2xx response is mapped to a typed error/failure object (not a raw string) before it reaches the UI layer.

---

## BACKEND — ERROR HANDLING

### Go
- [ ] Errors wrapped with context at each layer (`fmt.Errorf("...: %w", err)`) and handled centrally — a single error-to-HTTP-response mapping layer (middleware or a shared responder), not ad-hoc `c.JSON(...)` scattered per handler.
- [ ] No swallowed errors — every returned `error` is either handled or explicitly propagated; never `_ = err` outside of genuinely ignorable cases (with a comment explaining why).
- [ ] Sentinel/typed errors (`errors.Is` / `errors.As` targets) used for known business error cases — no string-matching on error messages to decide behavior.

### Python
- [ ] Exceptions raised once at the point of detection and handled by a single global exception handler (FastAPI exception handler / Django middleware) — no catch-and-rethrow ping-pong between layers.
- [ ] Custom exception classes used for known business errors (e.g. `BusinessConflictError`) — no relying on bare `Exception` or string matching.
- [ ] Every raised exception maps to a specific, documented error code in the global handler.

---

## VALIDATION

### Go
- [ ] Request structs use validation tags (e.g. `validator` package `binding:"required,email"`) — no manual `if x == ""` duplicating what tags already cover.
- [ ] Validation errors collected and returned as a **single** structured response — not field-by-field separate responses.

### Python
- [ ] Request schemas validated via Pydantic models (FastAPI) or serializers (DRF) — no manual dict-key checks duplicating schema validation.
- [ ] Validation errors returned as a **single** structured response body, not raised one at a time.

### Flutter
- [ ] Form/input validation on the client is a UX aid only — backend validation is the source of truth; no feature ships that trusts client-side validation alone.
- [ ] Validators are pure functions (no side effects, no API calls) so they're testable in isolation.

---

## AUDIT LOGGING

- [ ] Audit logic lives in a **shared** audit service/module (e.g. `internal/audit` in Go, `app/audit` in Python) — no duplicated audit code per feature.
- [ ] Every audit entry contains: `timestamp`, `entityId`, `actorUserId`, `actorRole`, `action`, `result`.
- [ ] `ipAddress` and `requestPath` fetched fresh per-request — **never** cached in session/token claims.
- [ ] Audit storage is permanent (DB/file/log pipeline) — never in-memory only.
- [ ] Login, logout, Business Unit create/update, and any config-data change must produce an audit entry.

---

## NAMING & CONVENTIONS

- [ ] No Vietnamese text in code, comments, or committed docs — English only, across Go, Python, and Dart.
- [ ] No AI-generated filler comments left in code. Comments only for genuinely non-obvious logic. Max 30 words per comment.

### Go
- [ ] Exported identifiers use `PascalCase`, unexported use `camelCase` — no `_` in names, no Hungarian notation.
- [ ] No package-name stutter: `businessunit.Create()`, not `businessunit.CreateBusinessUnit()`.
- [ ] Error variables named `Err...` (e.g. `ErrNotFound`), sentinel errors declared at package level.
- [ ] Interfaces named for behavior (`Repository`, `Notifier`), not prefixed with `I`.

### Python
- [ ] PEP 8 throughout: `snake_case` for functions/variables, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants.
- [ ] Request/response schema names are action-specific: `CreateBusinessUnitRequest`, `CreateBusinessUnitResponse` — no single generic `BusinessUnitSchema` reused for every operation.
- [ ] Method names inside a service use short contextual form: `create()` inside `BusinessUnitService`, not `create_business_unit()`.

### Flutter / Dart
- [ ] `lowerCamelCase` for variables/functions, `PascalCase` for classes/widgets/enums, per Dart style guide.
- [ ] Widget files and class names match (`business_unit_card.dart` → `BusinessUnitCard`).
- [ ] State classes/notifiers named for what they manage: `BusinessUnitListCubit`, not generic `AppState` reused everywhere.
- [ ] No magic numbers/strings in widgets (padding, durations, route names) — extracted to named constants or a theme/config file.

### Cross-cutting
- [ ] Array/collection params use plural names: `employeeIds`, `roles`, not `employeeId`, `role`.
- [ ] No magic numbers — numeric literals (page size, limits, thresholds, timeouts) must be named constants, in backend and Flutter code alike.
- [ ] Entity/model names match SRS §2 domain language exactly — `User` not `UserAccount`, etc., consistent across Go, Python, and Dart models.

---

## DATA ACCESS

### Go
- [ ] ORM/query layer (GORM, sqlx, or raw `database/sql`) used consistently per service — no mixing raw SQL and ORM calls for the same entity without a documented reason.
- [ ] N+1 query risk reviewed explicitly on any loop that triggers a per-item query; batch-fetch or eager-load instead.
- [ ] Context (`context.Context`) passed through every DB call for cancellation/timeout propagation — no DB call made without a context.

### Python
- [ ] ORM session/engine lifecycle managed explicitly (request-scoped session, closed/returned after use) — no leaked sessions across requests.
- [ ] `select_related` / `prefetch_related` (Django) or eager loading (`joinedload`, SQLAlchemy) used deliberately wherever a collection is traversed — N+1 risk reviewed on every such case.
- [ ] Many-to-Many gets a dedicated association model **only** if the join table has extra attributes beyond the two foreign keys.

---

## FLUTTER — ARCHITECTURE

- [ ] Business/state logic lives in a Bloc/Cubit/Provider/Riverpod notifier — never directly inside a `StatefulWidget`'s `build()` or event handlers.
- [ ] Widgets are as dumb as possible: they read state and dispatch events/intents; they do not call the API layer or repository directly.
- [ ] API access is centralized in a repository/data-source layer — no raw `http`/`dio` calls scattered inside widgets or state classes.
- [ ] Navigation logic is centralized (named routes or a router package) — no hardcoded `Navigator.push(MaterialPageRoute(...))` duplicated across the app for the same destination.
- [ ] `BuildContext` never stored/used across an `async` gap without a `context.mounted` check.
- [ ] Null-safety respected fully — no `!` (bang operator) used to silence a nullability the code hasn't actually verified.

---

## PR HYGIENE

- [ ] Code self-tested and verified working before review request.
- [ ] No `.env` / secrets visible in the PR diff — check before push, across all three codebases.
- [ ] PR not merged without ≥1 review approval.
- [ ] All review comments addressed (or explicitly discussed) before merge.
- [ ] Jira ticket updated: assignee, worklog, demo report attached if step requires it.