package main

import (
	"context"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/handler"
	"github.com/example/pfm/backend/internal/middleware"
	"github.com/example/pfm/backend/internal/model"
)

// The health probes. Named here and passed to the request logger in main.go,
// which leaves their successful calls (Docker polls every few seconds) out of
// the log.
const (
	healthPath      = "/api/v1/health"
	healthReadyPath = healthPath + "/ready"
)

// dbPinger is the part of *pgxpool.Pool the readiness probe uses.
type dbPinger interface {
	Ping(ctx context.Context) error
}

// registerRoutes mounts every endpoint, most under CLAUDE.md's API base
// (/api/v1). Auth/rate-limit middleware ordering matters: JWTAuth must run
// before RequireRole (it loads the caller's role) and before every per-user
// limiter (keyed by the caller's user ID it sets). Fiber matches routes in the
// order they are registered, so a literal path ("/invitations") must come
// before a parameter one ("/:id") in the same group.
func registerRoutes(app *fiber.App, h routeHandlers) {
	// One instance for every protected route: validates the access token and
	// its session (see middleware.JWTAuth).
	jwtAuth := middleware.JWTAuth(h.tokens, h.sessions, h.logger)
	// ONE limiter shared by every upload route: each call to UploadRateLimiter
	// builds its own counter, so one per route would multiply the per-user cap
	// by the number of routes.
	uploadLimit := middleware.UploadRateLimiter(h.logger)

	// Serves the invite-activation form at the backend's own domain — see
	// handler.ActivatePageHandler doc comment for why this lives here instead
	// of on the (currently undeployed) frontend/ Next.js app.
	app.Get("/activate", handler.ActivatePageHandler)
	// The admin's "Xem và duyệt" email link (access requests, mig 031).
	app.Get("/approve-access", handler.ApproveAccessPageHandler)
	// Android reads this before it lets the app use passkeys for this domain.
	app.Get("/.well-known/assetlinks.json", h.assetLinks)

	v1 := app.Group("/api/v1")

	// Deploy-verification probe (CI/CD health check after a VPS deploy) — no
	// auth, no DB call, just proves the process is up and serving.
	app.Get(healthPath, func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})
	// Readiness: the same, plus a database ping. The deploy gate uses this one,
	// so a release that comes up but cannot reach Postgres (a wrong password
	// in the env file, a failed migration left behind) is rolled back instead
	// of answering /health while every real request fails. Container liveness
	// stays on /health: a database blip must not restart the API.
	app.Get(healthReadyPath, func(c *fiber.Ctx) error {
		ctx, cancel := context.WithTimeout(c.Context(), common.HealthDBPingTimeout)
		defer cancel()
		if err := h.db.Ping(ctx); err != nil {
			h.logger.Error("readiness: database ping failed", zap.Error(err))
			return c.Status(fiber.StatusServiceUnavailable).JSON(fiber.Map{"status": "database unavailable"})
		}
		return c.JSON(fiber.Map{"status": "ok"})
	})

	// One generous per-IP counter shared by the unauthenticated routes whose
	// credential is a token (specs/security-hardening-2026-10 US-04): nothing
	// to guess there, but each call is a database round trip.
	publicTokenLimit := middleware.PublicTokenRateLimiter(h.logger)

	auth := v1.Group("/auth")
	auth.Post("/activate", publicTokenLimit, h.auth.Activate)
	auth.Post("/login", middleware.LoginRateLimiter(h.logger), middleware.LoginAccountRateLimiter(h.logger), h.auth.Login)
	auth.Post("/logout", publicTokenLimit, h.auth.Logout)
	// /auth/refresh is unauthenticated like /auth/logout: the refresh token
	// itself is the credential, so there is no password-guessing surface like
	// /auth/login has — only the shared per-IP load limit.
	auth.Post("/refresh", publicTokenLimit, h.auth.Refresh)
	// Account switching (specs/mobile-account-switch). Issuing needs a
	// session; switching and revoking do not (the switch token is the
	// credential). Only /switch is rate-limited (S-ASW-20).
	// Deprecated 2026-10-19: newer builds keep each saved account as its own
	// device-bound session and switch with /auth/refresh. Kept for older
	// builds, and for the one-time trade of their stored switch tokens.
	auth.Post("/switch-token", jwtAuth, h.accountSwitch.IssueSwitchToken)
	auth.Post("/switch-token/revoke", publicTokenLimit, h.accountSwitch.RevokeSwitchToken)
	auth.Post("/switch", middleware.SwitchRateLimiter(h.logger), h.accountSwitch.Switch)
	// Sign out everywhere, self (US-08) — the device gets a fresh pair.
	auth.Post("/sessions/revoke-all", jwtAuth, h.sessionRevocation.RevokeAllSelf)
	// The caller's signed-in devices, and signing one out (mig 033, US-10).
	// Registered after /sessions/revoke-all so ":id" never shadows it.
	auth.Get("/sessions", jwtAuth, h.deviceSessions.List)
	auth.Delete("/sessions/:id", jwtAuth, h.deviceSessions.SignOut)
	// Access requests (mig 031): asked for from the login screen, approved
	// from the admin's email link, and checked on by the requester's device
	// before it lets them sign in. All unauthenticated, all IP-limited.
	auth.Post("/access-requests", middleware.AccessRequestRateLimiter(h.logger), h.accessRequest.RequestAccess)
	auth.Post("/access-requests/status", middleware.AccessStatusRateLimiter(h.logger), h.accessRequest.Status)
	auth.Post("/access-requests/approve", middleware.AccessApproveRateLimiter(h.logger), h.accessRequest.ApproveByToken)
	// Passkey sign-in (mig 032): the assertion is the credential, so no
	// session — rate-limited per IP like /auth/login, one shared counter.
	passkeyLoginLimit := middleware.LoginRateLimiter(h.logger)
	auth.Post("/passkeys/login/begin", passkeyLoginLimit, h.passkey.BeginLogin)
	auth.Post("/passkeys/login/finish", passkeyLoginLimit, h.passkey.FinishLogin)

	admin := v1.Group("/admin", jwtAuth, middleware.RequireRole(string(model.UserRoleAdmin), h.logger))
	admin.Post("/users/invite", middleware.InviteRateLimiter(h.logger), h.user.InviteUser)
	admin.Get("/users", h.user.ListUsers)
	// No InviteRateLimiter here: the per-user cooldown in
	// UserService.ResendInvite already bounds how often any one inbox can be
	// emailed, which is what that limiter exists to protect.
	admin.Post("/users/:id/resend-invite", h.user.ResendInvite)
	// Sign out everywhere for another user (account-switch US-09); the
	// self-target refusal lives in the service.
	admin.Post("/users/:id/sessions/revoke-all", h.sessionRevocation.RevokeAllForUser)
	// Approve or reject an access request from the app (Thành viên / Thông báo).
	admin.Post("/users/:id/approve", h.accessRequest.Approve)
	admin.Post("/users/:id/reject", h.accessRequest.Reject)
	// Account deletion tool (mobile Thành viên screen, super admins). The service
	// lets through a super admin or ACCOUNT_DELETION_OPERATOR_EMAIL (AccountDeletionPolicy),
	// on top of the group's role gate.
	admin.Get("/users/search", h.accountDeletion.SearchUsers)
	admin.Delete("/users/:id", h.accountDeletion.DeleteUser)

	// The signed-in user's own profile. No RequireRole gate and no :id in the
	// path: the user is always the caller, taken from the verified token.
	users := v1.Group("/users", jwtAuth)
	users.Get("/me", h.profile.GetMe)
	users.Patch("/me", h.profile.UpdateMe)
	// Accounts activated before tên đăng nhập existed (mig 030) set one, once.
	users.Put("/me/username", h.profile.ClaimUsername)
	users.Post("/me/avatar", uploadLimit, h.profile.UploadAvatar)
	users.Delete("/me/avatar", h.profile.DeleteAvatar)
	// The caller's own passkeys (mig 032).
	users.Get("/me/passkeys", h.passkey.List)
	users.Post("/me/passkeys/register/begin", h.passkey.BeginRegistration)
	users.Post("/me/passkeys/register/finish", h.passkey.FinishRegistration)
	users.Delete("/me/passkeys/:id", h.passkey.Delete)
	// Change password (US-11): ends every session, this device gets a fresh
	// pair. Failed attempts are capped per user.
	users.Put("/me/password", middleware.PasswordChangeRateLimiter(h.logger), h.sessionRevocation.ChangePassword)

	// F-03 Wallet Management — no RequireRole gate: every active user manages
	// only their own wallets (plan.md Security & Actor Resolution).
	wallets := v1.Group("/wallets", jwtAuth)
	// A standalone upload step, not nested under "/:id" — a client picks an
	// image before a wallet exists yet (the create form), same convention as
	// categories.Post("/icon") (specs/wallet-budget-icons/spec.md US-01).
	wallets.Post("/icon", uploadLimit, h.wallet.UploadIcon)
	wallets.Post("/", h.wallet.CreateWallet)
	wallets.Get("/", h.wallet.ListWallets)
	// Shared wallets (specs/shared-wallets). The literal path goes before
	// "/:id", or "invitations" would be parsed as a wallet id.
	wallets.Get("/invitations", h.walletMember.ListInvitations)
	wallets.Get("/:id", h.wallet.GetWallet)
	wallets.Patch("/:id", h.wallet.UpdateWallet)
	wallets.Post("/:id/set-default", h.wallet.SetDefaultWallet)
	wallets.Get("/:id/members", h.walletMember.ListMembers)
	wallets.Get("/:id/members/lookup", middleware.MemberLookupRateLimiter(h.logger), h.walletMember.LookupInvitee)
	// Rate-limited per owner: an invitation to an address with no account
	// creates that account and sends it an email.
	wallets.Post("/:id/members", middleware.WalletInviteRateLimiter(h.logger), h.walletMember.Invite)
	wallets.Patch("/:id/members/:user_id", h.walletMember.UpdateRole)
	wallets.Delete("/:id/members/:user_id", h.walletMember.Remove)
	wallets.Post("/:id/invitation/accept", h.walletMember.AcceptInvitation)
	wallets.Post("/:id/invitation/decline", h.walletMember.DeclineInvitation)

	// F-04 Category Management — no RequireRole gate: every active user
	// manages only their own categories and reads system ones identically
	// (plan.md Security & Actor Resolution).
	categories := v1.Group("/categories", jwtAuth)
	// A standalone upload step, not nested under "/:id" — a client picks an
	// image before a category exists yet (the create form).
	categories.Post("/icon", uploadLimit, h.category.UploadIcon)
	categories.Post("/", h.category.CreateCategory)
	categories.Get("/", h.category.ListCategories)
	categories.Get("/:id", h.category.GetCategory)
	categories.Patch("/:id", h.category.UpdateCategory)
	categories.Delete("/:id", h.category.DeleteCategory)

	// F-05 Budget Management — no RequireRole gate: every active user
	// manages only their own budgets (plan.md Security & Actor Resolution).
	budgets := v1.Group("/budgets", jwtAuth)
	// A standalone upload step, not nested under "/:id" — a client picks an
	// image before a budget exists yet (the create form), same convention as
	// categories.Post("/icon") (specs/wallet-budget-icons/spec.md US-03).
	budgets.Post("/icon", uploadLimit, h.budget.UploadIcon)
	// F-13 AI Budget Setup Wizard's bulk-create (specs/ai-budget-wizard/spec.md
	// US-05) — joins the existing budgets group, JWTAuth only, same as every
	// other /budgets/* endpoint (plan.md Finding #4).
	budgets.Post("/bulk", h.budget.BulkCreateBudgets)
	budgets.Post("/", h.budget.CreateBudget)
	budgets.Get("/", h.budget.ListBudgets)
	budgets.Get("/:id", h.budget.GetBudget)
	budgets.Patch("/:id", h.budget.UpdateBudget)
	budgets.Delete("/:id", h.budget.DeleteBudget)

	// F-06 Transaction Management — no RequireRole gate: every active user
	// manages only their own transactions (plan.md Security & Actor
	// Resolution).
	transactions := v1.Group("/transactions", jwtAuth)
	transactions.Post("/", h.transaction.CreateTransaction)
	transactions.Get("/", h.transaction.ListTransactions)
	// ⚠️ Registered BEFORE GET /:id on purpose (specs/transaction-audit-log/
	// plan.md Finding #8) — Fiber matches in registration order, so with
	// /:id first this literal path would bind :id="audit-logs" and 400 on the
	// UUID parse instead of ever reaching the audit-log handler.
	transactions.Get("/audit-logs", h.auditLog.ListAuditLogs)
	// Same registration-order rule as /audit-logs above
	// (specs/transaction-export-import/plan.md Finding #8): every literal-path
	// GET under /transactions must precede GET /:id, or Fiber binds
	// :id="export" and 400s on the UUID parse. The two POST /import/* routes
	// below have no such conflict — there is no POST /:id in this group.
	transactions.Get("/export", h.transactionExport.ExportTransactions)
	transactions.Post("/import/preview", h.transactionImport.Preview)
	transactions.Post("/import/commit", h.transactionImport.Commit)
	// Image readings live outside the /ai group so they never spend
	// AIChatRateLimiter's budget (specs/ai-chat-image-capture plan F3). The
	// switch runs before the limiter: a refused request never counts (BR-18).
	transactions.Post("/image-proposals", h.chatImage.Switch, middleware.AIImageRateLimiter(h.logger), h.chatImage.ProposeFromImage)
	transactions.Get("/:id", h.transaction.GetTransaction)
	transactions.Patch("/:id", h.transaction.UpdateTransaction)
	transactions.Delete("/:id", h.transaction.DeleteTransaction)

	// F-07 Financial Reporting — no RequireRole gate: every active user views
	// only their own report (plan.md Security & Actor Resolution). One
	// endpoint covers spec.md US-01 through US-05 (Context decision #1).
	reports := v1.Group("/reports", jwtAuth)
	reports.Get("/summary", h.report.GetSummary)

	// F-10 Notification Handling — no RequireRole gate: every active user
	// sees only their own notifications (plan.md Security & Actor
	// Resolution). Notification creation has no HTTP endpoint at all — it is
	// produced by a background job (main.go's ticker), never a client request.
	notifications := v1.Group("/notifications", jwtAuth)
	notifications.Get("/", h.notification.ListNotifications)
	// Batch and read-all: one segment each, so they never meet /:id/read.
	notifications.Post("/read", h.notification.MarkNotificationsRead)
	notifications.Post("/read-all", h.notification.MarkAllNotificationsRead)
	notifications.Get("/:id", h.notification.GetNotification)
	notifications.Post("/:id/read", h.notification.MarkNotificationRead)

	// Feature-12 AI Chat Assistant (US-01 only) — no RequireRole gate: every
	// active user chats only with their own context (plan.md Security &
	// Actor Resolution). The confirm step reuses POST /transactions above —
	// no separate route.
	//
	// Limiters are per route, not on the group (specs/security-hardening-
	// 2026-10 F-17): group middleware covers every path under /ai, so the
	// thread sync that follows each message also spent the 30-per-hour model
	// budget, and about 15 messages locked a user out of chat. aiModelLimit
	// is ONE instance shared by the two routes that call the AI Service;
	// aiLocalLimit is a looser cap for the /ai routes that never do. Both run
	// after JWTAuth, which sets the user id they are keyed by.
	aiModelLimit := middleware.AIChatRateLimiter(h.logger)
	aiLocalLimit := middleware.AILocalRateLimiter(h.logger)
	ai := v1.Group("/ai", jwtAuth)
	ai.Post("/chat", aiModelLimit, h.chat.Chat)
	// Client-rendered chat thread cache (mobile chat-store.ts) — restores the
	// full chat UI (action cards, confirmed state, edit history) after local
	// AsyncStorage is cleared (logout, reinstall, new device). Neither
	// endpoint calls the AI Service.
	ai.Get("/chat/thread", aiLocalLimit, h.chat.GetThread)
	ai.Post("/chat/thread/sync", aiLocalLimit, h.chat.SyncThread)

	// F-13 AI Budget Setup Wizard (specs/ai-budget-wizard/plan.md Finding #4).
	// Prefill/Proposals never call the AI Service; only SuggestCategoryName
	// does (Finding #6/#11), so only it spends the model budget.
	ai.Get("/budget-wizard/prefill", aiLocalLimit, h.budgetWizard.Prefill)
	ai.Post("/budget-proposals", aiLocalLimit, h.budgetWizard.Proposals)
	ai.Post("/suggest-category-name", aiModelLimit, h.budgetWizard.SuggestCategoryName)

	// Feature-12 US-03 Query Spending via Chat (specs/ai-chat-query-spending/
	// plan.md F3). Deliberately NOT under /ai: Fiber group middleware applies
	// to every path under its prefix, so any /ai/* route would consume
	// AIChatRateLimiter's transaction-recording budget (spec.md S-AIQ-37).
	// /query (chips, follow-ups) has no limiter at all (S-AIQ-35); only free
	// text is limited, by its own per-route limiter. No CSRF token: both are
	// Bearer-JWT APIs with no cookie session, so there is no ambient credential.
	analytics := v1.Group("/analytics", jwtAuth)
	analytics.Post("/query", h.analytics.Query)
	analytics.Post("/consult", middleware.AIConsultRateLimiter(h.logger), h.analytics.Consult)

	// Feature-12 US-06 spending intentions (specs/ai-chat-spending-intentions):
	// no RequireRole gate (every active user keeps only their own) and no model
	// call, so no AI limiter. Outside /ai for the same reason /analytics is.
	intentions := v1.Group("/spending-intentions", jwtAuth)
	intentions.Get("/", h.spendingIntention.List)
	intentions.Post("/", h.spendingIntention.Create)
	intentions.Put("/:id", h.spendingIntention.Update)
	intentions.Delete("/:id", h.spendingIntention.Delete)

	// OTA updates and password reset, each in its own file (300-line cap).
	registerAppUpdateRoutes(app, h.appUpdate, h.appUpdatesDir)
	registerPasswordResetRoutes(app, h.passwordReset, h.logger)
}
