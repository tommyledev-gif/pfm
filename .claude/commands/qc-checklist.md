# Review Guidelines & Checklist: Quality Step

---

## Rules

### Block Definitions

| Block | Purpose |
|---|---|
| Guidelines | Principles to understand and follow when performing this section |
| Principles | Mandatory conditions that apply to the entire file — must not be violated |
| Criteria | Specific check items that can be answered Yes/No |
| If Failed | Concrete action to take when a criterion is not met |
| Examples | Illustrative examples of the correct format or output |

### How to Use

1. Read the **Guidelines** of a section before starting.
2. Check each **Criteria** in order — tick `[x]` if it passes, clearly note the reason if it fails.
3. If a criterion fails, immediately perform the corresponding action in **If Failed** before moving on to the next criterion.
4. A section only passes when all criteria in that section pass.

### Scope

- This file applies to a single Quality Step, identified by the metadata at the top of the file (`story-number`, etc.).
- Every placeholder such as `[feature-folder]` must be replaced with the actual value from the metadata block before performing any step.

### Execution Order

1. Perform the sections in order from top to bottom.
2. Do not skip any section, even if it seems irrelevant.
3. **Global Checks** must all pass before performing any other section.
4. If **GP01** fails (missing file), stop immediately and do not continue.

### Output

- Only report issues and propose fixes — do not edit any file unless explicitly requested.
- When asked to fix something, only edit `specs/[feature-folder]/test_cases.md` and `testing/[feature-folder]/test_[feature-id].spec.ts`.
- Do not edit the base files: `SRS.md`, `SDS.md`, `constitution.md`.

### Primary Source Documents

| Document | Purpose |
|---|---|
| `specs/[feature-folder]/spec.md` | Primary source for building `test_cases.md` and Playwright Code |
| `specs/[feature-folder]/plan.md` | Primary source for building `test_cases.md` and Playwright Code |
| `specs/[feature-folder]/SDS.md` | Cross-check technical details, validation rules, and error messages when `spec.md` is not clear enough |
| `specs/[feature-folder]/SRS.md` | Cross-check the original business requirements when there is a dispute about scope |
| `constitution.md` | General codebase principles/conventions, applied when other documents do not specify clearly |
| Current implementation (source code) | Cross-check actual behavior when documentation does not describe enough detail to write a test case |

- When source documents conflict with each other, apply the following priority order:
  **`spec.md` > `plan.md` > `constitution.md` > `SDS.md` > `SRS.md` > Current implementation**
- Report conflicts clearly — do not silently pick one side without stating a reason.

### Acceptance

- `test_cases.md` and the Playwright Code are only considered valid when **all** criteria in **every** section pass.
- A section passing does not mean the entire file passes.

---

## Test Data

### Seeded Data

#### `roles` Table

| id | name |
|---|---|
| 1 | ADMIN |
| 2 | HR |
| 3 | FA |
| 4 | PM |
| 5 | DM |

#### `users` Table

> Note: All default passwords are `example@123` (hashed with Bcrypt: `$2a$12$16SpnHB00d0AWohgCuJZNul7jF0PwkmMri1xboVzDRFTaZe6xGWZa`)

| id | email | password (bcrypt hash) | failed_attempts | locked_until | employee_id |
|---|---|---|---|---|---|
| 1 | admin.user@pfm.local | `$2a$12$16SpnHB00d0AWohgCuJZNul7jF0PwkmMri1xboVzDRFTaZe6xGWZa` | 0 | NULL | NULL |
| 2 | hr.user@pfm.local | `$2a$12$16SpnHB00d0AWohgCuJZNul7jF0PwkmMri1xboVzDRFTaZe6xGWZa` | 0 | NULL | NULL |
| 3 | fa.user@pfm.local | `$2a$12$16SpnHB00d0AWohgCuJZNul7jF0PwkmMri1xboVzDRFTaZe6xGWZa` | 0 | NULL | NULL |
| 4 | pm.user@pfm.local | `$2a$12$16SpnHB00d0AWohgCuJZNul7jF0PwkmMri1xboVzDRFTaZe6xGWZa` | 0 | NULL | NULL |
| 5 | dm.user@pfm.local | `$2a$12$16SpnHB00d0AWohgCuJZNul7jF0PwkmMri1xboVzDRFTaZe6xGWZa` | 0 | NULL | NULL |

#### `users_roles` Table

| user_id | role_id | Corresponding role |
|---|---|---|
| 1 | 1 | ADMIN |
| 2 | 2 | HR |
| 3 | 3 | FA |
| 4 | 4 | PM |
| 5 | 5 | DM |

### UI Error Messages

| Scenario | HTTP | Error Code | Message |
|---|---|---|---|
| Missing or invalid CSRF token | 403 | `INVALID_CSRF_TOKEN` | Lỗi bảo mật phiên làm việc. |
| Invalid credentials (unknown email or wrong password) | 401 | `INVALID_CREDENTIALS` | Email hoặc mật khẩu không chính xác. |
| Too many attempts within rate-limit window | 429 | `TOO_MANY_ATTEMPTS` | Đăng nhập sai quá nhiều lần. Vui lòng chờ một lát rồi thử lại. |
| Account locked after exceeding failure threshold | 423 | `ACCOUNT_LOCKED` | Tài khoản của bạn hiện đang bị khóa. Vui lòng liên hệ quản trị viên. |
| Required field missing (email or password blank) | 422 | `VALIDATION_ERROR` | Dữ liệu nhập vào không hợp lệ. Vui lòng kiểm tra lại các trường thông tin. |
| Session store unavailable | 500 | `INTERNAL_SERVER_ERROR` | Hệ thống máy chủ đang gặp sự cố. Vui lòng thử lại sau. |
| No active session (GET `/api/v1/auth/me` without valid session) | 401 | `AUTH_UNAUTHORIZED` | Phiên làm việc hết hạn. Vui lòng đăng nhập lại. |

---

## Review Checklist

### Global Checks

**Before You Start**
- Read the entire metadata block at the top of the file, and make sure the placeholders (`[feature-folder]`, `[entity]`, etc.) have been replaced with actual values before starting any criteria.
- Identify the actual paths of `spec.md`, `plan.md`, `SDS.md`, `SRS.md`, `test_cases.md`, and the Playwright spec file corresponding to `story-number`.

**Principles**
- Do not proceed to any other section until Global Checks have all passed.
- Every review must be based on the actual content of the files — do not guess when information is missing; if missing, treat it as a failure and report it clearly.
- Apply the document priority order defined in "Primary Source Documents" whenever there is a conflict.

**Criteria**
- [ ] **GP01** — The file `specs/[feature-folder]/spec.md` exists and contains Acceptance Criteria for `[story-number]`.
- [ ] **GP02** — The file `specs/[feature-folder]/plan.md` exists.
- [ ] **GP03** — The file `constitution.md` exists at the repo root.
- [ ] **GP04** — The file `specs/[feature-folder]/test_cases.md` exists (if not, create a new file with the correct structure: Seeded User, UI Error Messages, Coverage Matrix, Integration Test Cases, E2E Test Cases).
- [ ] **GP05** — The Playwright file `testing/[feature-folder]/test_[feature-id].spec.ts` exists (if not, mark the Playwright Code criteria as N/A, do not stop the entire review).
- [ ] **GP06** — The "UI Error Messages" table in Test Data has no empty placeholders — it has been filled in based on `spec.md`/`SDS.md`.

**If Failed**
- **GP01/GP02/GP03**: Stop immediately, clearly report the missing file, and do not perform any other section.
- **GP04**: Create a new `test_cases.md` with all 5 standard headings, then continue the review.
- **GP05**: Mark the Playwright Code section as N/A, but continue completing the `test_cases.md` sections.
- **GP06**: Cross-check `spec.md`/`SDS.md` to fully populate the UI Error Messages table before moving on to the Coverage Matrix.

---

### Artifacts

**Guidelines**
- Determine in advance all the file paths related to `[feature-folder]`/`[story-number]` that will be used throughout the following sections, to avoid having to look them up repeatedly.

**Principles**
- Only review files that actually exist in the repo at the time the checklist is run — do not assume the content of files that have not been read.

**Criteria**
- [ ] **AR01** — `specs/[feature-folder]/spec.md` exists and has an Acceptance Criteria section for `[story-number]`.
- [ ] **AR02** — `specs/[feature-folder]/test_cases.md` exists and has at least 3 headings: Coverage Matrix, Integration Test Cases, E2E Test Cases.
- [ ] **AR03** — The Playwright spec file `testing/[feature-folder]/test_[feature-id].spec.ts` exists, following the project's naming/path convention.
- [ ] **AR04** — The shared helpers (e.g. `session`, `apiRequest`, `navigateAs*`...) exist and can be imported from the Playwright spec file.

**If Failed**
- **AR01/AR02/AR03**: Clearly report the missing file/section, stop at this section, and do not proceed to the `test_cases.md` review.
- **AR04**: Report the missing helper, and propose adding the helper before writing new Playwright code — do not create a duplicate helper for functionality that already exists.

---

### `test_cases.md`: Seeded Data

**Guidelines**
- Test cases must use the correct seeded user/role/entity already defined in the Test Data block — do not fabricate data that does not exist in the system.

**Principles**
- Do not create a new user/entity with the same role as seeded data if the test case's goal is simply to verify behavior for an existing role/state — the seeded data must be reused.
- If separate data is needed to corrupt a state (lockout, expired, disabled...), the newly created entity must have a `TestQC-` prefix, and the seeded data itself must not be modified directly.

**Criteria**
- [ ] **SU01** — Every role/permission group relevant to `[story-number]` has at least one test case using the corresponding seeded user.
- [ ] **SU02** — The values (email, password, id...) used in the test case exactly match the Seeded Data declared in Test Data.
- [ ] **SU03** — The test case does not create a new entity that duplicates a seeded entity; if separate data is needed for a specific test case, it is named/identified with a `TestQC-` prefix.
- [ ] **SU04** — Special state fields in the seeded data (e.g. number of failed attempts, lockout timestamp, active/inactive status...) are used in the correct context as described in the test case.

**If Failed**
- Update the test case to use the correct seeded data, or add a new row to the Seeded Data table if the case requires a state that does not yet exist (clearly explain why the addition is needed, do not modify Seeded Data arbitrarily without stating a reason).

---

### `test_cases.md`: UI Error Messages

**Guidelines**
- Test cases must only assert the exact message listed in the "UI Error Messages" table — do not paraphrase or fabricate messages.

**Principles**
- The UI Error Messages table must be completed before writing the Coverage Matrix and Test Cases; if it still has blank cells/placeholders, this section is considered not yet eligible to pass.

**Criteria**
- [ ] **EM01** — The UI Error Messages table in Test Data has been fully filled in, correctly referencing `spec.md`/`SDS.md`.
- [ ] **EM02** — Every test case that validates an error correctly cites the exact Code/Message from this table — no message is hardcoded elsewhere in the test case or in the Playwright code.
- [ ] **EM03** — Every validation rule/business error that appears in `spec.md` has a corresponding row in the UI Error Messages table — no message is missing.

**If Failed**
- Cross-check `spec.md`/`SDS.md` and add any missing message to the UI Error Messages table.
- If a message is not clearly defined in the source documents, report the conflict/gap according to the document priority order — do not fabricate a message just to complete the checklist.

---

### `test_cases.md`: Coverage Matrix

**Guidelines**
- The Coverage Matrix is where every Acceptance Criterion, Edge Case, and Functional Requirement in `spec.md`/`plan.md` is cross-checked against the corresponding `TC-NN` entries in `test_cases.md`, ensuring no case is missed — regardless of whether it can be executed via UI (E2E), via API (Integration), or both.

**Principles**
- An AC/Functional Requirement is only considered "covered" when it has a corresponding TC at both layers (Integration + E2E) if that flow can be executed via both UI and API.
- Field validation must be fully tested according to the exact rule defined in `spec.md`/`SDS.md`, including boundary values — not just one generic "valid" case and one generic "invalid" case.
- Before writing a test case for an input field, the full set of validation rules applicable to that field (format, length, allowed characters, specific policy...) must be identified — do not write cases based on guesswork.
- If a role/user does not have permission to perform an action, that functionality must not be displayed on the UI for that role/user — this is a separate check from blocking at the API layer, and blocking at the API layer alone must not be considered sufficient.
- If the US issues or uses an authentication token/cookie (CSRF Token, Session Cookie, Access Token...), all 4 states must be tested: present & valid, invalid, expired, absent.

**Criteria**
- [ ] **CM01** — Every Acceptance Criterion in `spec.md` has at least one `TC-NN` reference (AC reference column) — no AC is missed.
- [ ] **CM02** — For every business flow that can be executed via both UI and API, there is a corresponding TC in both Integration Test Cases and E2E Test Cases.
- [ ] **CM03** — Validation test cases fully cover every rule of each field, including boundaries (e.g. exact limit, exceeding limit, missing required characters, containing disallowed characters...).
- [ ] **CM04** — Every input field relevant to `[story-number]` has its validation rules clearly listed (cross-checked against `spec.md`/`SDS.md`) before generating the test case.
- [ ] **CM05** — Unhappy paths are covered: validation errors, rejected states (rejected/blocked/locked), business guardrail violations.
- [ ] **CM06** — Edge cases are covered: boundary values, empty/null input, duplicate or concurrent actions.
- [ ] **CM07** — If the US issues/uses an authentication token or cookie, there are sufficient TCs for all 4 states: valid, invalid, expired, absent.
- [ ] **CM08** — For every role that does not have permission to perform an action relevant to `[story-number]`, there is a TC confirming that the functionality/button/area is not displayed on the UI for that role — not just testing that the API blocks it.

**If Failed**
- Add the missing TCs to `test_cases.md`, and update the Coverage Matrix to correctly reference the AC.
- If validation rule information is missing (CM04) because `spec.md`/`SDS.md` does not state it clearly, report it according to the document priority order — do not infer the rule yourself just to pass.

---

### `test_cases.md`: Integration Test Cases

**Guidelines**
- Integration Test Cases verify API behavior independently of the UI — focusing on status codes, response bodies, and the main business flows.

**Principles**
- Each test sets up all the data it needs within the test itself (except for data referenced from Seeded Data), and does not depend on the execution order of other tests.

**Criteria**
- [ ] **IT01** — The entity ID is extracted directly from the response of the creation request (`const { id } = await res.json()`), not from a GET list.
- [ ] **IT02** — Validation error assertions use `expect([400, 422]).toContain(res.status)`.
- [ ] **IT03** — Business rule conflict assertions use `expect(res.status).toBe(409)`.
- [ ] **IT04** — Each test creates all required data fresh within the test, without depending on or modifying shared seeded data.
- [ ] **IT05** — There are API-layer TCs for all main business flows, including cases involving tokens/cookies (if applicable at the API layer), consistent with CM07.

**If Failed**
- Correct how the ID is extracted / how assertions are written according to the conventions above.
- Add the missing TCs to Integration Test Cases, ensuring test data is created fresh in each test.

---

### `test_cases.md`: E2E Test Cases

**Guidelines**
- E2E Test Cases simulate real user behavior on the UI, and must closely follow the project's selector conventions and interaction flow.

**Principles**
- Selectors must be stable, prioritizing ID to reduce flaky tests.
- Avoid unnecessary actions (e.g. toggling a filter/panel) when the desired selector can be used directly.

**Criteria**
- [ ] **E01** — Selectors are prioritized in this order: ID first (`#btn-save-{id}`, `#message-success`), then text, then role.
- [ ] **E02** — Custom dropdowns (if any) are handled as `ul > li > button` structures, without assuming any ARIA role.
- [ ] **E03** — The filter/panel is not toggled manually if the corresponding selector can be used directly (e.g. `#search-name`, `#btn-search`).
- [ ] **E04** — After creating data via the API, filter by name/identifier before clicking action buttons, to avoid pagination issues.
- [ ] **E05** — Text locators are scoped within the main container (e.g. `#table-x`) to avoid matching hidden content (e.g. mobile cards).
- [ ] **E06** — Access-denied/error messages use `waitFor({ state: 'visible' })` when the UI displays the message inline (no redirect).
- [ ] **E07** — For functionality that the current role does not have permission to perform, the TC confirms that the control/area is not displayed on the UI — not just checking for an error message when attempting to access it.

**If Failed**
- Correct the selectors/interaction flow in the test case according to the conventions.
- Add missing TCs regarding hiding/showing functionality based on permissions.

---

### Playwright Code

**Guidelines**
- Playwright code must be consistent with `test_cases.md` — each `TC-NN` corresponds to exactly one test case in code, with nothing missing and nothing extra.

**Principles**
- Do not modify/delete tests that already exist from previous USs — only add new ones (append).
- Reuse existing helpers, and avoid duplicating logic.

**Criteria**
- [ ] **PC01** — Every record created by a test is prefixed with `TestQC-[entity]-${Date.now()}`.
- [ ] **PC02** — Existing helpers (`session`, `apiRequest`, `navigateAs*`, etc.) are reused, and similar logic is not rewritten in the new file.
- [ ] **PC03** — New Playwright tests are appended to the existing `.spec.ts` file (per AR03); existing tests are not modified or removed.
- [ ] **PC04** — Every `TC-NN` in `test_cases.md` (Integration + E2E) has exactly one corresponding test in code, with a comment/test name referencing the `TC-NN` for traceability.
- [ ] **PC05** — Every E2E test captures a screenshot of the exact UI state required by its `TC-NN`: if the test case expects a success message, error message, toast, or validation state, the test must first assert/wait for that element to be visible (e.g. `await expect(locator).toBeVisible()`), then take the screenshot with that element in view — scrolling to or focusing the element (`locator.scrollIntoViewIfNeeded()`) if necessary. Screenshots taken before the expected element appears, or of unrelated parts of the page, do not count as evidence.

**If Failed**
- Fix the record naming to follow the prefix convention.
- Refactor the code to reuse existing helpers instead of writing new ones.
- If an existing test has been modified/deleted, revert it and only append new tests.
- Add missing tests to achieve a 1:1 match with `test_cases.md`.
- If a screenshot does not show the expected element (success/error message, toast, validation state), add the proper `expect(...).toBeVisible()` wait and `scrollIntoViewIfNeeded()` before capturing, so the screenshot clearly shows the element required by the `TC-NN`.