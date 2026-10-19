Personal Finance Management

Software Design Specification (SDS)

**Table of Contents**

- [1. Introduction – Personal Finance Management](#1-introduction-personal-finance-management)
  - [1. Purpose](#1-purpose)
  - [2. Scope](#2-scope)
  - [3. Assumptions and Constraints](#3-assumptions-and-constraints)
    - [1. Assumptions](#1-assumptions)
    - [2. Constraints](#2-constraints)
    - [3. Definitions and Acronyms](#3-definitions-and-acronyms)
- [2. Domain Model](#2-domain-model)
  - [1. Domain Objects](#1-domain-objects)
    - [1. User](#1-user)
    - [2. Wallet](#2-wallet)
    - [3. Category](#3-category)
    - [4. Budget](#4-budget)
    - [5. Transaction](#5-transaction)
    - [6. FinancialGoal](#6-financialgoal)
    - [7. InvestmentPortfolio](#7-investmentportfolio)
    - [8. Asset](#8-asset)
    - [9. Holding](#9-holding)
    - [10. Notification](#10-notification)
    - [11. ChatMessage](#11-chatmessage)
  - [2. Domain Object Relationships](#2-domain-object-relationships)
- [3. UI Design](#3-ui-design)
  - [1. Wireframe](#1-wireframe)
  - [2. UI/UX Principles](#2-uiux-principles)
- [4. Architecture Design](#4-architecture-design)
  - [1. System Context](#1-system-context)
  - [2. Logical View](#2-logical-view)
  - [3. Development View](#3-development-view)
    - [1. System Architecture](#1-system-architecture)
    - [2. Data Design](#2-data-design)
  - [4. Process View](#4-process-view)
  - [5. Physical View](#5-physical-view)
  - [6. Key Scenarios (Scenario View +1)](#6-key-scenarios-scenario-view-1)
  - [7. Architecture Principles](#7-architecture-principles)
- [5. Product Features & User Story Specification](#5-product-features-user-story-specification)
  - [1. Feature-01: User Management](#1-feature-01-user-management)
    - [1. US-01-01: Register a User](#1-us-01-01-register-a-user)
  - [2. Feature-02: System Security](#2-feature-02-system-security)
    - [1. US-02-01: Login](#1-us-02-01-login)
    - [2. US-02-02: Logout](#2-us-02-02-logout)
    - [3. US-02-03: Switch Between Saved Accounts](#3-us-02-03-switch-between-saved-accounts)
    - [4. US-02-04: Require Device Unlock Before Switching](#4-us-02-04-require-device-unlock-before-switching)
    - [5. US-02-05: Log Out of All Devices](#5-us-02-05-log-out-of-all-devices)
    - [6. US-02-06: See and Sign Out Signed-in Devices](#6-us-02-06-see-and-sign-out-signed-in-devices)
    - [7. US-02-07: Change Password](#7-us-02-07-change-password)
    - [8. US-02-08: Lock the App](#8-us-02-08-lock-the-app)
  - [3. Feature-03: Wallet Management](#3-feature-03-wallet-management)
    - [1. US-03-01: Create a Wallet](#1-us-03-01-create-a-wallet)
  - [4. Feature-04: Category Management](#4-feature-04-category-management)
    - [1. US-04-01: Create a Category](#1-us-04-01-create-a-category)
  - [5. Feature-05: Budget Management](#5-feature-05-budget-management)
    - [1. US-05-01: Create a Budget for a Category](#1-us-05-01-create-a-budget-for-a-category)
  - [6. Feature-06: Transaction Management](#6-feature-06-transaction-management)
    - [1. US-06-01: Create a Transaction for a Wallet](#1-us-06-01-create-a-transaction-for-a-wallet)
  - [7. Feature-07: Financial Reporting](#7-feature-07-financial-reporting)
  - [8. Feature-08: Financial Goal](#8-feature-08-financial-goal)
  - [9. Feature-09: Investment Portfolio](#9-feature-09-investment-portfolio)
  - [10. Feature-10: Notification Handling](#10-feature-10-notification-handling)
  - [11. Feature-11: Data Overview Dashboard](#11-feature-11-data-overview-dashboard)
  - [12. Feature-12: AI Chat Assistant](#12-feature-12-ai-chat-assistant)
    - [1. US-12-01: Create a Transaction via Chat](#1-us-12-01-create-a-transaction-via-chat)
  - [13. Feature-13: AI Budget Setup Wizard](#13-feature-13-ai-budget-setup-wizard)
    - [1. US-13-01: Set Up Budgets via Wizard](#1-us-13-01-set-up-budgets-via-wizard)
- [6. API Design](#6-api-design)
  - [1. API Design Standards](#1-api-design-standards)
  - [2. API Index](#2-api-index)
  - [3. API Specification](#3-api-specification)
    - [1. `POST /wallets`](#1-post-wallets)
    - [2. `GET /wallets`](#2-get-wallets)
    - [3. `GET /wallets/{id}`](#3-get-walletsid)
    - [4. `POST /categories`](#4-post-categories)
    - [5. `POST /budgets`](#5-post-budgets)
    - [6. `POST /transactions`](#6-post-transactions)
    - [7. `PUT /transactions/{id}`](#7-put-transactionsid)
    - [8. `POST /ai/chat`](#8-post-aichat)
    - [9. `GET /ai/budget-wizard/prefill`](#9-get-aibudget-wizardprefill)
    - [10. `POST /ai/budget-proposals`](#10-post-aibudget-proposals)
    - [11. `POST /budgets/bulk`](#11-post-budgetsbulk)
    - [12. `POST /auth/refresh`](#12-post-authrefresh)
    - [13. `GET /auth/sessions`](#13-get-authsessions)
    - [14. `DELETE /auth/sessions/{id}`](#14-delete-authsessionsid)
    - [15. `PUT /users/me/password`](#15-put-usersmepassword)
  - [4. API  → User Story Traceability](#4-api-user-story-traceability)
- [7. Security Design](#7-security-design)
  - [1. Authentication](#1-authentication)
  - [2. Authorization](#2-authorization)
  - [3. Threat Modeling](#3-threat-modeling)
- [8. Non-Functional Requirements](#8-non-functional-requirements)
- [9. Design Decisions and Trade-offs](#9-design-decisions-and-trade-offs)
- [10. Product Metrics](#10-product-metrics)
  - [1. Purpose](#1-purpose-1)
  - [2. Metric Categories](#2-metric-categories)
  - [3. Core Metrics for PFM](#3-core-metrics-for-pfm)
    - [1. Adoption and Engagement Metrics](#1-adoption-and-engagement-metrics)
    - [2. Financial Behavior Improvement Metrics](#2-financial-behavior-improvement-metrics)
    - [3. Operational Quality Metrics](#3-operational-quality-metrics)
    - [4. Notification and Awareness Metrics](#4-notification-and-awareness-metrics)
  - [4. MVP Metric Measurement Scope](#4-mvp-metric-measurement-scope)
  - [5. Privacy and Ethics Considerations](#5-privacy-and-ethics-considerations)
- [11. Future Enhancements](#11-future-enhancements)
- [12. Appendix](#12-appendix)
  - [1. Known Issues Log](#1-known-issues-log)

# 1. Introduction – Personal Finance Management {#1-introduction-personal-finance-management}

## 1. Purpose {#1-purpose}

This document defines the **Software Design Specification (SDS)** for the **Personal Finance Management (PFM)** system.

The purpose of this document is to describe how the PFM product is designed to satisfy the requirements defined in the [**SRS**](https://docs.google.com/document/d/17SbJrDvMbExf3JNQmrE2PKiCSbllqY6OwsuPQWeloNo/edit?tab=t.0), following structures and practices commonly used in real-world software projects.

## 2. Scope {#2-scope}

This SDS describes the design of the PFM product as a whole, independent of a specific release. The design is intended to evolve across multiple releases.  
**Within the KPITAI course**, learners will implement an MVP subset of this design for learning purposes, while the SDS remains the reference design for future extensions.

## 3. Assumptions and Constraints {#3-assumptions-and-constraints}

### 1. Assumptions {#1-assumptions}

* Users manually input personal financial data.  
* The system is initially implemented as a Monolith.  
* The design supports incremental growth across releases.

### 2. Constraints {#2-constraints}

* External banking integrations are not required in early releases.  
* Implementation code is not included in this document.

### 3. Definitions and Acronyms {#3-definitions-and-acronyms}

* SDS – Software Design Specification  
* SRS – Software Requirements Specification  
* PFM – Personal Finance Management  
* US – User Story  
* API – Application Programming Interface

# 2. Domain Model {#2-domain-model}

This section describes the core business concepts of the PFM domain and their relationships, independent of technical implementation.

Domain objects are grouped by delivery phase, per the [Feature-level Release table in the SRS](SRS.md#feature-level-release-overview) and the [MVP Features table in CLAUDE.md](CLAUDE.md#mvp-features):

| Phase | Domain Objects |
| --- | --- |
| **Phase 0** (current scope — see [docs/features.md](docs/features.md)) | User |
| **MVP** | Wallet, Category, Budget, Transaction, Notification |
| **Release 1** | FinancialGoal, ChatMessage |
| **Release 2** | InvestmentPortfolio, Asset, Holding |

## 1. Domain Objects {#1-domain-objects}

### 1. User {#1-user}

Represents an account holder. Created via admin invite — no self-registration (see [docs/features.md](docs/features.md) Feature-01). Owns essentially every other domain object: each Wallet, user-defined Category, Budget, Transaction, Notification, FinancialGoal, and InvestmentPortfolio belongs to exactly one User.

Key attributes: `id`, `email`, `full_name`, `password_hash`, `status` (pending/active/disabled), `role` (admin/member), `invited_by`, `invite_token`, `invite_expires_at`, `activated_at`.

### 2. Wallet {#2-wallet}

A source or destination of money (cash, bank account, e-wallet). All Transactions are recorded against a Wallet, and its `balance` is updated atomically with every Transaction insert (same DB transaction — CLAUDE.md).

Key attributes: `id`, `user_id`, `name`, `type`, `balance` (BIGINT, integer cents), `currency`, `is_default`, `icon` *(planned)*, `icon_url` *(planned)*. The last two mirror Category's icon/photo pattern (§2.1.3) for visual recognition in the Wallet list — not yet implemented; see §12.1 Known Issues Log, Item 3.

### 3. Category {#3-category}

Classifies Transactions for budgeting and reporting (e.g. Food, Salary). May be **system-defined** (`user_id IS NULL`, shared across all Users) or **user-defined** (`user_id` set, private to that User).

Key attributes: `id`, `user_id` (nullable), `name`, `icon`, `icon_url`, `type` (income/expense). `icon` is a free-text emoji/short label; `icon_url` is an uploaded photo (`POST /categories/icon`) and takes display precedence over `icon` when both are set — see §12.1 Known Issues Log for the current rollout status of this capability.

### 4. Budget {#4-budget}

A spending limit a User sets for a Category within a period (e.g. monthly), tracked across **all** of the User's Wallets for that Category (not scoped to a single Wallet — see resolution below). The System tracks actual spend — computed from Transactions in that Category — against the Budget's per-currency limits.

Key attributes: `id`, `user_id`, `category_id`, `limits` (a non-empty set of `(currency, amount_limit)` pairs, at most one entry per currency, each `amount_limit` a BIGINT), `period`, `start_date`, `icon` *(planned)*, `icon_url` *(planned)*. The last two let a Budget's own visual identity diverge from its Category's, for the Budget list (mobile `insights.tsx`) — not yet implemented; see §12.1 Known Issues Log, Item 3.

> **Resolved** (was previously an open question): SRS (Feature-05, BF-01 step 5) originally framed a Budget as scoped to *both* a Wallet and a Category. BA clarification (see `specs/budget-management/spec.md`) settled this as **Category-only, aggregated across all Wallets** — the better product model for a personal-finance budgeting feature, not just the path of least schema change. `SRS.md` BF-01/BF-04 wording has been updated to match. A direct consequence of dropping the Wallet scope is that a Category's Transactions can span Wallets of different currencies, so a Budget can no longer hold one blended `amount_limit` — it instead holds independent per-currency limits, each tracked (spent/remaining/status) separately; a currency with real spend but no corresponding limit entry is simply not tracked by that Budget. See `specs/budget-management/spec.md` for full detail.

A Budget may also be created **in bulk**, as a full replacement of a User's existing Budgets, via the AI Budget Setup Wizard (SRS Feature-13, §5.13 below) — this reuses the exact same validation and ownership rules as an individual `POST /budgets` call, just applied to a batch inside one DB transaction, not a separate write path.

### 5. Transaction {#5-transaction}

A single income or expense event. Always belongs to exactly one Wallet and one Category, and to the User who owns that Wallet.

Key attributes: `id`, `user_id`, `wallet_id`, `category_id`, `amount` (BIGINT), `type` (income/expense), `note`, `occurred_at`.

### 6. FinancialGoal {#6-financialgoal} *(Release 1)*

A savings target a User defines (e.g. emergency fund, travel). Tracks progress toward a target amount by a target time frame, based on recorded Transactions/allocations (SRS FR-05, BF-06).

### 7. InvestmentPortfolio {#7-investmentportfolio} *(Release 2)*

A single portfolio per User ("Investment Index" — SRS Feature-09) that aggregates all of that User's Holdings for a high-level performance view.

### 8. Asset {#8-asset} *(Release 2)*

A reference definition of something investable (e.g. a stock ticker, a fund). Exists independently of any User or Portfolio — shared reference data, analogous to a system Category.

### 9. Holding {#9-holding} *(Release 2)*

A position of a specific Asset held inside a User's InvestmentPortfolio, with an amount and current value (SRS FR-06).

### 10. Notification {#10-notification}

A system-generated message to a User (e.g. budget limit reached). Read-only from the User's perspective except for `is_read` toggling (Feature-10).

Key attributes: `id`, `user_id`, `type`, `title`, `body`, `is_read`, `created_at`.

### 11. ChatMessage {#11-chatmessage} *(Release 1)*

A single message exchanged between a User and the AI Chat Assistant (SRS Feature-12), either from the User or the assistant. When a message results in a created/updated Transaction, it links back to the affected Transaction(s) for audit/traceability — the AI never writes to the database directly; it only proposes actions that a User must confirm through the standard Transaction Management flow (FR-02).

Key attributes: `id`, `user_id`, `conversation_id`, `role` (user/assistant), `content`, `intent`, `transaction_ids` (nullable array, set once confirmed), `created_at`.

An assistant ChatMessage may also carry an `action_type` of `"budget_wizard"` (SRS Feature-13) instead of a Transaction proposal — a tappable card that opens the Budget Setup wizard rather than something the User confirms inline in the thread. This shares the table/columns above; it does not need its own domain object.

> **Schema note:** realizing this feature also requires two small additions to existing MVP tables, not new domain concepts: (1) `categories.description` (nullable) so the AI can disambiguate between similarly-named Categories, and (2) an idempotency mechanism for `POST /transactions` (e.g. a unique `idempotency_key` column or a dedicated keys table) so a duplicate confirm-tap from the chat UI cannot create a duplicate Transaction. Exact shape to be finalized at `/cook-plan` time.

## 2. Domain Object Relationships {#2-domain-object-relationships}

**Conceptual Data Model (CDM)** — composition (`*--`, filled diamond) marks a part with no meaning or lifecycle outside its whole; aggregation (`o--`, hollow diamond) marks a part that can exist independently of the whole; a plain association (`-->`) marks a reference/classification link with no ownership semantics.

```mermaid
classDiagram
    class User {
      +UUID id
      +string email
      +string status
      +string role
    }
    class Wallet {
      +UUID id
      +string name
      +BIGINT balance
      +string currency
    }
    class Category {
      +UUID id
      +UUID user_id
      +string name
      +string type
    }
    class Budget {
      +UUID id
      +Map~currency,BIGINT~ limits
      +string period
    }
    class Transaction {
      +UUID id
      +BIGINT amount
      +string type
      +TIMESTAMPTZ occurred_at
    }
    class Notification {
      +UUID id
      +string type
      +bool is_read
    }
    class FinancialGoal {
      +BIGINT target_amount
      +date target_date
    }
    class InvestmentPortfolio
    class Asset {
      +string name
    }
    class Holding {
      +BIGINT amount
      +BIGINT current_value
    }
    class ChatMessage {
      +UUID id
      +UUID conversation_id
      +string role
      +string content
      +string intent
    }

    User "1" *-- "0..*" Wallet : owns
    User "1" *-- "0..*" Transaction : records
    User "1" *-- "0..*" Notification : receives
    User "1" *-- "0..*" Budget : sets
    User "0..1" o-- "0..*" Category : defines (user-defined only)
    User "1" *-- "0..*" FinancialGoal : sets
    User "1" *-- "0..1" InvestmentPortfolio : owns
    User "1" *-- "0..*" ChatMessage : exchanges

    Wallet "1" *-- "0..*" Transaction : holds history of

    Transaction "0..*" --> "1" Category : classified by
    Budget "0..*" --> "1" Category : limits spending on
    ChatMessage "0..*" --> "0..*" Transaction : proposes/confirms

    InvestmentPortfolio "1" *-- "0..*" Holding : contains
    Holding "0..*" --> "1" Asset : references
```

**Relationship summary**

| # | From | Relationship | To | Cardinality | Type | Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | User | owns | Wallet | 1 : 0..* | Composition | A Wallet has no meaning without its owning User; `wallets.user_id` is mandatory |
| 2 | User | records | Transaction | 1 : 0..* | Composition | Every Transaction belongs to exactly one User |
| 3 | User | receives | Notification | 1 : 0..* | Composition | Notifications are generated for and owned by one User |
| 4 | User | sets | Budget | 1 : 0..* | Composition | Budgets are per-User spending limits |
| 5 | User | defines | Category | 0..1 : 0..* | Aggregation | System Categories exist with `user_id = NULL` — independent of any User |
| 6 | User | sets | FinancialGoal | 1 : 0..* | Composition | Goal has no meaning outside its owning User (Release 1) |
| 7 | User | owns | InvestmentPortfolio | 1 : 0..1 | Composition | Exactly one Portfolio per User, per SDS Feature-09 (Release 2) |
| 8 | Wallet | holds history of | Transaction | 1 : 0..* | Composition | Transaction requires a Wallet (`wallet_id` mandatory); balance update and insert are atomic |
| 9 | Category | classifies | Transaction | 1 : 0..* | Association | Category is reusable reference data, not owned by any single Transaction |
| 10 | Category | limits | Budget | 1 : 0..* | Association | Budget references a Category to track against |
| 11 | InvestmentPortfolio | contains | Holding | 1 : 0..* | Composition | A Holding has no meaning outside its Portfolio (Release 2) |
| 12 | Asset | referenced by | Holding | 1 : 0..* | Association | Asset is shared reference data across all Portfolios (Release 2) |
| 13 | User | exchanges | ChatMessage | 1 : 0..* | Composition | A ChatMessage has no meaning outside its owning User's conversation (Release 1) |
| 14 | ChatMessage | proposes/confirms | Transaction | 0..* : 0..* | Association | A ChatMessage may reference the Transaction(s) it created or edited, once User-confirmed; the AI never persists a Transaction on its own |

Note: derived figures such as Wallet `balance` or Budget "spent so far" are **computed from Transactions**, not separate stored relationships — they are covered by rows 8–9 above, not modeled as their own line.

# 3. UI Design {#3-ui-design}

## 1. Wireframe {#1-wireframe}

## 2. UI/UX Principles {#2-uiux-principles}

* **Keyboard-safe forms** — whichever field a User is actively typing into must stay visible above the on-screen keyboard, on both iOS and Android, in every bottom-sheet form (Wallet/Category/Budget/Transaction — all built on the shared `Drawer` component). Do not reach for `KeyboardAvoidingView` or a wrapping third-party scroll library by default: the project already hit and worked around a confirmed Android bug where `KeyboardAvoidingView`'s `height` behavior fails to restore layout after the keyboard closes (facebook/react-native#22884), and replaced it with a custom `useKeyboardHeight()` hook (`mobile/src/lib/use-keyboard-height.ts`) already used by the AI Chat screen. New keyboard-safety work should extend that hook's usage (e.g. into `Drawer.tsx`) rather than introduce a second, inconsistent approach — see §12.1 Known Issues Log, Item 2.
* **Consistent icon/photo picking** — any entity that supports a visual icon (Category today; Wallet and Budget planned) should reuse the same interaction pattern established by `CategoryFormModal.tsx`: an `Avatar` preview, an immediate upload-on-pick via `expo-image-picker` (not deferred to form submit), and a free-text emoji fallback used only when no uploaded photo is set.
* **Multi-step guided flows** — a flow that collects several pieces of input before a single confirmed write (e.g. the AI Budget Setup Wizard, §5.13) is presented as one dismissible, full-screen sequence with a visible progress indicator; dismissing at any step discards all in-progress input — nothing is saved until the final explicit confirmation.

# 4. Architecture Design {#4-architecture-design}

This chapter describes **the system architecture** using **multiple architectural views**, a common industry practice to ensure different stakeholders can understand the system from different perspectives.

This SDS explicitly uses:

* **C4 Model** to visualize system structure at different levels  
* **“4+1 Views” Model** to organize architectural views

The following tools are recommended to create and maintain architectural diagrams:

* **draw.io** (diagrams.net) – supports all “4+1 Views” and C4 diagrams using free-form notation  
* **PlantUML** – for text-based diagrams and version control

## 1. System Context {#1-system-context}

(**C4 Model – System Context Diagram**)

The PFM provides personal finance management capabilities to individual users.

* Primary actors: End Users  
* External systems: None (initially)

This view defines the system boundary and its interaction with external actors.

## 2. Logical View {#2-logical-view}

(**“4+1 Views” Model – Logical View**)

At a logical level, the PFM system consists of the following major functional areas:

* User Management  
* System Security  
* Wallet Management  
* Category Management  
* Budget Management  
* Transaction Management  
* Financial Reporting  
* Notification Handling

This view focuses on responsibilities and separation of concerns, not implementation details.

## 3. Development View {#3-development-view}

(**“4+1 Views” Model – Development View**)

### 1. System Architecture {#1-system-architecture}

The system is organized using a **3-Layer Architecture**: 

**Controller → Service → Repository (DAO)**

Technology Stack

* **POC**: Flet/PyQt6 - Python - CSV  
* **MVP**: React - DRF - Django ORM - SQLite  
* **Releases**: TBD

Suggested code organization:

* controller  
* service  
* repository  
* model  
* dto  
* security  
* common

This view supports maintainability and team collaboration.

### 2. Data Design {#2-data-design}

**Data Integrity Rules**

This section defines business rules and constraints derived from the domain model.

* AI Chat Assistant (Feature-12): the AI Service never writes to the database directly. Every AI-proposed `create_transaction` / `edit_transaction` action is a **suggestion only**; it becomes a real write exclusively through the standard `POST /transactions` / `PUT /transactions/{id}` endpoints, after explicit User confirmation.  
* Any Wallet/Category ID returned by the AI Service must be **re-validated for ownership** by the Backend before use — the AI Service is untrusted input with respect to authorization, even though it runs on the internal Docker network (see §7 Security Design).

**Database Design**

This section maps the Domain Model to the physical Database Structure.

## 4. Process View {#4-process-view}

(**“4+1 Views” Model – Process View**)

Typical runtime behavior:

* Controller receives request  
* Service applies business rules  
* Repository accesses data  
* Response is returned to the UI

Concurrency and performance optimizations may be introduced in later releases.

## 5. Physical View {#5-physical-view}

(**“4+1 Views” Model – Physical View**)

Initial deployment:

* Single application instance  
* Single database  
* Separate development and production environments

This view may evolve as scalability requirements grow.

## 6. Key Scenarios (Scenario View +1) {#6-key-scenarios-scenario-view-1}

Key scenarios are used to validate that the system architecture can support real business needs.

Each scenario corresponds to a User Story defined in Chapter 5.

These scenarios represent the Scenarios (+1 View) of the “4+1 Views” Model.

**Scenario Index** 

| Scenario ID | Feature | User Story | MVP | Notes |
| ----- | ----- | ----- | :---: | ----- |
| S-URM-01 | Feature-01: User Management | **US-01-01 Register a User** | ✔ | Entry point for new users |
| S-SEC-01 | Feature-02: System Security | **US-02-01 Login** | ✔ | Required before protected actions |
| S-WAL-01 | Feature-03: Wallet Management | **US-03-01 Create a Wallet** | ✔ | Core financial container |
| S-CAT-01 | Feature-04: Category Management | **US-04-01 Create a Category** | ✔ | Used by transactions |
| S-BUD-01 | Feature-05: Budget Management | **US-05-01 Create a Budget for a Category** | ✔ | Spending control |
| S-TRX-01 | Feature-06: Transaction Management | **US-06-01 Create a Transaction for a Wallet** | ✔ | Primary core scenario |
| S-RPT-01 | Feature-07: Financial Reporting | **US-07-01 View the Summary Report** | ✔ | Insight & feedback loop |
| S-NOT-01 | Feature-10: Notification Handling | **US-10-01 View the list of Notifications** | ✔ | User awareness |
| S-CHAT-01 | Feature-12: AI Chat Assistant | **US-12-01 Create a Transaction via Chat** |  | Reuses Transaction Management write path; Release 1 |
| S-BWZ-01 | Feature-13: AI Budget Setup Wizard | **US-13-01 Set Up Budgets via Wizard** |  | Reuses Budget Management's write path; Release 1 |

## 7. Architecture Principles {#7-architecture-principles}

* Keep domain pure  
* Secure by default  
* API-first  
* Data consistency first  
* Fail-safe  
* Idempotency for finance ops  
* Observability ready  
* Logs are first-class signals

  # 

# 5. Product Features & User Story Specification {#5-product-features-user-story-specification}

This chapter provides build-ready design details per Feature and User Story, aligned with the [SRS](https://docs.google.com/document/d/17SbJrDvMbExf3JNQmrE2PKiCSbllqY6OwsuPQWeloNo/edit?tab=t.0).

## 1. Feature-01: User Management {#1-feature-01-user-management}

### 1. US-01-01: Register a User {#1-us-01-01-register-a-user}

      ## 

## 2. Feature-02: System Security {#2-feature-02-system-security}

### 1. US-02-01: Login {#1-us-02-01-login}

### 2. US-02-02: Logout {#2-us-02-02-logout}

* Logout ends the device's session on the server (`POST /auth/logout` with its refresh token); the access token stops working at its next request, because every request is checked against its session (§7.1).

### 3. US-02-03: Switch Between Saved Accounts {#3-us-02-03-switch-between-saved-accounts}

*Release 1, mobile only. Full design: `specs/mobile-account-switch/` (revised 2026-10-19).*

* Every login on a phone saves that account on the phone (at most 5 per device) together with the refresh token of its own device-bound session.
* Switching = `POST /auth/refresh` with the target account's refresh token. The previous account's session is not ended; it stays saved, so switching back needs no password either.
* A refresh result is always stored for the account it belongs to, even if the phone switched to another account while it was running.
* A refused refresh marks only that account "Hết phiên" (password or passkey needed); the other saved accounts are untouched.
* *Changed 2026-10-19:* switching used to redeem a separate 180-day single-use switch token (`POST /auth/switch`); those endpoints are deprecated and kept only for older app builds (§6.2).

### 4. US-02-04: Require Device Unlock Before Switching {#4-us-02-04-require-device-unlock-before-switching}

* Before a switch, the phone asks for its fingerprint, face or screen-lock code (on by default, per device). The check runs on the phone only; no server call.

### 5. US-02-05: Log Out of All Devices {#5-us-02-05-log-out-of-all-devices}

* `POST /auth/sessions/revoke-all` (self) and `POST /admin/users/{id}/sessions/revoke-all` (admin) set the user's sign-out point and end every session of the user; the caller's own device gets a fresh session in the same answer. Other devices are refused at their next request.

### 6. US-02-06: See and Sign Out Signed-in Devices {#6-us-02-06-see-and-sign-out-signed-in-devices}

* `GET /auth/sessions` lists the caller's live sessions (device name or "Thiết bị không rõ tên", created, last used, `is_current`), most recently used first.
* `DELETE /auth/sessions/{id}` ends one of them (reason `device_sign_out`, one audit log line). The current session is refused with 400 (it uses logout); another user's session is 404.

### 7. US-02-07: Change Password {#7-us-02-07-change-password}

* `PUT /users/me/password` checks the current password, then in one UPDATE stores the new hash and moves the sign-out point to now, ends every session of the user and returns a fresh session for the calling device.
* A wrong current password is 400 `WRONG_CURRENT_PASSWORD`, never 401 (the mobile client reads 401 as "session over"). At most 5 failed tries per user per 15 minutes.

### 8. US-02-08: Lock the App {#8-us-02-08-lock-the-app}

* Opt-in, per device, off by default. When on, the app asks for the phone's fingerprint, face or screen-lock code on a cold start and after 5 minutes in the background, before any signed-in screen is visible. A screen gate only: stored tokens are not locked and background renewal continues (see §9).

      ## 

## 3. Feature-03: Wallet Management {#3-feature-03-wallet-management}

### 1. US-03-01: Create a Wallet {#1-us-03-01-create-a-wallet}

## 4. Feature-04: Category Management {#4-feature-04-category-management}

### 1. US-04-01: Create a Category {#1-us-04-01-create-a-category}

## 5. Feature-05: Budget Management {#5-feature-05-budget-management}

### 1. US-05-01: Create a Budget for a Category {#1-us-05-01-create-a-budget-for-a-category}

## 6. Feature-06: Transaction Management {#6-feature-06-transaction-management}

### 1. US-06-01: Create a Transaction for a Wallet {#1-us-06-01-create-a-transaction-for-a-wallet}

**Goal:** Allow an authenticated User to create an income or expense Transaction for a Wallet they own.

**Preconditions**: 

* User is authenticated.  
* Wallet exists and belongs to the user.

**Layers Involved**:

* TransactionController  
* TransactionService  
* TransactionRepository  
* WalletRepository  
* CategoryRepository (optional)  
* Budget / Notification logic (optional)

**APIs Involved:** 

Endpoint: `POST /transactions`

Success Response

* transaction_id  
* status  
* message

Error Responses

* 400 INVALID_INPUT  
* 403 WALLET_ACCESS_DENIED  
* 404 WALLET_NOT_FOUND

Main Flow

* Controller receives request and validates input.  
* Service validates wallet ownership.  
* Service creates a Transaction.  
* Repository persists data transactionally.  
* Optional: budget update and notification trigger.  
* Controller returns a response.

## 7. Feature-07: Financial Reporting {#7-feature-07-financial-reporting}

## 8. Feature-08: Financial Goal {#8-feature-08-financial-goal}

## 9. Feature-09: Investment Portfolio {#9-feature-09-investment-portfolio}

## 10. Feature-10: Notification Handling {#10-feature-10-notification-handling}

## 11. Feature-11: Data Overview Dashboard {#11-feature-11-data-overview-dashboard}

## 12. Feature-12: AI Chat Assistant {#12-feature-12-ai-chat-assistant}

### 1. US-12-01: Create a Transaction via Chat {#1-us-12-01-create-a-transaction-via-chat}

**Goal:** Allow an authenticated User to create one or more Transactions by sending a natural-language chat message, with explicit confirmation before any write.

**Preconditions**:

* User is authenticated.  
* User has at least one Wallet (a default Wallet is used when the message does not name one).

**Client:** implemented on both `frontend/` (web) and `mobile/` (React Native, `app/(app)/ai-chat.tsx` + `src/features/ai-chat/`) — mobile reached feature parity with web for this flow as of the `455bfb1`→`fe4f6cc` commit range (see `docs/architecture.md` §3).

**Layers Involved**:

* ChatHandler → ChatService (Go Backend)  
* WalletRepository, CategoryRepository (context injection: the User's own Wallets/Categories, never another User's)  
* AI Service client (internal REST call to Python AI Service, per CLAUDE.md architecture — reuses the existing Groq-primary/Anthropic-fallback client, no new provider)  
* TransactionRepository (only invoked after User confirmation, via the existing `POST /transactions` flow)

**APIs Involved:**

Endpoint: `POST /ai/chat`

Success Response

* message (assistant reply, Vietnamese)  
* intent (`create_transaction` | `edit_transaction` | `query_spending` | `general_advice` | `ambiguous`)  
* actions[] — proposed Transaction payload(s), each with a pre-generated idempotency key and a confidence score; empty for query/advice/ambiguous intents

Error Responses

* 400 INVALID_INPUT  
* 502 AI_SERVICE_UNAVAILABLE (Groq/Anthropic both failing — return a retryable error, do not crash)

Main Flow

* Controller receives the message and validates input.  
* Service loads the User's own Wallets and Categories as context.  
* Service calls the AI Service, which returns a structured intent + proposed action(s).  
* Service **re-validates that every Wallet/Category ID in the response belongs to the requesting User** before returning it to the client — the AI Service is treated as untrusted input for authorization purposes (see §7 Security Design).  
* For `create_transaction` / `edit_transaction`, the client renders a confirmation card; nothing is persisted until the User confirms.  
* On confirmation, the client calls the existing `POST /transactions` (or `PUT /transactions/{id}`) endpoint, using the pre-generated idempotency key to guard against duplicate confirms.

## 13. Feature-13: AI Budget Setup Wizard {#13-feature-13-ai-budget-setup-wizard}

### 1. US-13-01: Set Up Budgets via Wizard {#1-us-13-01-set-up-budgets-via-wizard}

**Goal:** Let an authenticated User set up or replace their Budgets for a period by providing income and per-Category spending preferences, reviewing a proposed allocation, and confirming a single bulk create — instead of creating each Budget individually through Feature-05.

**Preconditions**:

* User is authenticated.
* User has at least one Wallet (used to resolve the default currency for the wizard).

**Client:** `mobile/` only for this release (React Native) — the same clients-first pattern Feature-12 used (mobile shipped before web); `frontend/` (web) parity is a follow-up, not scoped here.

**Layers Involved**:

* ChatHandler (existing, extended) → new `BudgetWizardPrefill`/`BudgetProposals` handler methods
* AI Service client (internal REST call, reuses the existing Groq-primary/Anthropic-fallback client — no new provider) for the allocation proposal and, only when the User describes a Category in free text, for suggesting a Category name
* CategoryRepository, BudgetRepository (context injection: the User's own Categories/Budgets, never another User's)
* BudgetHandler → BudgetService (existing, extended with a bulk create/replace method) — only invoked after User confirmation

**APIs Involved:**

Endpoint: `GET /ai/budget-wizard/prefill`

Success Response: default currency, the User's visible Categories, the User's existing Budgets

Error Responses: 401 UNAUTHENTICATED

Endpoint: `POST /ai/budget-proposals`

Success Response: a proposed amount and share of income per Category, plus the unallocated remainder

Error Responses: 400 INVALID_INPUT · 403 CATEGORY_ACCESS_DENIED (no 502 — this endpoint makes no AI Service call at all, see §9 Design Decisions)

Endpoint: `POST /budgets/bulk`

Success Response: the count and list of created Budgets

Error Responses: 400 INVALID_INPUT · 404 CATEGORY_NOT_FOUND · 403 CATEGORY_ACCESS_DENIED · 422 DUPLICATE_CATEGORY_IN_REQUEST

Main Flow

* User opens the wizard (quick action or AI Chat card) and the client loads prefill data.
* User enters income and, for each chosen Category, a spending preference.
* Service computes a proposed amount per Category in-process using a **fixed, rule-based allocation** — not free-form LLM generation, and no call to the AI Service at all for this step (see `specs/ai-budget-wizard/plan.md` Finding #6) — so the same input always produces the same proposal, with no dependency on AI Service uptime.
* User reviews and may adjust any proposed amount, purely client-side (no further AI call).
* On confirmation, the client calls `POST /budgets/bulk`, which **re-validates that every Category ID belongs to the requesting User** before writing, then atomically replaces the User's existing Budgets with the confirmed set, inside one DB transaction.

   # 

# 6. API Design {#6-api-design}

## 1. API Design Standards {#1-api-design-standards}

* REST-style APIs  
* Naming convention  
* Authentication style  
* Versioning /api/v1  
* Pagination  
* JSON request/response  
* Standard error structure:  
  * error_code  
  * message  
  * details (optional)
* **Framework-level routing errors must keep their real status** — a 404 for an unmatched route or a 405 for a mismatched HTTP verb (both raised by Fiber itself, before any handler runs) must be surfaced to the client with that real status and a matching `error_code` (e.g. `NOT_FOUND`, `METHOD_NOT_ALLOWED`), never coerced into a generic `500 INTERNAL_ERROR`. See §12.1 Known Issues Log, Items 1 & 4 for the confirmed bug this corrects (`backend/internal/response/response.go`'s `Error()` only special-cases `*common.AppError`; everything else — including Fiber's own `*fiber.Error`s — falls through to a blanket `INTERNAL_ERROR`, hiding the real cause from both the client and the logs).

## 2. API Index {#2-api-index}

| API ID | Endpoint | Feature |
| ----- | ----- | ----- |
| API-WAL-01 | `POST /wallets` | Wallet Management |
| API-WAL-02 | `GET /wallets` | Wallet Management |
| API-WAL-03 | `GET /wallets/{id}` | Wallet Management |
| API-TRX-01 | `POST /transactions` | Transaction Management |
| API-TRX-02 | `GET /transactions` | Transaction Management |
| API-TRX-03 | `GET /transactions/{id}` | Transaction Management |
| API-TRX-04 | `PUT /transactions/{id}` | Transaction Management |
| API-CHAT-01 | `POST /ai/chat` | AI Chat Assistant |
| API-BWZ-01 | `GET /ai/budget-wizard/prefill` | AI Budget Setup Wizard |
| API-BWZ-02 | `POST /ai/budget-proposals` | AI Budget Setup Wizard |
| API-BUD-06 | `POST /budgets/bulk` | Budget Management / AI Budget Setup Wizard |
| API-AUTH-01 | `POST /auth/login` | System Security |
| API-AUTH-02 | `POST /auth/logout` | System Security (also removes a saved account from a device) |
| API-AUTH-03 | `POST /auth/refresh` | System Security (also switches between saved accounts, since 2026-10-19) |
| API-AUTH-04 | `POST /auth/sessions/revoke-all` | System Security |
| API-AUTH-05 | `POST /admin/users/{id}/sessions/revoke-all` | System Security (admin) |
| API-AUTH-06 | `GET /auth/sessions` | System Security — new 2026-10-19 |
| API-AUTH-07 | `DELETE /auth/sessions/{id}` | System Security — new 2026-10-19 |
| API-AUTH-08 | `PUT /users/me/password` | System Security — new 2026-10-19 |
| API-AUTH-09 | `POST /auth/switch-token` | System Security — **deprecated 2026-10-19**, older app builds only |
| API-AUTH-10 | `POST /auth/switch` | System Security — **deprecated 2026-10-19**, older app builds and the one-time upgrade only |
| API-AUTH-11 | `POST /auth/switch-token/revoke` | System Security — **deprecated 2026-10-19**, older app builds and the one-time upgrade only |

Every mobile request carries `X-Device-Id` (a random id the app creates once) and `X-Device-Name` (URI-encoded); API-AUTH-01, 03, 04, 08 and 10 use them to bind the session to the device.

## 3. API Specification {#3-api-specification}

### 1. `POST /wallets` {#1-post-wallets}

### 2. `GET /wallets` {#2-get-wallets}

### 3. `GET /wallets/{id}` {#3-get-walletsid}

### 4. `POST /categories` {#4-post-categories}

### 5. `POST /budgets` {#5-post-budgets}

### 6. `POST /transactions` {#6-post-transactions}

| Main Flow | Success Response | Error Responses |
| ----- | ----- | ----- |
| Controller receives request and validates input. Service validates wallet ownership. Service creates a Transaction. Repository persists data transactionally. Optional: budget update and notification trigger. Controller returns a response.  | transaction_id status message | 400:  INVALID_INPUT 403:  WALLET_ACCESS_DENIED 404:  WALLET_NOT_FOUND  |

### 7. `PUT /transactions/{id}` {#7-put-transactionsid}

| Main Flow | Success Response | Error Responses |
| ----- | ----- | ----- |
| Controller receives request and validates input. Service validates the Transaction belongs to the requesting User. Service applies the update and re-adjusts the Wallet balance in the same DB transaction. Controller returns a response. | transaction_id status message | 400: INVALID_INPUT 403: WALLET_ACCESS_DENIED 404: TRANSACTION_NOT_FOUND |

### 8. `POST /ai/chat` {#8-post-aichat}

| Main Flow | Success Response | Error Responses |
| ----- | ----- | ----- |
| Controller receives message and validates input. Service loads the User's own Wallets/Categories as context, calls the AI Service, then re-validates ownership of every ID the AI Service returns before responding. No Transaction is written by this endpoint. | message intent actions[] | 400: INVALID_INPUT 502: AI_SERVICE_UNAVAILABLE |

### 9. `GET /ai/budget-wizard/prefill` {#9-get-aibudget-wizardprefill}

| Main Flow | Success Response | Error Responses |
| ----- | ----- | ----- |
| Controller loads the caller's visible Categories and existing Budgets. No AI Service call, no chat message recorded. | default_currency categories[] existing_budgets[] | 401: UNAUTHENTICATED |

### 10. `POST /ai/budget-proposals` {#10-post-aibudget-proposals}

| Main Flow | Success Response | Error Responses |
| ----- | ----- | ----- |
| Controller validates input, re-validates every Category ID belongs to the caller, then computes a rule-based allocation across the selected Categories entirely in-process (no AI Service call). No Budget is written by this endpoint. | proposals[] (per-Category amount + share) unallocated_amount | 400: INVALID_INPUT 403: CATEGORY_ACCESS_DENIED |

### 11. `POST /budgets/bulk` {#11-post-budgetsbulk}

| Main Flow | Success Response | Error Responses |
| ----- | ----- | ----- |
| Controller validates input. Service re-validates ownership of every Category ID, then atomically replaces the caller's existing Budgets with the submitted set inside one DB transaction. | created_count budgets[] | 400: INVALID_INPUT 404: CATEGORY_NOT_FOUND 403: CATEGORY_ACCESS_DENIED 422: DUPLICATE_CATEGORY_IN_REQUEST |

### 12. `POST /auth/refresh` {#12-post-authrefresh}

| Main Flow | Success Response | Error Responses |
| ----- | ----- | ----- |
| No access token needed; the refresh token in the body is the credential. Service loads its session, checks it is live (not revoked, within 60 days of its last renewal and 180 days of its sign-in), that the token is the session's current one (or the one replaced less than 5 minutes ago), and that the user is active and not signed out after the token was issued. An older token revokes the whole session. Then it rotates the token (compare-and-swap), slides the idle expiry and records the device if the session has none. On mobile this is also how a saved account is switched into. | access_token refresh_token | 400: INVALID_INPUT 401: UNAUTHENTICATED |

### 13. `GET /auth/sessions` {#13-get-authsessions}

| Main Flow | Success Response | Error Responses |
| ----- | ----- | ----- |
| Controller reads the caller and the caller's session id from the access token. Service lists the caller's live sessions only, most recently used first, marking the current one. | data[] (id, device_name or null, created_at, last_used_at, is_current) | 401: UNAUTHENTICATED |

### 14. `DELETE /auth/sessions/{id}` {#14-delete-authsessionsid}

| Main Flow | Success Response | Error Responses |
| ----- | ----- | ----- |
| Controller validates the id. Service refuses the caller's current session, refuses a session that is not the caller's, treats an already-ended one as done, otherwise revokes it (reason `device_sign_out`) and writes one audit log line (ids, role, IP). That device is refused at its next request and its next refresh. | null | 400: INVALID_INPUT 401: UNAUTHENTICATED 404: NOT_FOUND |

### 15. `PUT /users/me/password` {#15-put-usersmepassword}

| Main Flow | Success Response | Error Responses |
| ----- | ----- | ----- |
| Controller validates the body (current_password, new_password). Service checks the current password, the minimum length and that the new one differs; then stores the new hash and sets the sign-out point in one UPDATE, ends every session of the user (reason `password_changed`) and starts a fresh session for the calling device. One audit log line, never the password. At most 5 failed tries per user per 15 minutes. | access_token refresh_token | 400: INVALID_INPUT, WRONG_CURRENT_PASSWORD, WEAK_PASSWORD, SAME_PASSWORD 401: UNAUTHENTICATED 429: RATE_LIMITED |

## 4. API  → User Story Traceability {#4-api-user-story-traceability}

| API | Feature | US |
| ----- | ----- | ----- |
| `POST /wallets` | Wallet Management | US-03-01 |
| `PUT /transactions/{id}` | Transaction Management | US-12-02 (AI Chat edit flow) |
| `POST /ai/chat` | AI Chat Assistant | US-12-01, US-12-02, US-12-03 |
| `POST /transactions` | Transaction Management | US-06-01 |
| `GET /ai/budget-wizard/prefill` | AI Budget Setup Wizard | US-13-01 |
| `POST /ai/budget-proposals` | AI Budget Setup Wizard | US-13-01 |
| `POST /budgets/bulk` | Budget Management / AI Budget Setup Wizard | US-13-01 |
| `POST /auth/login` | System Security | US-02-01, US-02-03 |
| `POST /auth/logout` | System Security | US-02-02, US-02-03 |
| `POST /auth/refresh` | System Security | US-02-03 |
| `POST /auth/sessions/revoke-all`, `POST /admin/users/{id}/sessions/revoke-all` | System Security | US-02-05 |
| `GET /auth/sessions`, `DELETE /auth/sessions/{id}` | System Security | US-02-06 |
| `PUT /users/me/password` | System Security | US-02-07 |

# 7. Security Design {#7-security-design}

## 1. Authentication {#1-authentication}

All protected APIs require authenticated user context.

**Device-bound sessions** (sessions since migration 028, bound to a device since migration 033, 2026-10-19):

* Every sign-in (password or passkey) creates one row in `sessions`. The access token (15 minutes) and the refresh token both carry its id, and `JWTAuth` checks that session on **every request** (live, user active, not signed out since the token was issued), so ending a session takes effect at that device's next request.
* The app creates a random device id once and sends it with the device name on every request. A user has at most **one live session per device**: signing in again on that device ends the previous one. At most 5 live sessions per user; a 6th ends the least recently used. Web sends no device id; its sessions show as "Thiết bị không rõ tên".
* **Rotation and reuse detection:** every refresh replaces the refresh token. The server accepts only the current one, or the one it replaced less than 5 minutes ago (so an answer lost in a tunnel can be retried); presenting an older one revokes the whole session.
* **Lifetimes:** a session ends 60 days after its last refresh (sliding) or 180 days after its sign-in, whichever comes first. Access tokens live 15 minutes. *(Changed 2026-10-19: was 7 days idle, 30 days absolute.)*
* **Saved accounts on mobile:** each account saved on a phone keeps the refresh token of its own session there. Switching is a refresh of that session; there is no other long-lived credential. *(The 180-day switch token of 2026-10-04 is deprecated and served only to older app builds.)*
* **Ending sessions:** logout (that session), "Gỡ khỏi thiết bị" (that saved account's session), sign out one device (`DELETE /auth/sessions/{id}`), sign out everywhere (self or admin: every session, plus a sign-out point that refuses any token issued earlier), and **password change, which ends every session** of the user and gives the calling device a fresh one.
* **Storage on the phone:** tokens live in `expo-secure-store` (Keystore-encrypted, not biometric-bound — §9). Fingerprint, face or screen-lock code gate switching (on by default) and, optionally, opening the app (app lock).

## 2. Authorization {#2-authorization}

Users can only access data they own, for example: Wallet, Transaction, Category...

For AI Chat Assistant (Feature-12): the AI Service is treated as **untrusted input** with respect to authorization, even though it runs on the internal Docker network — the Go Backend must re-validate that every Wallet/Category ID the AI Service returns actually belongs to the requesting User before it is shown to the client or used in any write.

The same untrusted-input treatment applies to AI Budget Setup Wizard (Feature-13): every Category ID used in `POST /ai/budget-proposals` and `POST /budgets/bulk` is re-validated for ownership before use, identical to Feature-12's rule for `POST /ai/chat`.

## 3. Threat Modeling {#3-threat-modeling}

* **AI hallucinated ownership** — the AI Service could return a Wallet/Category ID belonging to a different User (model error, not necessarily malicious). Mitigated by mandatory ownership re-validation in `ChatService` before the response leaves the Backend (see §6.3 `POST /ai/chat`).  
* **Duplicate transaction from double-confirm** — a repeated tap on the chat confirmation card must not create two Transactions. Mitigated by an idempotency key pre-generated per proposed action (see Domain Model §11 ChatMessage, schema note).  
* **AI Service unavailability** — Groq/Anthropic outage must degrade to a clear retryable error on `POST /ai/chat`, never a crash or a silently-dropped write.  
* **Bulk budget replace race** — two devices submitting the AI Budget Setup Wizard for the same User concurrently could otherwise interleave into an inconsistent set of Budgets. Mitigated by locking the User's existing Budget rows before replacing them, inside one transaction, so the two requests serialize instead of interleaving (full design in `specs/ai-budget-wizard/plan.md`).
* **Lost or stolen phone** — whoever holds it can open every account saved on it until its sessions end. Mitigated by: signing that one device out from another device ("Thiết bị đang đăng nhập", `DELETE /auth/sessions/{id}`), "sign out everywhere", or changing the password (ends every session); each takes effect at the phone's next request. The identity check before switching and the optional app lock stop a casual finder of an unlocked phone. Residual: a passkey stored on that phone keeps working until it is deleted under "Passkey"; there is no password reset by email yet.
* **Stolen refresh token** (copied off a phone or out of a log) — usable from anywhere until detected. Mitigated by rotation on every refresh with reuse detection: once the owner's phone or the thief refreshes, the other copy becomes stale and presenting it revokes the whole session (the 5-minute grace for lost answers is the only window). Tokens are never logged. Residual: a thief who refreshes before the owner and keeps pace could hold the session until the owner's next refresh fails; the real fix is **phase 2** — a key pair made in the phone's key store at sign-in, its public half on the session (`sessions.public_key`, reserved), every refresh signing a server challenge.
* **Shared phone** — another household member using the same phone could walk into a saved account. Mitigated by the identity check before every switch (default on), the opt-in app lock on open and after 5 minutes in the background, "Gỡ khỏi thiết bị" (ends that account's session on the phone), and per-User separation of all local data on switch.
* **Leaked `JWT_SECRET`** — a forged token for a known user id. Access and refresh tokens need a live session row, so they cannot be forged usefully; the deprecated switch tokens are not tied to a row and can be redeemed until the secret is rotated or those endpoints are removed (`docs/ops-runbook.md` §5).

   # 

# 8. Non-Functional Requirements {#8-non-functional-requirements}

| No. | NFR | Design Approach |
| :---: | ----- | ----- |
| 1 | **Performance** | Indexed queries |
| 2 | **Availability** | Single-instance initially |
| 3 | **Scalability** | Clean layering |
| 4 | **Security** | Auth + ownership checks |
| 5 | **Privacy** | User data isolation |
| 6 | **Reliability** | Transactional writes |

   # 

# 9. Design Decisions and Trade-offs {#9-design-decisions-and-trade-offs}

* Monolith chosen for early simplicity and clarity.  
* Design allows future evolution without rewriting fundamentals.  
* AI Chat Assistant (Feature-12) reuses the existing AI Service (Python/FastAPI, Groq SDK primary + Anthropic SDK fallback per CLAUDE.md tech stack) — no new LLM provider or client is introduced. Complexity-based model routing within the AI Service (e.g. a fast/cheap model for simple single-item extraction vs. a stronger model for multi-item or edit/query intents) is an AI Service implementation detail to be finalized at `/cook-plan` time, not a fixed choice baked into this SDS.  
* Client surface for Feature-12 was `frontend/` (web) first, matching the project's original implementation priority; `mobile/` (React Native, not Flutter — rebuilt 2026-08-16) has since shipped its own AI Chat screen and reached feature parity for this flow.  
* AI Budget Setup Wizard (Feature-13) computes its proposed allocation with a fixed, rule-based formula (income × preference weight, category baselines) **inside the Go Backend itself** — not a free-form LLM call, and not even a call to the AI Service, since the computation is pure deterministic arithmetic with nothing an LLM adds (`specs/ai-budget-wizard/plan.md` Finding #6). The AI Service is only involved in one narrow, optional sub-step: suggesting a name for a Category the User described but that doesn't exist yet. Full formula in `specs/ai-budget-wizard/spec.md`.
* **Device-bound sessions (2026-10-19)** — each account saved on a phone keeps its own session there and switching is a refresh of it, replacing the separate 180-day switch token; lifetimes 60 days unused (sliding) / 180 days absolute. Adapted from the product owner's "device-bound session + biometric vault" proposal. **Not adopted, and why** (full list in `specs/mobile-account-switch/spec.md`):
  * *Separate `devices` and `refresh_tokens` tables* — `sessions` already is the token family (rotation, reuse detection, per-session revoke); a parallel table would duplicate it. Device columns go on `sessions`; "a device" in the UI is one live session.
  * *Storing a hash of the refresh token* — refresh tokens are signed JWTs and the row stores only the jti, which is useless without the signature.
  * *Refresh token wrapped by a biometric-bound key in the phone's key store* — not possible with `expo-secure-store`: biometric only (no screen-lock code fallback), a prompt on every read and write, and the key is invalidated when a fingerprint is added; the active session rotates about every 12 minutes, so it would prompt constantly. Tokens stay in secure storage and the fingerprint is a screen gate (switch check, optional app lock). The phase-2 device key pair is the real fix for token theft; `sessions.public_key` is reserved for it.
  * *Access token in memory only* — it lives 15 minutes and is checked against its session on every request, so revocation is already instant; keeping it in secure storage lets an offline cold start open from cached data.
  * *Password reset by email code* — not built yet (no forgot-password feature); lost-device remedies are device sign-out, sign out everywhere and password change.
  * *Admin resets a User's password* — no such feature; the admin tool is "sign out everywhere" for that User, which leaves an audit log line.

  # 

# 10. Product Metrics {#10-product-metrics}

## 1. Purpose {#1-purpose-1}

**Product Metrics** define how the success and effectiveness of the PFM product are measured during real-world usage. 

These metrics help stakeholders evaluate whether the product is delivering user value, supporting financial behavior change, and operating reliably over time. 

Metrics are collected and monitored across releases to support data-driven product decisions and continuous improvement.

Metrics are **non-functional outcomes** and are independent of any specific feature implementation.

## 2. Metric Categories {#2-metric-categories}

The PFM product adopts four main categories of product metrics:

1. **Adoption & Engagement Metrics**  
    Measure how users adopt and actively use the system.  
2. **Financial Behavior Metrics**  
    Measure whether users achieve better financial management outcomes through the product.  
3. **Operational Quality Metrics**  
    Measure reliability and stability of the system.  
4. **Notification & Awareness Metrics**  
    Measure whether system signals effectively reach the user.

Each metric includes a definition and a measurement scope.

## 3. Core Metrics for PFM {#3-core-metrics-for-pfm}

### 1. Adoption and Engagement Metrics {#1-adoption-and-engagement-metrics}

| Metric | Description |
| ----- | ----- |
| **MAU – Monthly Active Users** | Number of distinct users performing at least one meaningful financial action per month (e.g., add transaction, create wallet, edit budget). |
| **DAU/MAU Ratio** | Measures product stickiness and recurring behavior. |
| **Retention Rate (D30)** | Percentage of users still active 30 days after registration. |
| **Average Transactions per Active User per Month** | Indicates depth of usage. |
| **Report Views per User** | Measures engagement with insight-driven features. |

### 2. Financial Behavior Improvement Metrics {#2-financial-behavior-improvement-metrics}

| Metric | Description |
| ----- | ----- |
| **Budget Compliance Rate** | % of months where spending stays within configured budgets. |
| **Savings Goal Success Rate** | % of users achieving at least one Financial Goal. |
| **Recurring Expense Capture Rate** | % of recurring expenses logged in the system. |
| **Expense Categorization Coverage** | % of transactions categorized. |
| **Net Savings Change Trend** | Average increase/decrease in net savings over time (self-reported). |

These metrics reflect **behavioral outcome**, not financial advice.

### 3. Operational Quality Metrics {#3-operational-quality-metrics}

| Metric | Description |
| ----- | ----- |
| **System Availability** | % uptime measured monthly. |
| **Failed Transaction Write Rate** | % API requests to `/transactions` resulting in error. |
| **Average API Response Time** | End-to-end latency for core operations. |
| **Data Consistency Incidents** | Number of cases where balance or totals are incorrect. |
| **Backup Success Rate** | % successful backup cycles. |

### 4. Notification and Awareness Metrics {#4-notification-and-awareness-metrics}

| Metric | Description |
| ----- | ----- |
| **Notification Delivery Success Rate** | % notifications successfully delivered. |
| **Notification Open/Interaction Rate** | % users opening or viewing notifications. |
| **Critical Alert Acknowledgement Rate** | % of high-priority alerts acknowledged. |

## 4. MVP Metric Measurement Scope {#4-mvp-metric-measurement-scope}

During MVP, only lightweight metrics may be collected, such as:

* Active user counts  
* Transaction activity volume  
* Report view counts  
* System availability

Advanced financial-behavior metrics may be introduced in later releases.

## 5. Privacy and Ethics Considerations {#5-privacy-and-ethics-considerations}

* Metrics are stored and processed **anonymously or pseudonymously**.  
* No financial advice inference is performed.  
* Users maintain full ownership of financial data.  
* Metrics collection follows applicable privacy policies.

# 11. Future Enhancements {#11-future-enhancements}

* Recurring transactions  
* Advanced analytics  
* Migration to microservices when required

# 12. Appendix {#12-appendix}

* Architecture diagrams (draw.io)  
* Optional PlantUML definitions

## 1. Known Issues Log {#1-known-issues-log}

Dated entries for defects/gaps reported from real usage, with confirmed root cause (via code inspection, not assumption) and the resulting design implication captured elsewhere in this document. Kept here rather than deleted so the reasoning survives past the fix.

### 2026-08-21 — Category icon upload, Drawer keyboard behavior, Wallet/Budget icons, account-activation link

**1. Category icon upload returned 405 on production**
Mobile's `CategoryFormModal.tsx` showed a generic "unexpected error occurred"; the VPS backend log showed `405 Method Not Allowed` for `POST /api/v1/categories/icon`.
*Root cause (confirmed):* the route `categories.Post("/icon", categoryHandler.UploadIcon)` (`backend/cmd/server/routes.go:55`) and the full mobile upload flow (`useUploadCategoryIconMutation`, `expo-image-picker`, `Avatar` preview, replace via "Change photo") already exist in code as of commit `fe4f6cc`. A 405 on this exact path is Fiber's signature for "path matches an existing route shape (`/:id`) for other verbs (GET/PATCH/DELETE) but not for POST" — meaning **the deployed VPS backend predates `fe4f6cc` and has not been redeployed.** This is a deployment gap, not a missing feature.
*Compounding bug — **fixed 2026-08-21**:* `response.Error` (`backend/internal/response/response.go`) now special-cases `*fiber.Error` before falling through to the generic 500 branch, preserving the real status (404/405/etc.) and mapping it to `common.ErrCodeNotFound`/`ErrCodeMethodNotAllowed`/`ErrCodeRequestError` instead of a blanket `INTERNAL_ERROR`. Covered by `backend/internal/response/response_test.go` (4 new tests, including the exact 405-on-a-GET-only-route scenario from this report) — `go test ./...` passes. **Still outstanding:** (a) confirm the `deploy-backend.yml` run for `fe4f6cc` (or later, including this fix) actually reached the VPS — `gh` CLI wasn't available in this session to check run history directly; a manual `workflow_dispatch` trigger may still be needed if it never fired or failed.

**2. On-screen keyboard covers the focused input in bottom-sheet forms**
In the shared `Drawer` component (`mobile/src/components/shared/Drawer.tsx`, used by every Wallet/Category/Budget/Transaction form), a focused `TextInput` can end up hidden behind the keyboard with nothing visibly scrolled into view.
*Root cause (confirmed):* `Drawer.tsx` wraps its children in a plain `ScrollView` with no keyboard-avoidance logic at all — not `KeyboardAvoidingView`, not the project's own keyboard-height hook, nothing. The project already solved an equivalent problem for the AI Chat screen with a **custom `useKeyboardHeight()` hook** (`mobile/src/lib/use-keyboard-height.ts`), deliberately *not* `KeyboardAvoidingView`, because that API's Android `height` behavior has a known bug where it fails to restore the original layout after the keyboard closes (see that file's own comment, referencing facebook/react-native#22884).
*Action — **fixed 2026-08-21**:* `Drawer.tsx` now calls `useKeyboardHeight()` and pads the `ScrollView`'s content bottom by the live keyboard height when it's open, instead of adding the third-party `react-native-keyboard-aware-scroll-view` library proposed in the original report — that library wraps the same native primitives the project already moved off of for a confirmed Android bug, so adopting it would reintroduce the exact failure mode `useKeyboardHeight` exists to avoid. Verified via `tsc --noEmit`, `eslint`, and a full `expo export --platform web` smoke-build; **not verified on-device/emulator** (none available this session) — see §3.2 UI/UX Principles.

**3. Wallet and Budget screens lack icon/photo support**
`mobile/app/(app)/wallets.tsx` and `mobile/app/(app)/insights.tsx` (Budget screen) have no icon/emoji/photo UI at all, unlike Categories.
*Status (confirmed):* net-new, not started at any layer — no `icon`/`icon_url` columns on `wallets` or `budgets` (only `categories`, added by migration `012_categories_icon_url.sql`), no DTO fields, no upload endpoint, no mobile UI. Target design captured in the Domain Model (§2.1.2 Wallet, §2.1.4 Budget) and the shared picker pattern in §3.2 UI/UX Principles.
*Action — **implemented 2026-08-21**:* specced (`specs/wallet-budget-icons/spec.md`), planned (`plan.md`), and built end-to-end — migrations `013_wallets_icon.sql`/`014_budgets_icon.sql`, `POST /wallets/icon`/`POST /budgets/icon` (sibling endpoints, not a generalized shared route — see plan.md's explicit assumption), full DTO/service/repository/handler wiring, and mobile form/list/card updates mirroring `CategoryFormModal.tsx`. Verified against a real (throwaway, isolated) Postgres instance, not just in-memory fakes — including the `icon_url` explicit-clear-vs-omitted distinction and a regression check that an icon-only Budget update never wipes `budget_limits`. Full detail in `specs/wallet-budget-icons/`. Two related decisions were deliberately deferred pending sign-off: retrofitting Category's own identical "can never clear `icon_url`" bug (same root cause as the fix this feature required), and web (`frontend/`) parity (this was scoped mobile-only).

**4. Account-activation email link failed on production**
Clicking the invite email's `{APP_BASE_URL}/activate?token=...` link (generated by `backend/internal/service/smtp_email_sender.go:40`) returned the same generic `{"success":false,"message":"an unexpected error occurred","error_code":"INTERNAL_ERROR"}` body.
*Root cause (confirmed):* identical to Item 1 — `app.Get("/activate", handler.ActivatePageHandler)` (`backend/internal/handler/activate_page_handler.go`) was added in the same `fe4f6cc` commit and is not yet live on the VPS. Fiber's default "Cannot GET /activate" 404 gets coerced into `500 INTERNAL_ERROR` by the same error-handler gap as Item 1.
*Action:* the shared error-handler fix from Item 1 is now in place, so once this build reaches the VPS a stale-route hit here would correctly surface as a `404 NOT_FOUND` instead of `500 INTERNAL_ERROR` — but the actual fix for *this* symptom is still the same outstanding deployment-verification step as Item 1 (confirm `deploy-backend.yml` has actually run for the current `HEAD`). The handler itself (a self-contained HTML activation form posting to the existing `POST /api/v1/auth/activate`) is already correct and needs no code change.