Personal Finance Management

Software Requirement Specification (SRS)

**Table of Contents**

- [1. Introduction – Personal Finance Management (PFM)](#1-introduction-personal-finance-management-pfm)
  - [1.1 Purpose](#11-purpose)
  - [1.2 Scope](#12-scope)
  - [1.3 Assumptions and Constraints](#13-assumptions-and-constraints)
    - [Assumptions](#assumptions)
    - [Constraints](#constraints)
  - [1.4 Definitions and Acronyms](#14-definitions-and-acronyms)
- [2. Functional Requirements (FR)](#2-functional-requirements-fr)
  - [FR-01: Wallet Management](#fr-01-wallet-management)
  - [FR-02: Transaction Management](#fr-02-transaction-management)
  - [FR-03: Category Management](#fr-03-category-management)
  - [FR-04: Budget Tracking](#fr-04-budget-tracking)
  - [FR-05: Financial Goal Tracking](#fr-05-financial-goal-tracking)
  - [FR-06: Investment Management](#fr-06-investment-management)
  - [FR-07: Financial Reporting](#fr-07-financial-reporting)
  - [FR-08: Data Overview Dashboard](#fr-08-data-overview-dashboard)
  - [FR-09: AI Chat Assistance](#fr-09-ai-chat-assistance)
- [3. Non-Functional Requirements (NFR)](#3-non-functional-requirements-nfr)
  - [NFR-01: Performance](#nfr-01-performance)
  - [NFR-02: Availability](#nfr-02-availability)
  - [NFR-03: Scalability](#nfr-03-scalability)
  - [NFR-04: Security](#nfr-04-security)
  - [NFR-05: Privacy](#nfr-05-privacy)
  - [NFR-06: Reliability](#nfr-06-reliability)
- [4. User Experience Requirements (UXR)](#4-user-experience-requirements-uxr)
  - [UXR-01: Clarity](#uxr-01-clarity)
  - [UXR-02: Fast Onboarding](#uxr-02-fast-onboarding)
  - [UXR-03: Immediate Feedback](#uxr-03-immediate-feedback)
  - [UXR-04: Keyboard-Safe Input](#uxr-04-keyboard-safe-input)
- [5. Business Flows (BF)](#5-business-flows-bf)
  - [BF-01: Main Business Flow – End-to-End User Journey](#bf-01-main-business-flow-end-to-end-user-journey)
  - [BF-02: Supporting BF – Wallet Management](#bf-02-supporting-bf-wallet-management)
  - [BF-03: Supporting BF – Category Management](#bf-03-supporting-bf-category-management)
  - [BF-04: Supporting BF – Budget Management](#bf-04-supporting-bf-budget-management)
  - [BF-05: Supporting BF – Transaction Management](#bf-05-supporting-bf-transaction-management)
  - [BF-06: Supporting BF – Financial Goal Management](#bf-06-supporting-bf-financial-goal-management)
  - [BF-07: Supporting BF – Investment Management](#bf-07-supporting-bf-investment-management)
  - [BF-08: Supporting BF – Reporting and Dashboard](#bf-08-supporting-bf-reporting-and-dashboard)
  - [BF-09: Supporting BF – Notification Handling](#bf-09-supporting-bf-notification-handling)
  - [BF-10: Supporting BF – AI Chat Assistant](#bf-10-supporting-bf-ai-chat-assistant)
- [6. Features and User Stories (US)](#6-features-and-user-stories-us)
  - [Feature-01: User Management](#feature-01-user-management)
    - [US-01: Register a User [MVP]](#us-01-register-a-user-mvp)
    - [US-02: Update a User Profile](#us-02-update-a-user-profile)
  - [Feature-02: System Security](#feature-02-system-security)
    - [US-01: Login [MVP]](#us-01-login-mvp)
    - [US-02: Logout [MVP]](#us-02-logout-mvp)
  - [Feature-03: Wallet Management](#feature-03-wallet-management)
    - [US-01: Create a Wallet [MVP]](#us-01-create-a-wallet-mvp)
    - [US-02: View a list of Wallets [MVP]](#us-02-view-a-list-of-wallets-mvp)
    - [US-03: View a Wallet [MVP]](#us-03-view-a-wallet-mvp)
    - [US-04: Update a Wallet](#us-04-update-a-wallet)
    - [US-05: Set a Wallet as default](#us-05-set-a-wallet-as-default)
  - [Feature-04: Category Management](#feature-04-category-management)
    - [US-01: Create a Category [MVP]](#us-01-create-a-category-mvp)
    - [US-02: View a list of Categories [MVP]](#us-02-view-a-list-of-categories-mvp)
    - [US-03: View a Category](#us-03-view-a-category)
    - [US-04: Update a Category](#us-04-update-a-category)
    - [US-05: Delete a Category](#us-05-delete-a-category)
  - [Feature-05: Budget Management](#feature-05-budget-management)
    - [US-01: Create a Budget for a Category (MVP)](#us-01-create-a-budget-for-a-category-mvp)
    - [US-02: View a list of Budgets (MVP)](#us-02-view-a-list-of-budgets-mvp)
    - [US-03: View a Budget (MVP)](#us-03-view-a-budget-mvp)
    - [US-04: Update a Budget](#us-04-update-a-budget)
    - [US-05: Delete a Budget](#us-05-delete-a-budget)
  - [Feature-06: Transaction Management](#feature-06-transaction-management)
    - [US-01: Create a Transaction for a Wallet [MVP]](#us-01-create-a-transaction-for-a-wallet-mvp)
    - [US-02: View a list of Transactions [MVP]](#us-02-view-a-list-of-transactions-mvp)
    - [US-03: View a Transaction [MVP]](#us-03-view-a-transaction-mvp)
    - [US-04: Update a Transaction](#us-04-update-a-transaction)
    - [US-05: Delete a Transaction](#us-05-delete-a-transaction)
  - [Feature-07: Financial Reporting](#feature-07-financial-reporting)
    - [US-01: View the Summary Report [MVP]](#us-01-view-the-summary-report-mvp)
    - [US-02: View Income Report](#us-02-view-income-report)
    - [US-03: View Expense Report](#us-03-view-expense-report)
    - [US-04: Filter Reports by Date](#us-04-filter-reports-by-date)
    - [US-05: Filter Reports by Wallet or Category](#us-05-filter-reports-by-wallet-or-category)
  - [Feature-08: Financial Goal](#feature-08-financial-goal)
    - [US-01: Create a Financial Goal](#us-01-create-a-financial-goal)
    - [US-02: View a list of Financial Goals](#us-02-view-a-list-of-financial-goals)
    - [US-03: View a Financial Goal](#us-03-view-a-financial-goal)
    - [US-04: Update a Financial Goal](#us-04-update-a-financial-goal)
    - [US-05: Close a Financial Goal](#us-05-close-a-financial-goal)
  - [Feature-09: Investment Portfolio](#feature-09-investment-portfolio)
    - [US-01: View the Investment Portfolio](#us-01-view-the-investment-portfolio)
    - [US-02: Update the Investment Portfolio Settings](#us-02-update-the-investment-portfolio-settings)
    - [US-03: Add a Holding to the Investment Portfolio](#us-03-add-a-holding-to-the-investment-portfolio)
    - [US-04: Update a Holding](#us-04-update-a-holding)
    - [US-05: Remove a Holding](#us-05-remove-a-holding)
  - [Feature-10: Notification Handling](#feature-10-notification-handling)
    - [US-01: View the list of Notifications (MVP)](#us-01-view-the-list-of-notifications-mvp)
    - [US-02: View a Notification (MVP)](#us-02-view-a-notification-mvp)
    - [US-03: Mark a Notification as Read](#us-03-mark-a-notification-as-read)
  - [Feature-11: Data Overview Dashboard](#feature-11-data-overview-dashboard)
  - [Feature-12: AI Chat Assistant](#feature-12-ai-chat-assistant)
    - [US-01: Create a Transaction via Chat [MVP]](#us-01-create-a-transaction-via-chat-mvp)
    - [US-02: Edit a Transaction via Chat [MVP]](#us-02-edit-a-transaction-via-chat-mvp)
    - [US-03: Query Spending via Chat [MVP]](#us-03-query-spending-via-chat-mvp)
    - [US-04: General Financial Advice [Post-MVP]](#us-04-general-financial-advice-post-mvp)
- [Feature-level Release (Overview)](#feature-level-release-overview)

# 1. Introduction – Personal Finance Management (PFM) {#1-introduction-personal-finance-management-pfm}

## 1.1 Purpose {#11-purpose}

This document defines the **Software Requirements Specification (SRS)** for the **Personal Finance Management (PFM)** application.

The purpose of this SRS is to:

* Describe **the Functional, Non-Functional and User eXperience Requirements (FR, NFR, UXR)** of the PFM product from a real-world product perspective.

* Serve as a **baseline requirements document** that can evolve over time as the product grows.

* Provide a realistic example of how requirements are specified and maintained in professional software development.

This SRS represents the **overall product vision and requirements**, independent of any specific release or implementation phase.

## 1.2 Scope {#12-scope}

PFM is a software product designed to help individuals manage their personal finances in a **structured, transparent, and effective** way.

The PFM system aims to support Users in:

* Recording and organizing financial transactions (income and expenses).

* Managing wallets, categories, budgets, financial goals, and investments.

* Understanding financial behavior through reports and dashboards.

* Making better financial decisions based on historical data and insights.

This SRS describes the **complete functional scope** of the PFM product, including features that may be delivered across **multiple releases** (e.g. MVP, 1st release, 2nd release, and beyond).

Within the context of this course, PFM is used as a **case study product** to demonstrate how a real software product is:

* Analyzed from User needs and business goals,

* Defined through structured requirements,

* Incrementally delivered using an **MVP-first approach**.

While the course focuses on building and demonstrating an MVP implementation, this SRS remains the **authoritative requirements document** that continues to evolve as the product matures.

## 1.3 Assumptions and Constraints {#13-assumptions-and-constraints}

### Assumptions {#assumptions}

* The primary Users are individuals managing their **personal finances**.

* Users have basic familiarity with digital applications.

* Financial data is primarily provided by Users, with optional extensions for integrations in future releases.

* The PFM product will be developed and delivered incrementally over time.

### Constraints {#constraints}

* This SRS describes the **full product requirements**, not all of which are implemented in the MVP.

* Feature availability may vary by release, depending on priorities, resources, and learning objectives.

* Regulatory compliance, external financial integrations, and advanced analytics may be introduced progressively in later releases.

* Design and implementation details are intentionally excluded and will be addressed in separate **Software Design Specifications (SDS)**.

## 1.4 Definitions and Acronyms {#14-definitions-and-acronyms}

* **PFM** – Personal Finance Management

* **MVP** – Minimum Viable Product

* **FR** – Functional Requirement

* **NFR** – Non-Functional Requirement

* **UXR** – User Experience Requirement

  # 

# 2. Functional Requirements (FR) {#2-functional-requirements-fr}

## FR-01: Wallet Management {#fr-01-wallet-management}

The System shall allow Users to **create and manage one or more Wallets** representing different sources of money (e.g. cash, bank account, e-wallet).

Each wallet shall store basic information such as Wallet **name**, **type**, and **current balance**.  
Wallets are used as the main source or destination for all financial transactions.

Each Wallet shall optionally support a visual icon (an emoji/short label, or an uploaded photo) for quick recognition in lists, consistent with the icon support already provided by Category Management (FR-03). *(Not yet implemented — see SDS §12.1 Known Issues Log, Item 3.)*

## FR-02: Transaction Management {#fr-02-transaction-management}

The System shall allow Users to **record financial Transactions**, including **both income and expense Transactions**.

Each Transaction shall include at least the **amount**, transaction **type** (income or expense), **date**, **Wallet**, and **Category**.  
Users should be able to view, edit, and delete Transactions.

## FR-03: Category Management {#fr-03-category-management}

The System shall allow Users to **classify Transactions into User-defined Categories** (e.g. Study, Food, Rent, Salary, Investment…).

Categories are used to organize Transactions and support budgeting and reporting features.

Each Category shall support a visual icon: a free-text emoji/short label, or an uploaded photo that the User can replace or remove after upload. The uploaded photo, when set, takes display precedence over the emoji/text.

## FR-04: Budget Tracking {#fr-04-budget-tracking}

The System shall allow Users to **define a Budget for each Category** within **a specific period** (e.g. monthly).

The System shall track actual spending against the defined Budget and indicate whether the User is within or exceeding the Budget.

Each Budget shall optionally support its own visual icon (independent of its Category's icon), for quick recognition in the Budget list. *(Not yet implemented — see SDS §12.1 Known Issues Log, Item 3.)*

## FR-05: Financial Goal Tracking {#fr-05-financial-goal-tracking}

The System shall allow Users to **define Financial Goals** (e.g. saving for emergency fund, travel, or major purchases).

Each Goal shall include a **target amount** and a **target time frame**.  
The System shall track progress toward each Goal based on recorded Transactions.

## FR-06: Investment Management {#fr-06-investment-management}

The System shall allow Users to **record and track Investment-related information**.

Investments may include basic details such as investment **name**, **amount**, and **current value**.  
The purpose is to provide a high-level view of Investment performance, not detailed trading features.

## FR-07: Financial Reporting {#fr-07-financial-reporting}

The System shall **provide basic Financial Reports** to help Users **understand their financial situation**.

Reports may include summaries of income and expenses, spending by Category, Wallet balances, and overall financial trends over time.

## FR-08: Data Overview Dashboard {#fr-08-data-overview-dashboard}

The System shall **provide a dashboard that presents key financial information** in a clear and easy-to-understand format.

The dashboard may include current balances, recent Transactions, Budget status, and Goal progress.

## FR-09: AI Chat Assistance {#fr-09-ai-chat-assistance}

The System shall provide a conversational (chat-based) interface that allows Users to **create, edit, and query Transactions using natural-language messages**, as an alternative to manual form entry.

The AI shall resolve messages against the User's own Wallets and Categories, and shall require **explicit User confirmation** before any Transaction is created or modified. The AI shall not bypass the validation and ownership rules enforced by Transaction Management (FR-02).

# 3. Non-Functional Requirements (NFR) {#3-non-functional-requirements-nfr}

## NFR-01: Performance {#nfr-01-performance}

The System shall **respond to User actions within an acceptable time** under normal usage conditions.

Basic operations such as viewing Wallets, adding Transactions, and viewing Reports should be performed smoothly without noticeable delay.

## NFR-02: Availability {#nfr-02-availability}

The System shall **be available to Users at least 99% of the time**, excluding planned maintenance.

## NFR-03: Scalability {#nfr-03-scalability}

The System shall be designed in a way that **allows future expansion of features and Users**.

New modules such as advanced reporting or investment analytics should be added without major changes to existing functionality.

## NFR-04: Security {#nfr-04-security}

The System shall **protect User financial data from unauthorized access**.

Basic security measures such as **User authentication** and **data isolation** between Users should be applied.

## NFR-05: Privacy {#nfr-05-privacy}

The System shall ensure that **personal and financial data of Users are not shared or exposed without explicit User consent.**

## NFR-06: Reliability {#nfr-06-reliability}

The System shall **operate reliably during normal usage** and handle common User actions without unexpected failures.

User data should remain consistent and accurate even when the application is restarted or temporarily unavailable.

Error responses shall accurately reflect the real failure condition — correct HTTP status and a matching error code — including routing-level failures (not-found, method-not-allowed). A User or operator must never see a generic internal-error response for a condition that is not actually an internal error, since that hides the real cause from both diagnosis and the client's own handling logic.

# 4. User Experience Requirements (UXR) {#4-user-experience-requirements-uxr}

## UXR-01: Clarity {#uxr-01-clarity}

The System shall **present information in a clear manner**.

Users should be able to understand their financial situation at a glance without needing explanations or instructions.

## UXR-02: Fast Onboarding {#uxr-02-fast-onboarding}

The System shall **allow new Users to start using core features quickly**.

A first-time User should be able to create a Wallet and record the first Transaction within a few minutes.

## UXR-03: Immediate Feedback {#uxr-03-immediate-feedback}

The System shall **provide clear and immediate feedback for User actions**.

After adding or editing data, Users should instantly see updated balances, budgets, or progress indicators.

## UXR-04: Keyboard-Safe Input {#uxr-04-keyboard-safe-input}

The System shall ensure that whichever field a User is actively typing into **remains visible above the on-screen keyboard**, on both iOS and Android, in every form (Wallet, Category, Budget, Transaction, AI Chat).

A User should never have to guess what they typed because the keyboard is covering the input.

# 5. Business Flows (BF) {#5-business-flows-bf}

## BF-01: Main Business Flow – End-to-End User Journey {#bf-01-main-business-flow-end-to-end-user-journey}

This flow describes the typical end-to-end interaction of a User with the PFM system during daily financial management.

1. The User **registers a new account**.  
2. The User **logs into the System**.  
3. The User **creates a Wallet W1** (e.g. *Cash Wallet*).  
4. The User **creates a Category C1** (e.g. *Salary*), C2 (e.g. *Food*).  
5. The User **defines a Budget B1** for Category **C2**, tracked across all of the User's Wallets.  
6. The User **records an income Transaction T1** into wallet **W1** under **C1**.  
7. The User **records an expense Transaction T2 from Wallet W1** under Category **C2**.  
8. The User **views the current status of Wallet W1.**  
9. The User **views the current status of Budget B1.**  
10. The User **views the income and expense Report**.  
11. The User **views Notifications if any Budget limit or condition is reached**.  
12. The User **logs out of the System**.

## BF-02: Supporting BF – Wallet Management {#bf-02-supporting-bf-wallet-management}

This flow describes how Users manage Wallets as sources of money.

1. The User **views the list of all Wallets**.  
2. The User selects a Wallet **W1** to **view details**.  
3. The User **updates a Wallet** if needed.

## BF-03: Supporting BF – Category Management {#bf-03-supporting-bf-category-management}

This flow describes how Users manage Transaction Categories.

1. The User **views the list of available Categories**.  
2. The User selects a Category **C1** to **view details**.  
3. The User **updates a Category** if needed.  
4. The User **deletes a Category** that is no longer in use.

## BF-04: Supporting BF – Budget Management {#bf-04-supporting-bf-budget-management}

This flow describes how Users plan and monitor Budgets.

1. The User **views the list of Budgets** (each tracked per Category, across all Wallets).  
2. The User **views detailed Budget status and remaining amount**.  
3. The User **updates a Budget** if needed.  
4. The User **deletes a Budget** when it is no longer required.

## BF-05: Supporting BF – Transaction Management {#bf-05-supporting-bf-transaction-management}

This flow describes how Users record financial activities.

1. The User **views the list of Transactions associated with a Wallet**.  
2. The User **views details of a Transaction**.  
3. The User **updates Transaction information** if needed.  
4. The User **deletes a Transaction** when it is no longer required.

## BF-06: Supporting BF – Financial Goal Management {#bf-06-supporting-bf-financial-goal-management}

This flow describes how Users manage Financial Goals.

1. The User **creates a Financial Goal** with a target amount and time frame.  
2. The User **allocates funds to the Goal**.  
3. The User **views Goal progress status**.  
4. The User **updates the Goa**l if needed.  
5. The User **closes the Goal** when completed.

## BF-07: Supporting BF – Investment Management {#bf-07-supporting-bf-investment-management}

This flow describes how Users track Investments.

1. The User **creates an Investment record**.  
2. The User **records Investment-related Transactions**.  
3. The User **views a summary of Investment performance**.

## BF-08: Supporting BF – Reporting and Dashboard {#bf-08-supporting-bf-reporting-and-dashboard}

This flow describes how Users review financial information.

1. The User **accesses the dashboard or reporting section**.  
2. The User **filters reports by date, Wallet, or Category.**

## BF-09: Supporting BF – Notification Handling {#bf-09-supporting-bf-notification-handling}

This flow describes how the System communicates important events.

1. The User **views the list of Notifications.**  
2. The User **views a Notification.**  
3. The User **takes appropriate action on a Notification** if needed.

## BF-10: Supporting BF – AI Chat Assistant {#bf-10-supporting-bf-ai-chat-assistant}

This flow describes how Users interact with the System through natural-language chat instead of manual forms.

1. The User **opens the AI Chat interface** and **sends a natural-language message** describing a Transaction, an edit request, or a spending question.  
2. The System **interprets the message** and returns either a proposed action (create/edit a Transaction) or a direct answer (spending query).  
3. For a proposed create/edit action, the System **shows a confirmation card**; the User **approves or cancels** it.  
4. Upon approval, the System **creates or updates the Transaction** through the standard Transaction Management flow (FR-02).  
5. The User **reviews the resulting Transaction** from the standard Transaction list.

# 6. Features and User Stories (US) {#6-features-and-user-stories-us}

## Feature-01: User Management {#feature-01-user-management}

Provides basic User account creation and profile management, allowing Users to register and maintain their personal information.  
The User Stories of this feature are described below.

### US-01: Register a User [MVP] {#us-01-register-a-user-mvp}

*As a Visitor*  
*I want to register a User account*  
*so that I can log in and use the PFM application.*

  **Background**:  
    **Given** the Visitor is on the "Register" screen

  **Scenario: Register successfully with email**  
    **When** the Visitor enters full name "Homer Truong"  
      And the Visitor enters email "homer@example.com"  
      And the Visitor enters password "P@ssw0rd123"  
      And the Visitor confirms password "P@ssw0rd123"  
      And the Visitor taps "Register"  
    **Then** the System creates a new User account  
      And the System shows message "Register successful"  
      And the User is redirected to the "Login" screen

  **Scenario: Reject registration when required fields are missing**  
    **When** the Visitor taps "Register" without entering email  
    **Then** the System does not create a new User account  
      And the System shows validation error "Email is required"

  **Scenario: Reject registration when account already exists**  
    **Given** an existing User account with email "homer@example.com"  
    **When** the Visitor enters full name "Homer Truong"  
      And the Visitor enters email "homer@example.com"  
      And the Visitor enters password "P@ssw0rd123"  
      And the Visitor confirms password "P@ssw0rd123"  
      And the Visitor taps "Register"  
    **Then** the System does not create a new User account  
      And the System shows error "Account already exists"  
      And the System suggests "Go to Login"

### US-02: Update a User Profile {#us-02-update-a-user-profile}

## Feature-02: System Security {#feature-02-system-security}

Ensures secure access to the System by allowing Users to log in and log out safely, protecting personal financial data. Moreover, each User is authorized to see only his/her financial data.  
The User Stories of this feature are described below.

### US-01: Login [MVP] {#us-01-login-mvp}

### US-02: Logout [MVP] {#us-02-logout-mvp}

## Feature-03: Wallet Management {#feature-03-wallet-management}

Allows Users to create and manage Wallets that represent different sources of money and view current balances.  
The User Stories of this feature are described below.

### US-01: Create a Wallet [MVP] {#us-01-create-a-wallet-mvp}

### US-02: View a list of Wallets [MVP] {#us-02-view-a-list-of-wallets-mvp}

### US-03: View a Wallet [MVP] {#us-03-view-a-wallet-mvp}

### US-04: Update a Wallet {#us-04-update-a-wallet}

### US-05: Set a Wallet as default {#us-05-set-a-wallet-as-default}

## Feature-04: Category Management {#feature-04-category-management}

Enables Users to define and manage Categories used to classify income and expense Transactions.  
The User Stories of this feature are described below.

### US-01: Create a Category [MVP] {#us-01-create-a-category-mvp}

### US-02: View a list of Categories [MVP] {#us-02-view-a-list-of-categories-mvp}

### US-03: View a Category {#us-03-view-a-category}

### US-04: Update a Category {#us-04-update-a-category}

### US-05: Delete a Category {#us-05-delete-a-category}

## Feature-05: Budget Management {#feature-05-budget-management}

Allows Users to plan and monitor spending by defining Budgets for specific Categories, tracked across all of the User's Wallets.  
The User Stories of this feature are described below.

### US-01: Create a Budget for a Category (MVP) {#us-01-create-a-budget-for-a-category-mvp}

### US-02: View a list of Budgets (MVP) {#us-02-view-a-list-of-budgets-mvp}

### US-03: View a Budget (MVP) {#us-03-view-a-budget-mvp}

### US-04: Update a Budget {#us-04-update-a-budget}

### US-05: Delete a Budget {#us-05-delete-a-budget}

## Feature-06: Transaction Management {#feature-06-transaction-management}

Enables Users to record, view, and manage income and expense Transactions associated with their Wallets.  
The User Stories of this feature are described below.

### US-01: Create a Transaction for a Wallet [MVP] {#us-01-create-a-transaction-for-a-wallet-mvp}

*As a User*  
*I want to create a transaction for a wallet*  
*so that I can track my income and expenses and keep wallet balance updated.*

  **Background**:  
    **Given** the User is logged in  
     And the User has an existing wallet named "Main Wallet"  
     And the wallet currency is "VND"  
     And the wallet current balance is 1,000,000

  **Scenario: Create an expense transaction successfully**  
    **Given** the User is on the "Create Transaction" screen for "Main Wallet"  
    **When** the User selects transaction type "Expense"  
     And the User enters amount 200,000  
     And the User selects category "Food"  
     And the User sets date "2025-12-23"  
     And the User enters note "Lunch"  
     And the User taps "Save"  
    **Then** the System creates a transaction in "Main Wallet"  
     And the transaction type is "Expense"  
     And the transaction amount is 200,000  
     And the transaction category is "Food"  
     And the transaction date is "2025-12-23"  
     And the System decreases the wallet balance to 800,000  
     And the System shows message "Transaction created successfully"

  **Scenario: Create an income transaction successfully**  
    **Given** the User is on the "Create Transaction" screen for "Main Wallet"  
    **When** the User selects transaction type "Income"  
     And the User enters amount 500,000  
     And the User selects category "Salary"  
     And the User sets date "2025-12-23"  
     And the User taps "Save"  
    **Then** the System creates a transaction in "Main Wallet"  
     And the transaction type is "Income"  
     And the transaction amount is 500,000  
     And the transaction category is "Salary"  
     And the transaction date is "2025-12-23"  
     And the System increases the wallet balance to 1,500,000  
     And the System shows message "Transaction created successfully"

  **Scenario: Reject transaction when required fields are missing**  
    **Given** the User is on the "Create Transaction" screen for "Main Wallet"  
    **When** the User taps "Save" without entering amount  
    **Then** the System does not create a transaction  
     And the System shows validation error "Amount is required"

  **Scenario: Reject transaction when amount is invalid**  
    **Given** the User is on the "Create Transaction" screen for "Main Wallet"  
    **When** the User selects transaction type "Expense"  
     And the User enters amount -10,000  
     And the User taps "Save"  
    **Then** the System does not create a transaction  
     And the System shows validation error "Amount must be greater than 0"

  **Scenario: Reject expense transaction when balance is insufficient (MVP rule)**  
    **Given** the User is on the "Create Transaction" screen for "Main Wallet"  
    **When** the User selects transaction type "Expense"  
     And the User enters amount 2,000,000  
     And the User selects category "Shopping"  
     And the User taps "Save"  
    **Then** the System does not create a transaction  
     And the wallet balance remains 1,000,000  
     And the System shows error "Insufficient balance"

### US-02: View a list of Transactions [MVP] {#us-02-view-a-list-of-transactions-mvp}

### US-03: View a Transaction [MVP] {#us-03-view-a-transaction-mvp}

### US-04: Update a Transaction {#us-04-update-a-transaction}

### US-05: Delete a Transaction {#us-05-delete-a-transaction}

## Feature-07: Financial Reporting {#feature-07-financial-reporting}

Provides Users with summarized financial information and reports to help them understand their overall financial situation.  
The User Stories of this feature are described below.

### US-01: View the Summary Report [MVP] {#us-01-view-the-summary-report-mvp}

### US-02: View Income Report {#us-02-view-income-report}

### US-03: View Expense Report {#us-03-view-expense-report}

### US-04: Filter Reports by Date {#us-04-filter-reports-by-date}

### US-05: Filter Reports by Wallet or Category {#us-05-filter-reports-by-wallet-or-category}

## Feature-08: Financial Goal {#feature-08-financial-goal}

Allows Users to define financial Goals and track progress toward achieving them.  
The User Stories of this feature are described below.

### US-01: Create a Financial Goal {#us-01-create-a-financial-goal}

### US-02: View a list of Financial Goals {#us-02-view-a-list-of-financial-goals}

### US-03: View a Financial Goal {#us-03-view-a-financial-goal}

### US-04: Update a Financial Goal {#us-04-update-a-financial-goal}

### US-05: Close a Financial Goal {#us-05-close-a-financial-goal}

## Feature-09: Investment Portfolio {#feature-09-investment-portfolio}

Enables Users to record and monitor investment information inside their single Investment Portfolio (Investment Index) to get a basic performance overview.

The User Stories of this feature are described below.

### US-01: View the Investment Portfolio {#us-01-view-the-investment-portfolio}

### US-02: Update the Investment Portfolio Settings {#us-02-update-the-investment-portfolio-settings}

### US-03: Add a Holding to the Investment Portfolio {#us-03-add-a-holding-to-the-investment-portfolio}

### US-04: Update a Holding {#us-04-update-a-holding}

### US-05: Remove a Holding {#us-05-remove-a-holding}

## Feature-10: Notification Handling {#feature-10-notification-handling}

Informs Users about important financial events or system conditions through Notifications.  
The User Stories of this feature are described below.

### US-01: View the list of Notifications (MVP) {#us-01-view-the-list-of-notifications-mvp}

### US-02: View a Notification (MVP) {#us-02-view-a-notification-mvp}

### US-03: Mark a Notification as Read {#us-03-mark-a-notification-as-read}

## Feature-11: Data Overview Dashboard {#feature-11-data-overview-dashboard}

## Feature-12: AI Chat Assistant {#feature-12-ai-chat-assistant}

Provides a conversational interface, backed by the AI Service (see CLAUDE.md architecture), that lets Users record, edit, and query Transactions using natural-language (Vietnamese) messages instead of manual forms. All AI-proposed writes require explicit User confirmation before being persisted, and go through the same ownership and validation rules as manual Transaction entry (FR-02).  
The User Stories of this feature are described below.

### US-01: Create a Transaction via Chat [MVP] {#us-01-create-a-transaction-via-chat-mvp}

*As a User*  
*I want to describe an expense or income in a natural-language chat message*  
*so that the System creates the Transaction for me without filling a form.*

  **Background**:  
    **Given** the User is logged in  
     And the User has a default Wallet "Cash Wallet"  
     And the User has a Category "Food" (type Expense)

  **Scenario: Create a single expense transaction from a chat message**  
    **Given** the User is on the "AI Chat" screen  
    **When** the User sends the message "ăn trưa 50k"  
    **Then** the System proposes 1 expense Transaction: amount 50,000, category "Food", date today, wallet "Cash Wallet"  
     And the System shows a confirmation card before creating anything  
    **When** the User taps "Confirm"  
    **Then** the System creates the Transaction  
     And the System updates the wallet balance accordingly

  **Scenario: Create multiple transactions from one message**  
    **When** the User sends the message "hôm qua cơm tấm 30k và 2 trà đá 5k"  
    **Then** the System proposes 2 expense Transactions dated yesterday: 30,000 and 10,000 (2 × 5,000), both category "Food"  
     And each proposed Transaction is shown in the confirmation card before creation

  **Scenario: Ask for clarification when required information is missing**  
    **When** the User sends the message "50k"  
    **Then** the System does not create a Transaction  
     And the System asks a clarifying question about transaction type and category

  **Scenario: Do not create when the AI cannot confidently resolve the Category**  
    **Given** the AI's confidence in the matched Category is below the System's threshold  
    **When** the User sends an ambiguous message  
    **Then** the System marks the proposal as "needs review"  
     And does not create the Transaction until the User confirms or corrects the Category

### US-02: Edit a Transaction via Chat [MVP] {#us-02-edit-a-transaction-via-chat-mvp}

*As a User*  
*I want to reference an existing Transaction in a chat message with an edit prefix*  
*so that the System updates it instead of creating a duplicate.*

  **Background**:  
    **Given** the User is logged in  
     And the User previously recorded a Transaction "Cơm tấm" for 30,000 dated yesterday

  **Scenario: Update an existing transaction when exactly one match is found**  
    **When** the User sends the message "sửa@ hôm qua cơm tấm 45k"  
    **Then** the System finds the single matching Transaction "Cơm tấm" dated yesterday  
     And the System shows a confirmation card with the amount change from 30,000 to 45,000  
    **When** the User taps "Confirm"  
    **Then** the System updates the Transaction amount to 45,000

  **Scenario: Let the User choose when multiple transactions match**  
    **Given** the User has 3 Transactions with note containing "cà phê"  
    **When** the User sends the message "sửa@ cà phê"  
    **Then** the System lists the 3 matching Transactions for the User to choose from  
     And no Transaction is updated until the User selects one

  **Scenario: Reject the edit when no matching transaction is found**  
    **When** the User sends the message "sửa@ meeting lunch tháng trước"  
     And no Transaction matches  
    **Then** the System does not create or update any Transaction  
     And the System shows the message "Không tìm thấy giao dịch phù hợp"

### US-03: Query Spending via Chat [MVP] {#us-03-query-spending-via-chat-mvp}

*As a User*  
*I want to ask the System about my spending in natural language*  
*so that I can check my financial status without opening the Reports screen.*

  **Scenario: Answer a total-spending question with real data**  
    **Given** the User has recorded Transactions this month totaling 2,450,000 in expenses  
    **When** the User sends the message "tháng này tôi tiêu bao nhiêu?"  
    **Then** the System responds with the actual total, e.g. "Tháng này bạn đã chi 2,450,000đ"  
     And the System does not fabricate figures not derived from the User's own data

  **Scenario: Compare spending between two periods**  
    **When** the User sends the message "ăn uống tháng này so với tháng trước?"  
    **Then** the System responds with both periods' totals for category "Food" and the percentage change

### US-04: General Financial Advice [Post-MVP] {#us-04-general-financial-advice-post-mvp}

*As a User*  
*I want to ask the AI for general personal-finance guidance*  
*so that I get direction on managing my spending, based on my own recorded data.*

# Feature-level Release (Overview) {#feature-level-release-overview}

The following table shows how the complete product scope defined in the SRS is delivered incrementally.

The MVP includes eight core features to ensure a usable and valuable first release, while additional features are introduced in later releases as the product evolves.

| No. | Feature | MVP | Release 1 | Release 2 | Note |
| :---: | ----- | :---: | :---: | :---: | ----- |
| 1 | **User Management** | ✔ | ✔ | ✔ | Core user identity and profile management |
| 2 | **System Security** | ✔ | ✔ | ✔ | Authentication, authorization, and data protection |
| 3 | **Wallet Management** | ✔ | ✔ | ✔ | Core financial structure |
| 4 | **Category Management** | ✔ | ✔ |  | Basic categorization is sufficient for early stages |
| 5 | **Budget Management** | ✔ | ✔ | ✔ | Essential for spending control and planning |
| 6 | **Transaction Management** | ✔ | ✔ | ✔ | Core financial activities |
| 7 | **Financial Reporting** | ✔ | ✔ | ✔ | Insights improve progressively over releases |
| 8 | **Financial Goal**  |  | ✔ | ✔ | Depends on stable budgeting and reporting |
| 9 | **Investment Management** |  |  | ✔ | Advanced feature for mature users |
| 10 | **Notification Handling** | ✔ | ✔ | ✔ | User feedback and engagement |
| 11 | **Data Overview Dashboard** |  | ✔ | ✔ | High-level financial insights |
| 12 | **AI Chat Assistant** |  | ✔ | ✔ | Conversational transaction entry/edit/query; depends on stable Transaction Management (F-06); all AI-proposed writes require explicit User confirmation |

