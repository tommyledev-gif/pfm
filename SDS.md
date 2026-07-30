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
  - [3. Feature-03: Wallet Management](#3-feature-03-wallet-management)
    - [1. US-03-01: Create a Wallet](#1-us-03-01-create-a-wallet)
  - [4. Feature-04: Category Management](#4-feature-04-category-management)
    - [1. US-04-01: Create a Category](#1-us-04-01-create-a-category)
  - [5. Feature-05: Budget Management](#5-feature-05-budget-management)
    - [1. US-05-01: Create a Budget for a Wallet](#1-us-05-01-create-a-budget-for-a-wallet)
  - [6. Feature-06: Transaction Management](#6-feature-06-transaction-management)
    - [1. US-06-01: Create a Transaction for a Wallet](#1-us-06-01-create-a-transaction-for-a-wallet)
  - [7. Feature-07: Financial Reporting](#7-feature-07-financial-reporting)
  - [8. Feature-08: Financial Goal](#8-feature-08-financial-goal)
  - [9. Feature-09: Investment Portfolio](#9-feature-09-investment-portfolio)
  - [10. Feature-10: Notification Handling](#10-feature-10-notification-handling)
  - [11. Feature-11: Data Overview Dashboard](#11-feature-11-data-overview-dashboard)
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

## 1. Domain Objects {#1-domain-objects}

### 1. User {#1-user}

### 2. Wallet {#2-wallet}

### 3. Category {#3-category}

### 4. Budget {#4-budget}

### 5. Transaction {#5-transaction}

### 6. FinancialGoal {#6-financialgoal}

### 7. InvestmentPortfolio {#7-investmentportfolio}

### 8. Asset {#8-asset}

### 9. Holding {#9-holding}

### 10. Notification {#10-notification}

## 2. Domain Object Relationships {#2-domain-object-relationships}

# 3. UI Design {#3-ui-design}

## 1. Wireframe {#1-wireframe}

## 2. UI/UX Principles {#2-uiux-principles}

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
| S-BUD-01 | Feature-05: Budget Management | **US-05-01 Create a Budget for a Wallet** | ✔ | Spending control |
| S-TRX-01 | Feature-06: Transaction Management | **US-06-01 Create a Transaction for a Wallet** | ✔ | Primary core scenario |
| S-RPT-01 | Feature-07: Financial Reporting | **US-07-01 View the Summary Report** | ✔ | Insight & feedback loop |
| S-NOT-01 | Feature-10: Notification Handling | **US-10-01 View the list of Notifications** | ✔ | User awareness |

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

      ## 

## 3. Feature-03: Wallet Management {#3-feature-03-wallet-management}

### 1. US-03-01: Create a Wallet {#1-us-03-01-create-a-wallet}

## 4. Feature-04: Category Management {#4-feature-04-category-management}

### 1. US-04-01: Create a Category {#1-us-04-01-create-a-category}

## 5. Feature-05: Budget Management {#5-feature-05-budget-management}

### 1. US-05-01: Create a Budget for a Wallet {#1-us-05-01-create-a-budget-for-a-wallet}

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

## 2. API Index {#2-api-index}

| API ID | Endpoint | Feature |
| ----- | ----- | ----- |
| API-WAL-01 | `POST /wallets` | Wallet Management |
| API-WAL-02 | `GET /wallets` | Wallet Management |
| API-WAL-03 | `GET /wallets/{id}` | Wallet Management |
| API-TRX-01 | `POST /transactions` | Transaction Management |
| API-TRX-02 | `GET /transactions` | Transaction Management |
| API-TRX-03 | `GET /transactions/{id}` | Transaction Management |

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

## 4. API  → User Story Traceability {#4-api-user-story-traceability}

| API | Feature | US |
| ----- | ----- | ----- |
| `POST /wallets` | Wallet Management | US-03-01 |
| `POST /transactions` | Transaction Management | US-06-01 |

# 7. Security Design {#7-security-design}

## 1. Authentication {#1-authentication}

All protected APIs require authenticated user context.

## 2. Authorization {#2-authorization}

Users can only access data they own, for example: Wallet, Transaction, Category...

## 3. Threat Modeling {#3-threat-modeling}

   # 

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

