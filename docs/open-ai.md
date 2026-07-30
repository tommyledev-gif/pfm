openapi: "3.1.0"

info:
  title: PFM API
  version: "1.0.0"
  description: |
    Personal Finance Management — REST API

    Base URL: /api/v1
    Auth: Bearer JWT (access token)
    Money: all amount fields are integer cents (VND xu), never float
    Timestamps: ISO 8601 UTC

servers:
  - url: http://localhost:8080/api/v1
    description: Local development

tags:
  - name: Auth
    description: Login, logout, token refresh
  - name: Users
    description: User management (invite, activate, list)
  - name: Wallets
    description: Wallet CRUD
  - name: Categories
    description: Category CRUD
  - name: Budgets
    description: Budget CRUD
  - name: Transactions
    description: Transaction CRUD
  - name: Reports
    description: Financial reporting
  - name: Notifications
    description: Notification handling

# ─────────────────────────────────────────────
# SECURITY SCHEMES
# ─────────────────────────────────────────────
components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:

    # ── Common ──────────────────────────────
    Error:
      type: object
      required: [error_code, message]
      properties:
        error_code:
          type: string
          example: INVALID_INPUT
        message:
          type: string
          example: Email is required
        details:
          type: object
          description: Field-level validation errors
          additionalProperties:
            type: string

    Pagination:
      type: object
      properties:
        next_cursor:
          type: string
          nullable: true
          description: Cursor for next page; null if last page
        total:
          type: integer

    # ── Auth ────────────────────────────────
    LoginRequest:
      type: object
      required: [email, password]
      properties:
        email:
          type: string
          format: email
        password:
          type: string
          minLength: 8

    TokenPair:
      type: object
      required: [access_token, refresh_token, expires_in]
      properties:
        access_token:
          type: string
        refresh_token:
          type: string
        expires_in:
          type: integer
          description: Access token TTL in seconds (900 = 15 minutes)

    RefreshRequest:
      type: object
      required: [refresh_token]
      properties:
        refresh_token:
          type: string

    # ── Users ───────────────────────────────
    UserStatus:
      type: string
      enum: [pending, active, disabled]

    UserRole:
      type: string
      enum: [admin, member]

    User:
      type: object
      required: [id, email, status, role, created_at]
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        full_name:
          type: string
          nullable: true
        status:
          $ref: "#/components/schemas/UserStatus"
        role:
          $ref: "#/components/schemas/UserRole"
        invited_by_id:
          type: string
          format: uuid
          nullable: true
        activated_at:
          type: string
          format: date-time
          nullable: true
        created_at:
          type: string
          format: date-time

    InviteUserRequest:
      type: object
      required: [email]
      properties:
        email:
          type: string
          format: email
          example: homer@example.com
        role:
          $ref: "#/components/schemas/UserRole"
          default: member

    InviteUserResponse:
      type: object
      required: [user_id, email, status]
      properties:
        user_id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        status:
          type: string
          example: pending
        invite_expires_at:
          type: string
          format: date-time

    ActivateAccountRequest:
      type: object
      required: [token, password, confirm_password]
      properties:
        token:
          type: string
          description: Invite token received via email
        password:
          type: string
          minLength: 8
          example: P@ssw0rd123
        confirm_password:
          type: string
          minLength: 8
        full_name:
          type: string

    UserListResponse:
      type: object
      required: [data, pagination]
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/User"
        pagination:
          $ref: "#/components/schemas/Pagination"

    # ── Wallets ─────────────────────────────
    WalletType:
      type: string
      enum: [cash, bank, ewallet, other]

    Wallet:
      type: object
      required: [id, user_id, name, type, balance, currency, is_default, created_at]
      properties:
        id:
          type: string
          format: uuid
        user_id:
          type: string
          format: uuid
        name:
          type: string
        type:
          $ref: "#/components/schemas/WalletType"
        balance:
          type: integer
          description: Integer cents (e.g. 1000000 = 1,000,000 VND)
        currency:
          type: string
          default: VND
        is_default:
          type: boolean
        created_at:
          type: string
          format: date-time

    CreateWalletRequest:
      type: object
      required: [name, type, initial_balance]
      properties:
        name:
          type: string
          maxLength: 100
        type:
          $ref: "#/components/schemas/WalletType"
        initial_balance:
          type: integer
          minimum: 0
          description: Integer cents
        currency:
          type: string
          default: VND

    # ── Categories ──────────────────────────
    CategoryType:
      type: string
      enum: [income, expense, both]

    Category:
      type: object
      required: [id, name, type, is_system]
      properties:
        id:
          type: string
          format: uuid
        user_id:
          type: string
          format: uuid
          nullable: true
          description: null means system default category
        name:
          type: string
        icon:
          type: string
          nullable: true
        type:
          $ref: "#/components/schemas/CategoryType"
        is_system:
          type: boolean

    CreateCategoryRequest:
      type: object
      required: [name, type]
      properties:
        name:
          type: string
          maxLength: 100
        type:
          $ref: "#/components/schemas/CategoryType"
        icon:
          type: string

    # ── Budgets ─────────────────────────────
    BudgetPeriod:
      type: string
      enum: [monthly, weekly]

    Budget:
      type: object
      required: [id, category_id, amount_limit, period, start_date]
      properties:
        id:
          type: string
          format: uuid
        category_id:
          type: string
          format: uuid
        category_name:
          type: string
        amount_limit:
          type: integer
          description: Integer cents
        amount_spent:
          type: integer
          description: Current period spent (integer cents)
        period:
          $ref: "#/components/schemas/BudgetPeriod"
        start_date:
          type: string
          format: date

    CreateBudgetRequest:
      type: object
      required: [category_id, amount_limit, period, start_date]
      properties:
        category_id:
          type: string
          format: uuid
        amount_limit:
          type: integer
          minimum: 1
          description: Integer cents
        period:
          $ref: "#/components/schemas/BudgetPeriod"
        start_date:
          type: string
          format: date

    # ── Transactions ────────────────────────
    TransactionType:
      type: string
      enum: [income, expense]

    Transaction:
      type: object
      required: [id, wallet_id, category_id, amount, type, occurred_at, created_at]
      properties:
        id:
          type: string
          format: uuid
        wallet_id:
          type: string
          format: uuid
        wallet_name:
          type: string
        category_id:
          type: string
          format: uuid
        category_name:
          type: string
        amount:
          type: integer
          description: Integer cents
        type:
          $ref: "#/components/schemas/TransactionType"
        note:
          type: string
          nullable: true
        occurred_at:
          type: string
          format: date-time
        created_at:
          type: string
          format: date-time

    CreateTransactionRequest:
      type: object
      required: [wallet_id, category_id, amount, type, occurred_at]
      properties:
        wallet_id:
          type: string
          format: uuid
        category_id:
          type: string
          format: uuid
        amount:
          type: integer
          minimum: 1
          description: Integer cents
        type:
          $ref: "#/components/schemas/TransactionType"
        note:
          type: string
          maxLength: 500
        occurred_at:
          type: string
          format: date-time
        idempotency_key:
          type: string
          description: Client-generated UUID to prevent duplicate submission

    TransactionListResponse:
      type: object
      required: [data, pagination]
      properties:
        data:
          type: array
          items:
            $ref: "#/components/schemas/Transaction"
        pagination:
          $ref: "#/components/schemas/Pagination"

    # ── Reports ─────────────────────────────
    SummaryReport:
      type: object
      properties:
        period_start:
          type: string
          format: date
        period_end:
          type: string
          format: date
        total_income:
          type: integer
          description: Integer cents
        total_expense:
          type: integer
          description: Integer cents
        net:
          type: integer
          description: total_income - total_expense
        by_category:
          type: array
          items:
            type: object
            properties:
              category_id:
                type: string
                format: uuid
              category_name:
                type: string
              amount:
                type: integer
              percentage:
                type: number
                format: float

    # ── Notifications ───────────────────────
    Notification:
      type: object
      required: [id, type, title, is_read, created_at]
      properties:
        id:
          type: string
          format: uuid
        type:
          type: string
          enum: [budget_exceeded, goal_reached, system]
        title:
          type: string
        body:
          type: string
          nullable: true
        is_read:
          type: boolean
        created_at:
          type: string
          format: date-time

# ─────────────────────────────────────────────
# PATHS
# ─────────────────────────────────────────────

paths:

  # ══════════════════════════════════════════
  # AUTH
  # ══════════════════════════════════════════

  /auth/login:
    post:
      tags: [Auth]
      operationId: login
      summary: Login with email + password
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/LoginRequest"
      responses:
        "200":
          description: Login successful
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TokenPair"
        "400":
          description: Invalid input
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example:
                error_code: INVALID_INPUT
                message: Email is required
        "401":
          description: Invalid credentials
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example:
                error_code: INVALID_CREDENTIALS
                message: Email or password is incorrect
        "429":
          description: Rate limit exceeded
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /auth/refresh:
    post:
      tags: [Auth]
      operationId: refreshToken
      summary: Refresh access token
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/RefreshRequest"
      responses:
        "200":
          description: New token pair
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TokenPair"
        "401":
          description: Refresh token invalid or expired
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  /auth/logout:
    post:
      tags: [Auth]
      operationId: logout
      summary: Revoke refresh token
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/RefreshRequest"
      responses:
        "204":
          description: Logged out successfully
        "401":
          description: Unauthorized

  /auth/activate:
    post:
      tags: [Auth]
      operationId: activateAccount
      summary: Activate account using invite token and set password
      description: |
        Called when a user clicks the activation link from their invite email.
        Token must be valid and not expired (72h window).
        On success, returns a JWT pair so the user is immediately logged in.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ActivateAccountRequest"
      responses:
        "200":
          description: Account activated; user is now logged in
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/TokenPair"
                  - type: object
                    properties:
                      user:
                        $ref: "#/components/schemas/User"
        "400":
          description: Validation error (password mismatch, weak password)
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              examples:
                password_mismatch:
                  value:
                    error_code: PASSWORD_MISMATCH
                    message: Passwords do not match
                weak_password:
                  value:
                    error_code: WEAK_PASSWORD
                    message: Password must be at least 8 characters
        "410":
          description: Token expired or already used
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example:
                error_code: TOKEN_EXPIRED
                message: Invite token has expired or already been used
        "404":
          description: Token not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"

  # ══════════════════════════════════════════
  # USERS (Admin)
  # ══════════════════════════════════════════

  /admin/users/invite:
    post:
      tags: [Users]
      operationId: inviteUser
      summary: Invite a new user by email
      description: |
        Admin-only. Creates a user record with status=pending and sends an
        activation email containing a secure token (72h expiry).
        Rate limited: max 20 invites per hour per admin.
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/InviteUserRequest"
      responses:
        "201":
          description: Invite sent successfully
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/InviteUserResponse"
        "400":
          description: Invalid email format
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
        "401":
          description: Unauthorized
        "403":
          description: Caller is not an admin
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example:
                error_code: FORBIDDEN
                message: Admin role required
        "409":
          description: Email already registered
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example:
                error_code: EMAIL_ALREADY_EXISTS
                message: An account with this email already exists
        "429":
          description: Rate limit exceeded

  /admin/users:
    get:
      tags: [Users]
      operationId: listUsers
      summary: List all users
      description: |
        Admin-only. Returns paginated list of users.
        Supports filtering by status and role.
        Uses cursor-based pagination.
      security:
        - BearerAuth: []
      parameters:
        - name: status
          in: query
          schema:
            $ref: "#/components/schemas/UserStatus"
          description: Filter by user status
        - name: role
          in: query
          schema:
            $ref: "#/components/schemas/UserRole"
        - name: cursor
          in: query
          schema:
            type: string
          description: Pagination cursor from previous response
        - name: limit
          in: query
          schema:
            type: integer
            minimum: 1
            maximum: 100
            default: 20
      responses:
        "200":
          description: List of users
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UserListResponse"
        "401":
          description: Unauthorized
        "403":
          description: Admin role required

  /admin/users/{id}:
    get:
      tags: [Users]
      operationId: getUser
      summary: Get a single user by ID
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: User found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "401":
          description: Unauthorized
        "403":
          description: Admin role required
        "404":
          description: User not found

  /admin/users/{id}/disable:
    post:
      tags: [Users]
      operationId: disableUser
      summary: Disable a user account
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: User disabled
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "403":
          description: Admin role required
        "404":
          description: User not found
        "409":
          description: Cannot disable own account

  /users/me:
    get:
      tags: [Users]
      operationId: getMe
      summary: Get current authenticated user profile
      security:
        - BearerAuth: []
      responses:
        "200":
          description: Current user
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/User"
        "401":
          description: Unauthorized

  # ══════════════════════════════════════════
  # WALLETS
  # ══════════════════════════════════════════

  /wallets:
    post:
      tags: [Wallets]
      operationId: createWallet
      summary: Create a wallet
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateWalletRequest"
      responses:
        "201":
          description: Wallet created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Wallet"
        "400":
          description: Invalid input
        "401":
          description: Unauthorized

    get:
      tags: [Wallets]
      operationId: listWallets
      summary: List all wallets for current user
      security:
        - BearerAuth: []
      responses:
        "200":
          description: List of wallets
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/Wallet"
        "401":
          description: Unauthorized

  /wallets/{id}:
    get:
      tags: [Wallets]
      operationId: getWallet
      summary: Get a single wallet
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Wallet found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Wallet"
        "403":
          description: Access denied (not owner)
        "404":
          description: Not found

  # ══════════════════════════════════════════
  # CATEGORIES
  # ══════════════════════════════════════════

  /categories:
    get:
      tags: [Categories]
      operationId: listCategories
      summary: List categories (system + user-defined)
      security:
        - BearerAuth: []
      parameters:
        - name: type
          in: query
          schema:
            $ref: "#/components/schemas/CategoryType"
      responses:
        "200":
          description: List of categories
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/Category"

    post:
      tags: [Categories]
      operationId: createCategory
      summary: Create a custom category
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateCategoryRequest"
      responses:
        "201":
          description: Category created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Category"
        "400":
          description: Invalid input
        "409":
          description: Category name already exists for this user

  # ══════════════════════════════════════════
  # BUDGETS
  # ══════════════════════════════════════════

  /budgets:
    post:
      tags: [Budgets]
      operationId: createBudget
      summary: Create a budget for a category
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateBudgetRequest"
      responses:
        "201":
          description: Budget created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Budget"
        "400":
          description: Invalid input
        "409":
          description: Budget already exists for this category+period

    get:
      tags: [Budgets]
      operationId: listBudgets
      summary: List budgets for current user
      security:
        - BearerAuth: []
      parameters:
        - name: period
          in: query
          schema:
            $ref: "#/components/schemas/BudgetPeriod"
      responses:
        "200":
          description: List of budgets with current spending
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/Budget"

  # ══════════════════════════════════════════
  # TRANSACTIONS
  # ══════════════════════════════════════════

  /transactions:
    post:
      tags: [Transactions]
      operationId: createTransaction
      summary: Create a transaction
      description: |
        Creates income or expense transaction and atomically updates wallet balance.
        Expense: balance must be >= amount (MVP rule).
        Triggers budget check async notification if limit exceeded.
      security:
        - BearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateTransactionRequest"
      responses:
        "201":
          description: Transaction created
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Transaction"
        "400":
          description: Invalid input
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              examples:
                invalid_amount:
                  value:
                    error_code: INVALID_INPUT
                    message: Amount must be greater than 0
        "402":
          description: Insufficient balance
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example:
                error_code: INSUFFICIENT_BALANCE
                message: Wallet balance is insufficient for this expense
        "403":
          description: Wallet not owned by caller
        "404":
          description: Wallet or category not found

    get:
      tags: [Transactions]
      operationId: listTransactions
      summary: List transactions with filters
      security:
        - BearerAuth: []
      parameters:
        - name: wallet_id
          in: query
          schema:
            type: string
            format: uuid
        - name: category_id
          in: query
          schema:
            type: string
            format: uuid
        - name: type
          in: query
          schema:
            $ref: "#/components/schemas/TransactionType"
        - name: from
          in: query
          schema:
            type: string
            format: date
          description: Filter occurred_at >= from (UTC date)
        - name: to
          in: query
          schema:
            type: string
            format: date
          description: Filter occurred_at <= to (UTC date)
        - name: cursor
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
            maximum: 100
      responses:
        "200":
          description: Paginated transaction list
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/TransactionListResponse"

  /transactions/{id}:
    get:
      tags: [Transactions]
      operationId: getTransaction
      summary: Get a single transaction
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Transaction found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Transaction"
        "403":
          description: Access denied
        "404":
          description: Not found

  # ══════════════════════════════════════════
  # REPORTS
  # ══════════════════════════════════════════

  /reports/summary:
    get:
      tags: [Reports]
      operationId: getSummaryReport
      summary: Get income/expense summary for a period
      security:
        - BearerAuth: []
      parameters:
        - name: from
          in: query
          required: true
          schema:
            type: string
            format: date
        - name: to
          in: query
          required: true
          schema:
            type: string
            format: date
        - name: wallet_id
          in: query
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Summary report
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/SummaryReport"
        "400":
          description: Invalid date range

  # ══════════════════════════════════════════
  # NOTIFICATIONS
  # ══════════════════════════════════════════

  /notifications:
    get:
      tags: [Notifications]
      operationId: listNotifications
      summary: List notifications for current user
      security:
        - BearerAuth: []
      parameters:
        - name: is_read
          in: query
          schema:
            type: boolean
        - name: cursor
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        "200":
          description: List of notifications
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: array
                    items:
                      $ref: "#/components/schemas/Notification"
                  pagination:
                    $ref: "#/components/schemas/Pagination"

  /notifications/{id}/read:
    post:
      tags: [Notifications]
      operationId: markNotificationRead
      summary: Mark a notification as read
      security:
        - BearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "204":
          description: Marked as read
        "404":
          description: Not found