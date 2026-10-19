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
  - [FR-10: AI-Assisted Budget Setup](#fr-10-ai-assisted-budget-setup)
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
  - [BF-11: Supporting BF – AI Budget Setup Wizard](#bf-11-supporting-bf-ai-budget-setup-wizard)
- [6. Features and User Stories (US)](#6-features-and-user-stories-us)
  - [Feature-01: User Management](#feature-01-user-management)
    - [US-01: Register a User [MVP]](#us-01-register-a-user-mvp)
    - [US-02: Update a User Profile](#us-02-update-a-user-profile)
    - [US-03: Sign a Member Out of All Devices [Release 1]](#us-03-sign-a-member-out-of-all-devices-release-1)
  - [Feature-02: System Security](#feature-02-system-security)
    - [US-01: Login [MVP]](#us-01-login-mvp)
    - [US-02: Logout [MVP]](#us-02-logout-mvp)
    - [US-03: Switch Between Saved Accounts [Release 1]](#us-03-switch-between-saved-accounts-release-1)
    - [US-04: Require Device Unlock Before Switching [Release 1]](#us-04-require-device-unlock-before-switching-release-1)
    - [US-05: Log Out of All Devices [Release 1]](#us-05-log-out-of-all-devices-release-1)
    - [US-06: See and Sign Out Signed-in Devices [Release 1]](#us-06-see-and-sign-out-signed-in-devices-release-1)
    - [US-07: Change Password [Release 1]](#us-07-change-password-release-1)
    - [US-08: Lock the App [Release 1]](#us-08-lock-the-app-release-1)
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
    - [US-06: Add Items to a Transaction [Release 1]](#us-06-add-items-to-a-transaction-release-1)
    - [US-07: View the Items of a Transaction [Release 1]](#us-07-view-the-items-of-a-transaction-release-1)
    - [US-08: Edit the Items of a Saved Transaction [Release 1]](#us-08-edit-the-items-of-a-saved-transaction-release-1)
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
    - [US-05: Record Transactions from an Image [Release 1]](#us-05-record-transactions-from-an-image-release-1)
  - [Feature-13: AI Budget Setup Wizard](#feature-13-ai-budget-setup-wizard)
    - [US-01: Start the Wizard from a Quick Action [Release 1]](#us-01-start-the-wizard-from-a-quick-action-release-1)
    - [US-02: Start the Wizard from a Chat Message [Release 1]](#us-02-start-the-wizard-from-a-chat-message-release-1)
    - [US-03: Select Categories and Spending Preferences [Release 1]](#us-03-select-categories-and-spending-preferences-release-1)
    - [US-04: Review the AI-Proposed Budget Allocation [Release 1]](#us-04-review-the-ai-proposed-budget-allocation-release-1)
    - [US-05: Confirm and Create Budgets in Bulk [Release 1]](#us-05-confirm-and-create-budgets-in-bulk-release-1)
  - [Feature-14: Offline Use](#feature-14-offline-use)
    - [US-01: Stay Signed In and Read Data Offline [Release 1]](#us-01-stay-signed-in-and-read-data-offline-release-1)
    - [US-02: Record a Transaction Offline [Release 1]](#us-02-record-a-transaction-offline-release-1)
    - [US-03: Sync Queued Transactions Automatically [Release 1]](#us-03-sync-queued-transactions-automatically-release-1)
    - [US-04: Manage Queued Transactions [Release 1]](#us-04-manage-queued-transactions-release-1)
    - [US-05: Sign Out with Unsynced Transactions [Release 1]](#us-05-sign-out-with-unsynced-transactions-release-1)
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
A Transaction may optionally list its **Items** (what was bought or received) and **Adjustments** (tax, fee, discount); together they must add up to the Transaction amount, which remains the amount counted in reports and budgets.

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

The same interface shall accept **a photo** (receipt, handwritten note, or spreadsheet screenshot) in place of a typed message and propose the Transactions it contains under the same confirmation rule. The photo shall be used only for that reading and never stored.

## FR-10: AI-Assisted Budget Setup {#fr-10-ai-assisted-budget-setup}

The System shall let Users set up or replace their Budgets (FR-04) for a period through a guided, AI-assisted flow — entering income and selecting Categories and desired spending levels — instead of creating each Budget one at a time.

Based on the User's income and per-Category preferences, the AI shall propose a spending allocation across the selected Categories, following a fixed, rule-based allocation formula rather than free-form generation, and shall present it for the User's review and adjustment before anything is saved. Creating the proposed Budgets shall require **explicit User confirmation** and shall replace the User's existing Budgets for the current period atomically, through the same validation and ownership rules enforced by Budget Tracking (FR-04).

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

On mobile, losing the network shall not sign the User out or lose a recorded Transaction: the User can read last-known data and record Transactions offline, which are sent automatically when the connection returns and are never booked twice (see Feature-14: Offline Use).

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

## BF-11: Supporting BF – AI Budget Setup Wizard {#bf-11-supporting-bf-ai-budget-setup-wizard}

This flow describes how Users set up their Budgets through the AI-assisted wizard instead of the manual Budget Management flow (BF-04).

1. The User **opens the Budget Setup wizard**, either from a quick action or by asking the AI Chat Assistant to help plan a Budget.  
2. The User **enters their income for the period and selects which Categories to budget for**, along with a desired spending level for each.  
3. The System **proposes a spending allocation** across the selected Categories and **shows it to the User for review**.  
4. The User **adjusts individual amounts if desired**, then **confirms**.  
5. The System **creates the proposed Budgets**, replacing any existing Budgets for the User, through the standard Budget Management flow (FR-04).

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

### US-03: Sign a Member Out of All Devices [Release 1] {#us-03-sign-a-member-out-of-all-devices-release-1}

*As an Admin*  
*I want to sign a member out of every device at once*  
*so that I can cut off access from a lost or shared phone without deactivating the member's account.*

  **Background**:  
    **Given** the Admin is logged in  
     And member "Bình" is logged in on two devices and saved for account switching on a third

  **Scenario: Sign a member out of all devices**  
    **When** the Admin opens "Bình" in the User list  
     And the Admin taps "Đăng xuất khỏi tất cả thiết bị" and confirms  
    **Then** the System ends every session of "Bình"  
     And "Bình" can no longer be switched to on any device without a password  
     And the account of "Bình" stays active, so "Bình" can log in again with a password

  **Scenario: Reject the action for a non-admin**  
    **Given** the User is logged in with role "member"  
    **When** the User attempts to sign another User out of all devices  
    **Then** the System rejects the request  
     And no session of the other User is ended

## Feature-02: System Security {#feature-02-system-security}

Ensures secure access to the System by allowing Users to log in and log out safely, protecting personal financial data. Moreover, each User is authorized to see only his/her financial data. On mobile, several Users sharing one device can switch between their accounts without logging out or re-entering a password, protected by the device's own unlock: each account types its password once per device and then keeps its own signed-in session on that device, until it goes 60 days unused or 180 days have passed since that sign-in. A User can see which devices are signed in to the account and sign one out, sign out every other device at once, change the password, and lock the app behind the device's unlock.  
The User Stories of this feature are described below.

### US-01: Login [MVP] {#us-01-login-mvp}

### US-02: Logout [MVP] {#us-02-logout-mvp}

### US-03: Switch Between Saved Accounts [Release 1] {#us-03-switch-between-saved-accounts-release-1}

*As a User*  
*I want to switch to another account that has already logged in on this device*  
*so that people sharing a phone can move between accounts without logging out or typing a password.*

  **Background**:  
    **Given** User "An" and User "Bình" have each logged in on this device before  
     And User "An" is currently logged in

  **Scenario: Remember every account that logs in automatically**  
    **Given** no account is saved on this device  
    **When** User "An" logs in with email and password  
    **Then** the System saves "An" to this device's account list  
     And the login screen offers no "remember me" choice

  **Scenario: Switch to another saved account without a password**  
    **When** the User taps "Chuyển tài khoản" in Settings and selects "Bình"  
     And the device unlock succeeds (see US-04)  
    **Then** the System signs "Bình" in within 10 seconds without asking for a password  
     And no data of "An" is shown to, or saved under, "Bình"  
     And "An" stays in the account list and can be switched back to without a password

  **Scenario: Keep at most 5 accounts per device**  
    **Given** 5 accounts are saved on this device  
    **When** a 6th User logs in on this device  
    **Then** the System saves the new account  
     And the System removes the least recently used account that is not currently logged in

  **Scenario: Require a password again after 60 days unused**  
    **Given** "Bình" has not been used on this device for more than 60 days  
    **When** the User selects "Bình" in the account list  
    **Then** the System does not switch  
     And the System marks "Bình" as "Hết phiên" and asks for the password of "Bình"

  **Scenario: Require a password again 180 days after signing in**  
    **Given** "Bình" logged in with a password on this device more than 180 days ago  
     And "Bình" has been used on this device every week since  
    **When** the User selects "Bình" in the account list  
    **Then** the System does not switch  
     And the System marks "Bình" as "Hết phiên" and asks for the password of "Bình"

  **Scenario: Keep the other saved accounts when one needs a password again**  
    **Given** "Bình" is marked "Hết phiên" on this device  
     And User "Chi" is also saved on this device  
    **When** the User selects "Chi"  
    **Then** the System switches to "Chi" without asking for a password

  **Scenario: Keep the current account when a switch fails**  
    **Given** the device is offline  
    **When** the User selects "Bình"  
    **Then** the System keeps "An" logged in exactly as before  
     And the System shows error "Cần kết nối mạng để chuyển tài khoản."

  **Scenario: Remove a saved account from the device**  
    **When** the User removes "Bình" from the account list and confirms  
    **Then** "Bình" can no longer be entered from this device without a password

  **Scenario: Offer saved accounts after logging out**  
    **When** "An" logs out  
    **Then** "An" is removed from this device's account list  
     And the login screen offers "Tiếp tục với…" for "Bình"

### US-04: Require Device Unlock Before Switching [Release 1] {#us-04-require-device-unlock-before-switching-release-1}

*As a User*  
*I want switching into a saved account to require the device's fingerprint, face or passcode*  
*so that someone holding the unlocked phone cannot enter an account just by tapping it.*

  **Background**:  
    **Given** User "An" is logged in  
     And User "Bình" is saved on this device

  **Scenario: Require device unlock by default**  
    **Given** the switching protection under "Bảo mật" has not been changed  
    **When** the User selects "Bình" in the account list  
    **Then** the System asks for the device's biometric or passcode  
    **When** the device confirms the unlock  
    **Then** the System switches to "Bình"

  **Scenario: Do not switch when device unlock fails or is cancelled**  
    **When** the User selects "Bình"  
     And the device unlock fails or is cancelled  
    **Then** the System does not switch  
     And "An" stays logged in exactly as before

  **Scenario: Turn off device unlock for switching**  
    **Given** the User has turned off the switching protection under "Bảo mật"  
    **When** the User selects "Bình"  
    **Then** the System switches to "Bình" without asking for device unlock

### US-05: Log Out of All Devices [Release 1] {#us-05-log-out-of-all-devices-release-1}

*As a User*  
*I want to log my account out of every other device at once*  
*so that a lost or shared phone can no longer reach my financial data.*

  **Background**:  
    **Given** User "An" is logged in on this phone and on another device  
     And "An" is saved for account switching on a third device

  **Scenario: Log out of all other devices**  
    **When** the User taps "Đăng xuất khỏi tất cả thiết bị" under "Bảo mật" and confirms  
    **Then** the System ends every other session of "An"  
     And "An" can no longer be switched to on any other device without a password  
     And this device stays logged in

  **Scenario: Another device is signed out on its next contact**  
    **Given** "An" was logged out of all devices from another phone  
    **When** this device next contacts the System  
    **Then** the System signs "An" out on this device  
     And the System shows the login screen

### US-06: See and Sign Out Signed-in Devices [Release 1] {#us-06-see-and-sign-out-signed-in-devices-release-1}

*As a User*  
*I want to see which devices are signed in to my account and sign one of them out*  
*so that a lost or sold phone loses access without signing out all my other devices.*

  **Background**:  
    **Given** User "An" is logged in on this phone and on a second phone  
     And "An" is saved for account switching on a third phone

  **Scenario: List the signed-in devices**  
    **When** the User opens "Thiết bị đang đăng nhập" under "Bảo mật"  
    **Then** the System lists every device where "An" is signed in, most recently used first  
     And this phone is marked "Thiết bị này" and cannot be signed out from the list  
     And every other device shows when it was last used, for example "Hoạt động 18/10/2026"  
     And a device that did not report its name shows "Thiết bị không rõ tên"

  **Scenario: Sign out one device**  
    **When** the User taps "Đăng xuất" on the second phone  
     And the User confirms "Đăng xuất thiết bị"  
    **Then** the System shows "Đã đăng xuất {device}"  
     And the second phone is signed out of "An" on its next contact with the System  
     And "An" on the third phone and on this phone are not affected

  **Scenario: A signed-out device needs the password again**  
    **Given** the User signed the third phone out  
    **When** someone selects "An" in the account list of the third phone  
    **Then** the System does not switch  
     And the System marks "An" as "Hết phiên" on the third phone and asks for the password of "An"

  **Scenario: Keep everything when the device cannot be signed out**  
    **Given** this phone is offline  
    **When** the User confirms "Đăng xuất thiết bị"  
    **Then** no device is signed out  
     And the System shows error "Cần kết nối mạng để đăng xuất thiết bị."

### US-07: Change Password [Release 1] {#us-07-change-password-release-1}

*As a User*  
*I want to change my password from the app*  
*so that whoever knows my old password, and every device signed in with it, is locked out.*

  **Background**:  
    **Given** User "An" is logged in on this phone and on a second phone  
     And the User is on the "Đổi mật khẩu" screen under "Bảo mật"

  **Scenario: Change the password**  
    **When** the User enters the current password  
     And the User enters a new password of at least 8 characters twice  
     And the User taps "Đổi mật khẩu"  
    **Then** the System saves the new password  
     And this phone stays logged in  
     And the System shows "Đã đổi mật khẩu. Thiết bị khác cần đăng nhập lại."  
     And the second phone is signed out of "An" on its next contact with the System

  **Scenario: Reject a wrong current password**  
    **When** the User enters a wrong current password and taps "Đổi mật khẩu"  
    **Then** the System keeps the old password  
     And the System shows error "Mật khẩu hiện tại không đúng."  
     And this phone stays logged in

  **Scenario: Reject a new password that is too short or the same as the current one**  
    **When** the User enters a new password shorter than 8 characters, or equal to the current password  
    **Then** the System keeps the old password  
     And the System shows "Mật khẩu mới cần ít nhất 8 ký tự." or "Mật khẩu mới trùng mật khẩu hiện tại."

  **Scenario: Limit wrong tries**  
    **Given** the User entered a wrong current password 5 times in the last 15 minutes  
    **When** the User tries again  
    **Then** the System rejects the request  
     And the System shows error "Thử quá nhiều lần. Thử lại sau 15 phút."

### US-08: Lock the App [Release 1] {#us-08-lock-the-app-release-1}

*As a User*  
*I want the app to ask for the device's fingerprint, face or screen-lock code when it opens*  
*so that someone picking up my unlocked phone cannot read my finances.*

  **Background**:  
    **Given** User "An" is logged in  
     And the device has a fingerprint or screen lock set up

  **Scenario: App lock is off by default**  
    **Given** "Khóa ứng dụng" under "Bảo mật" has not been changed  
    **When** the User opens the app  
    **Then** the System shows the app without asking for device unlock

  **Scenario: Ask for device unlock when the app opens**  
    **Given** the User has turned on "Khóa ứng dụng" after passing the device unlock  
    **When** the User opens the app, or comes back to it after 5 minutes or more  
    **Then** the System shows "Ứng dụng đang khóa" and nothing of the User's data  
    **When** the device confirms the unlock  
    **Then** the System shows the screen the User was on

  **Scenario: Do not ask again within 5 minutes**  
    **Given** "Khóa ứng dụng" is on  
    **When** the User comes back to the app after less than 5 minutes  
    **Then** the System shows the app without asking for device unlock

  **Scenario: Cannot turn on app lock without a screen lock**  
    **Given** the device has no fingerprint, face or screen lock set up  
    **When** the User turns on "Khóa ứng dụng"  
    **Then** app lock stays off  
     And the System shows "Máy chưa cài khóa màn hình nên chưa bật được khóa ứng dụng."

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

### US-06: Add Items to a Transaction [Release 1] {#us-06-add-items-to-a-transaction-release-1}
*As a User,*  
*I want to list the Items (and any tax, fee or discount lines) of a purchase while recording it*  
*so that I keep what I bought without splitting one payment into many Transactions.*

Items have no Category of their own; they belong to the Transaction's Category. Quantity is a whole number. The Transaction amount (the total paid) stays the source of truth: Items may add up to a different number only when Adjustment lines (tax, fee, discount, other) explain the difference.

  **Background**:  
    **Given** the User is logged in  
     And the User has a Wallet "Cash Wallet" in VND with balance 1,000,000  
     And the User has a Category "Food" (type Expense)

  **Scenario: Record a supermarket purchase with Items and tax**  
    **When** the User records an expense in "Food" with Items "Milk" 2 x 15,000 and "Bread" 1 x 70,000  
     And adds a tax line of 8,000  
     And enters amount 108,000  
    **Then** the System saves 1 Transaction of 108,000 with 2 Items and 1 tax line  
     And the "Cash Wallet" balance becomes 892,000

  **Scenario: Reject Items that do not add up to the amount**  
    **When** the User records an expense with Items totaling 100,000 and amount 108,000 and no Adjustment  
    **Then** the System does not save the Transaction  
     And the System shows the 8,000 difference and offers to add it as an Adjustment

### US-07: View the Items of a Transaction [Release 1] {#us-07-view-the-items-of-a-transaction-release-1}
*As a User,*  
*I want to see the Items and Adjustments of a recorded Transaction*  
*so that I can check what a payment was for.*

  **Scenario: See the Items of a Transaction**  
    **Given** the User recorded a Transaction with 2 Items and 1 tax line  
    **When** the User opens the Transaction  
    **Then** the System shows the 2 Items, the tax line, the Items total and the amount

### US-08: Edit the Items of a Saved Transaction [Release 1] {#us-08-edit-the-items-of-a-saved-transaction-release-1}
*As a User,*  
*I want to add, change or remove the Items of a Transaction I already saved*  
*so that I can correct a misread line or finish a list later.*

  **Scenario: Fix an Item and the amount together**  
    **Given** a saved Transaction of 108,000 with Items totaling 100,000 and a tax line of 8,000  
    **When** the User changes an Item from 30,000 to 35,000 and the amount to 113,000  
    **Then** the System saves the change  
     And the Wallet balance moves by 5,000 once

  **Scenario: Reject an edit that breaks the total**  
    **When** the User changes an Item from 30,000 to 35,000 but keeps the amount at 108,000  
    **Then** the System does not save the change and the Wallet balance is unchanged

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

Provides a conversational interface, backed by the AI Service (see CLAUDE.md architecture), that lets Users record, edit, and query Transactions using natural-language (Vietnamese) messages — or a photo of a receipt, note or spreadsheet — instead of manual forms. All AI-proposed writes require explicit User confirmation before being persisted, and go through the same ownership and validation rules as manual Transaction entry (FR-02).  
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

### US-05: Record Transactions from an Image [Release 1] {#us-05-record-transactions-from-an-image-release-1}

*As a User*  
*I want to send a photo of a receipt, a handwritten note, or a spreadsheet screenshot in the AI Chat*  
*so that the System proposes the matching Transactions without me typing them.*

This release reads VND amounts only and records them into VND Wallets, without currency conversion. The image is used only for one reading and is never stored by the System; only Transactions the User confirms are saved.

  **Background**:  
    **Given** the User is logged in and the device is online  
     And the User has a default Wallet "Cash Wallet" in VND  
     And the User has a Category "Food" (type Expense)

  **Scenario: Propose the total of a printed receipt**  
    **Given** the User is on the "AI Chat" screen  
    **When** the User attaches a photo of a receipt showing total 145,000, cash given 200,000 and change 55,000  
     And the User taps "Send"  
    **Then** the System proposes 1 expense Transaction: amount 145,000, category "Food", wallet "Cash Wallet", dated as printed on the receipt  
     And the receipt's line items are attached to that proposal as Items, not proposed separately  
     And the System does not propose the cash given or the change  
     And nothing is created until the User confirms the proposal

  **Scenario: Propose one Transaction per handwritten entry or spreadsheet row**  
    **When** the User sends a photo of a handwritten note "cafe 45k, xăng 80k"  
    **Then** the System proposes 2 Transactions of 45,000 and 80,000, each on its own confirmation card  
    **When** the User sends a screenshot of a sheet with a header row, 5 data rows and a total row  
    **Then** the System proposes exactly 5 Transactions

  **Scenario: Flag a proposal for review when no date is visible**  
    **When** the User sends a receipt photo with no readable date  
    **Then** the System proposes the Transaction dated today  
     And the proposal is marked "needs review"

  **Scenario: Confirm each proposal independently and only once**  
    **Given** the System proposed 2 Transactions from one image  
    **When** the User confirms the first proposal twice in a row  
    **Then** the System creates exactly 1 Transaction and updates the wallet balance once  
     And the second proposal stays pending until the User confirms, edits or discards it

  **Scenario: Propose nothing when the image shows no expense or income**  
    **When** the User sends a photo of a landscape  
    **Then** the System proposes no Transaction  
     And the System suggests a clearer photo or typing the Transaction instead

  **Scenario: Read at most 20 entries per image**  
    **When** the User sends a screenshot of a sheet with 30 data rows  
    **Then** the System proposes only the first 20 rows  
     And the System says the remaining rows were not read

  **Scenario: Enforce the image limits**  
    **Given** the User has already sent 10 images in the past hour  
    **When** the User sends another image  
    **Then** the System does not read it and asks the User to try again later  
     And typed chat messages still work  
    **When** the User enters a caption longer than 300 characters  
    **Then** the System does not send the image  
     And the System shows a validation error

  **Scenario: Image capture needs a connection**  
    **Given** the device is offline  
    **When** the User opens the AI Chat  
    **Then** the attach-image action is unavailable, with a short explanation

## Feature-13: AI Budget Setup Wizard {#feature-13-ai-budget-setup-wizard}

Lets a User set up or replace their Budgets (Feature-05) for a period through a guided flow inside the AI Chat surface, instead of creating each Budget one at a time. The User provides income and, for each Category they want to budget for, a desired spending level; the System proposes a concrete spending allocation the User can review and adjust before anything is saved. All AI-proposed Budgets require **explicit User confirmation**, and creating them goes through the same rules as manual Budget Management (Feature-05).  
The User Stories of this feature are described below.

### US-01: Start the Wizard from a Quick Action [Release 1] {#us-01-start-the-wizard-from-a-quick-action-release-1}

*As a User*  
*I want to open the Budget Setup wizard directly from the AI Chat screen*  
*so that I can set up my Budgets without first describing what I want in a chat message.*

  **Background**:  
    **Given** the User is logged in  
     And the User has at least one Wallet

  **Scenario: Open the wizard and see it pre-filled with existing budgets**  
    **Given** the User already has a Budget for Category "Food"  
    **When** the User taps the "Set up Budget" quick action on the AI Chat screen  
    **Then** the System opens the Budget Setup wizard  
     And Category "Food" is pre-selected, showing its current Budget amount  
     And no chat message is recorded for opening the wizard this way

### US-02: Start the Wizard from a Chat Message [Release 1] {#us-02-start-the-wizard-from-a-chat-message-release-1}

*As a User*  
*I want to ask the AI, in my own words, to help me plan my Budgets*  
*so that I can start the wizard the same way I already talk to the AI about my transactions.*

  **Scenario: Open the wizard from a natural-language request**  
    **Given** the User is on the "AI Chat" screen  
    **When** the User sends the message "giúp tôi set budget"  
    **Then** the System recognizes the request as a Budget-setup intent  
     And the System replies with a tappable card instead of plain text  
    **When** the User taps the card  
    **Then** the System opens the Budget Setup wizard  
     And the chat message and the AI's reply are recorded as usual

### US-03: Select Categories and Spending Preferences [Release 1] {#us-03-select-categories-and-spending-preferences-release-1}

*As a User*  
*I want to enter my income and choose which Categories to budget for, with how much I want to spend on each*  
*so that the System has enough information to propose a sensible allocation.*

  **Scenario: Provide income, categories, and spending levels**  
    **Given** the User is in the wizard  
    **When** the User enters an income amount for the period  
     And the User selects one or more Categories to budget for  
     And the User sets a spending level for each selected Category (e.g. "Little", "Normal", "A lot", or "Let the AI decide")  
    **Then** the System accepts the input and proceeds to propose an allocation

  **Scenario: Reject when no Category is selected**  
    **When** the User proceeds without selecting any Category  
    **Then** the System does not proceed  
     And the System shows validation error "Please select at least one category"

  **Scenario: Reject when income is not greater than zero**  
    **When** the User enters an income amount of 0  
    **Then** the System does not proceed  
     And the System shows validation error "Income must be greater than 0"

### US-04: Review the AI-Proposed Budget Allocation [Release 1] {#us-04-review-the-ai-proposed-budget-allocation-release-1}

*As a User*  
*I want to see how the System proposes to split my income across my chosen Categories, and adjust any amount*  
*so that the final Budgets match my own judgment, not just the System's suggestion.*

  **Scenario: Review a proposal and adjust an amount**  
    **Given** the System has proposed an allocation for the User's selected Categories  
    **When** the User views the proposal  
    **Then** the System shows, for each Category, a proposed amount and its share of the User's income  
     And the System shows the portion of income left unallocated  
    **When** the User changes the proposed amount for one Category  
    **Then** the System updates the unallocated portion accordingly  
     And does not need to contact the AI again to reflect the change

### US-05: Confirm and Create Budgets in Bulk [Release 1] {#us-05-confirm-and-create-budgets-in-bulk-release-1}

*As a User*  
*I want to confirm the reviewed allocation and have all of my Budgets created at once*  
*so that I don't have to repeat the same steps once per Category.*

  **Background**:  
    **Given** the User has reviewed a proposed allocation for Categories "Food" and "Transport"  
     And the User already has an existing Budget for Category "Shopping"

  **Scenario: Confirm and replace existing budgets**  
    **When** the User taps "Confirm and Create Budgets"  
    **Then** the System creates a Budget for "Food" and a Budget for "Transport" per the reviewed amounts  
     And the System removes the User's existing Budget for "Shopping", since it was not part of this wizard run  
     And the System shows a success message with the number of Budgets created

  **Scenario: Do not save anything when the User dismisses the wizard**  
    **Given** the User is at any step of the wizard  
    **When** the User dismisses the wizard instead of confirming  
    **Then** the System does not create or change any Budget  
     And the System does not create any Category that was only being considered

  **Scenario: Reject confirmation when a selected category no longer exists**  
    **Given** one of the reviewed Categories was deleted after the proposal was shown  
    **When** the User taps "Confirm and Create Budgets"  
    **Then** the System does not create any Budget from this confirmation  
     And the System shows error "Category no longer exists"

## Feature-14: Offline Use {#feature-14-offline-use}

Lets Users keep using the mobile app when the network is unavailable, in support of NFR-06 Reliability. The User stays logged in, sees the last-known data saved on the device, and can record new Transactions, which wait in a visible per-User queue and are sent automatically when the connection returns — never lost and never booked twice. Only creating a Transaction works offline; every other change needs a connection. The System remains the only source of balances, totals and Budget usage.  
The User Stories of this feature are described below.

### US-01: Stay Signed In and Read Data Offline [Release 1] {#us-01-stay-signed-in-and-read-data-offline-release-1}

*As a User*  
*I want to stay logged in and see my last-known data when my phone has no network*  
*so that I can still check my Wallets and spending anywhere.*

  **Background**:  
    **Given** the User has logged in on this device  
     And the User has opened the app online within the last 7 days

  **Scenario: Stay logged in when the network is lost**  
    **Given** the device is offline  
    **When** the User opens the app  
    **Then** the System keeps the User logged in  
     And the System shows an offline indicator with the time the data was last updated

  **Scenario: Show last-known data offline**  
    **Given** the device is offline  
    **When** the User opens Wallets, Categories, Budgets, the report summary or recent Transactions  
    **Then** the System shows the last-known data saved on this device for this User  
     And actions that need a connection are shown as unavailable

  **Scenario: Do not show saved data older than 7 days**  
    **Given** the data saved on this device is more than 7 days old  
    **When** the User opens the app offline  
    **Then** the System does not show that data  
     And the System asks the User to connect to refresh it

  **Scenario: Refresh when the connection returns**  
    **When** the device reconnects  
    **Then** the System hides the offline indicator  
     And the System refreshes the data shown

  **Scenario: End the session only when the System refuses it**  
    **Given** the device is online  
     And the User's session has expired or was revoked  
    **When** the app tries to renew the session  
    **Then** the System logs the User out  
     And any queued Transactions of the User are kept on this device

### US-02: Record a Transaction Offline [Release 1] {#us-02-record-a-transaction-offline-release-1}

*As a User*  
*I want to save a new income, expense or transfer when I have no connection*  
*so that I can record spending the moment it happens and trust it will reach my account later.*

  **Background**:  
    **Given** the User is logged in and the device is offline  
     And Wallet "Cash Wallet" and Category "Food" are saved on this device

  **Scenario: Queue a Transaction recorded offline**  
    **When** the User creates an expense of 50,000 in category "Food" from "Cash Wallet" and taps "Save"  
    **Then** the System validates the form exactly as online  
     And the System saves the Transaction in this User's queue on the device, marked "waiting to sync"  
     And the System shows message "Saved on the device — will sync when online"  
     And the balance of "Cash Wallet" is not changed on the device, with a hint that 1 Transaction is not counted yet

  **Scenario: Queue a Transaction when the server does not answer**  
    **Given** the device reports a connection but the System does not answer  
    **When** the User saves a new Transaction  
    **Then** the System adds the Transaction to the queue instead of losing it

  **Scenario: Refuse to queue more than 200 Transactions**  
    **Given** the User already has 200 queued Transactions  
    **When** the User saves another Transaction offline  
    **Then** the System does not queue it  
     And the System asks the User to connect and sync first

  **Scenario: Keep every other change online-only**  
    **When** the User tries to edit or delete a Transaction, or change a Wallet, Category or Budget, while offline  
    **Then** the System does not perform the change  
     And the System explains that a connection is needed

### US-03: Sync Queued Transactions Automatically [Release 1] {#us-03-sync-queued-transactions-automatically-release-1}

*As a User*  
*I want my queued Transactions to be sent by themselves when I am back online*  
*so that my Wallets and reports catch up without me doing anything.*

  **Background**:  
    **Given** the User is logged in  
     And the User has 3 queued Transactions

  **Scenario: Sync when the connection returns**  
    **When** the device reconnects  
    **Then** the System sends the queued Transactions one at a time, oldest first  
     And each accepted Transaction is removed from the queue  
     And balances, reports and Budgets are refreshed from the System  
     And the System shows message "3 Transactions synced"

  **Scenario: Never book a Transaction twice**  
    **Given** a queued Transaction already reached the System but the reply was lost  
    **When** the System sends it again  
    **Then** the System does not create a second Transaction  
     And the wallet balance changes only once

  **Scenario: Keep a refused Transaction for review**  
    **Given** the balance of the Wallet is too low for the second queued Transaction  
    **When** the queue syncs  
    **Then** the second Transaction is marked "Failed" with the reason and kept in the queue  
     And the other Transactions are still sent

  **Scenario: Never send one User's queue as another User**  
    **Given** User "An" kept queued Transactions on this device and logged out  
    **When** User "Bình" logs in on this device  
    **Then** the queued Transactions of "An" are neither shown to "Bình" nor sent for "Bình"  
     And they are sent the next time "An" logs in on this device

### US-04: Manage Queued Transactions [Release 1] {#us-04-manage-queued-transactions-release-1}

*As a User*  
*I want to see which Transactions are still waiting or have failed, and fix or discard them*  
*so that I always know which records have not reached my account yet.*

  **Background**:  
    **Given** the User is logged in  
     And the User has 1 waiting and 1 failed queued Transaction

  **Scenario: View queued Transactions**  
    **When** the User opens the Transactions list  
    **Then** the System shows a "Waiting to sync" section above the list  
     And each queued Transaction is marked "Waiting", "Sending" or "Failed" with its reason

  **Scenario: Fix and resend a failed Transaction**  
    **When** the User edits the failed Transaction and saves it  
    **Then** the Transaction becomes "Waiting" again  
     And it is booked at most once when sent

  **Scenario: Discard a queued Transaction**  
    **When** the User discards a queued Transaction and confirms  
    **Then** the System removes it from the queue  
     And a queued Transaction is never removed without such a User action

### US-05: Sign Out with Unsynced Transactions [Release 1] {#us-05-sign-out-with-unsynced-transactions-release-1}

*As a User*  
*I want to be warned before logging out while some Transactions are not synced*  
*so that I do not lose records by accident.*

  **Background**:  
    **Given** the User is logged in  
     And the User has 2 queued Transactions

  **Scenario: Warn before logging out**  
    **When** the User taps "Logout"  
    **Then** the System shows "2 Transactions are not synced yet"  
     And the System offers "Sync now", "Keep and log out", "Discard and log out" and "Cancel"

  **Scenario: Keep queued Transactions for the next login**  
    **When** the User chooses "Keep and log out"  
    **Then** the System logs the User out  
     And the queued Transactions stay on this device and are sent the next time this User logs in here

  **Scenario: Discard queued Transactions only after a second confirmation**  
    **When** the User chooses "Discard and log out"  
    **Then** the System asks for a second confirmation before discarding  
     And the System discards only this User's queued Transactions

# Feature-level Release (Overview) {#feature-level-release-overview}

The following table shows how the complete product scope defined in the SRS is delivered incrementally.

The MVP includes eight core features to ensure a usable and valuable first release, while additional features are introduced in later releases as the product evolves.

| No. | Feature | MVP | Release 1 | Release 2 | Note |
| :---: | ----- | :---: | :---: | :---: | ----- |
| 1 | **User Management** | ✔ | ✔ | ✔ | Core user identity and profile management |
| 2 | **System Security** | ✔ | ✔ | ✔ | Authentication, authorization, and data protection; Release 1 adds mobile account switching (device-unlock protected), log out of all devices, signed-in devices with per-device sign-out, change password, and app lock |
| 3 | **Wallet Management** | ✔ | ✔ | ✔ | Core financial structure |
| 4 | **Category Management** | ✔ | ✔ |  | Basic categorization is sufficient for early stages |
| 5 | **Budget Management** | ✔ | ✔ | ✔ | Essential for spending control and planning |
| 6 | **Transaction Management** | ✔ | ✔ | ✔ | Core financial activities |
| 7 | **Financial Reporting** | ✔ | ✔ | ✔ | Insights improve progressively over releases |
| 8 | **Financial Goal**  |  | ✔ | ✔ | Depends on stable budgeting and reporting |
| 9 | **Investment Management** |  |  | ✔ | Advanced feature for mature users |
| 10 | **Notification Handling** | ✔ | ✔ | ✔ | User feedback and engagement |
| 11 | **Data Overview Dashboard** |  | ✔ | ✔ | High-level financial insights |
| 12 | **AI Chat Assistant** |  | ✔ | ✔ | Conversational transaction entry/edit/query; depends on stable Transaction Management (F-06); all AI-proposed writes require explicit User confirmation; Release 1 adds recording from a photo (receipt, note, spreadsheet screenshot) |
| 13 | **AI Budget Setup Wizard** |  | ✔ | ✔ | Guided Budget setup via AI Chat; depends on Budget Management (F-05) and AI Chat Assistant (Feature-12); all AI-proposed Budgets require explicit User confirmation |
| 14 | **Offline Use** |  | ✔ | ✔ | Mobile only; supports NFR-06 Reliability — read last-known data and queue Transactions offline, synced automatically and never booked twice |

