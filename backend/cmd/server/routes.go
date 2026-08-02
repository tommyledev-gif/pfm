package main

import (
	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/handler"
	"github.com/example/pfm/backend/internal/middleware"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/service"
)

// registerRoutes wires every F-01/F-02 endpoint under CLAUDE.md's API base
// (/api/v1). Auth/rate-limit middleware ordering matters: JWTAuth must run
// before RequireRole (role comes from the token) and before
// InviteRateLimiter (keyed by the caller's user ID from that same token).
func registerRoutes(app *fiber.App, userHandler *handler.UserHandler, authHandler *handler.AuthHandler, walletHandler *handler.WalletHandler, categoryHandler *handler.CategoryHandler, budgetHandler *handler.BudgetHandler, tokens *service.TokenService, logger *zap.Logger) {
	v1 := app.Group("/api/v1")

	auth := v1.Group("/auth")
	auth.Post("/activate", authHandler.Activate)
	auth.Post("/login", middleware.LoginRateLimiter(logger), authHandler.Login)
	auth.Post("/logout", authHandler.Logout)

	admin := v1.Group("/admin", middleware.JWTAuth(tokens, logger), middleware.RequireRole(string(model.UserRoleAdmin), logger))
	admin.Post("/users/invite", middleware.InviteRateLimiter(logger), userHandler.InviteUser)
	admin.Get("/users", userHandler.ListUsers)

	// F-03 Wallet Management — no RequireRole gate: every active user manages
	// only their own wallets (plan.md Security & Actor Resolution).
	wallets := v1.Group("/wallets", middleware.JWTAuth(tokens, logger))
	wallets.Post("/", walletHandler.CreateWallet)
	wallets.Get("/", walletHandler.ListWallets)
	wallets.Get("/:id", walletHandler.GetWallet)
	wallets.Patch("/:id", walletHandler.UpdateWallet)
	wallets.Post("/:id/set-default", walletHandler.SetDefaultWallet)

	// F-04 Category Management — no RequireRole gate: every active user
	// manages only their own categories and reads system ones identically
	// (plan.md Security & Actor Resolution).
	categories := v1.Group("/categories", middleware.JWTAuth(tokens, logger))
	categories.Post("/", categoryHandler.CreateCategory)
	categories.Get("/", categoryHandler.ListCategories)
	categories.Get("/:id", categoryHandler.GetCategory)
	categories.Patch("/:id", categoryHandler.UpdateCategory)
	categories.Delete("/:id", categoryHandler.DeleteCategory)

	// F-05 Budget Management — no RequireRole gate: every active user
	// manages only their own budgets (plan.md Security & Actor Resolution).
	budgets := v1.Group("/budgets", middleware.JWTAuth(tokens, logger))
	budgets.Post("/", budgetHandler.CreateBudget)
	budgets.Get("/", budgetHandler.ListBudgets)
	budgets.Get("/:id", budgetHandler.GetBudget)
	budgets.Patch("/:id", budgetHandler.UpdateBudget)
	budgets.Delete("/:id", budgetHandler.DeleteBudget)
}
