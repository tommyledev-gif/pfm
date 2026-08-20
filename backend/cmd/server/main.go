package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/config"
	"github.com/example/pfm/backend/internal/handler"
	"github.com/example/pfm/backend/internal/repository"
	"github.com/example/pfm/backend/internal/repository/sqlc"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

func main() {
	logger, err := newLogger()
	if err != nil {
		panic(err)
	}
	defer logger.Sync() //nolint:errcheck // best-effort flush on shutdown

	cfg, err := config.Load()
	if err != nil {
		logger.Fatal("failed to load config", zap.Error(err))
	}

	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer pool.Close()

	queries := sqlc.New(pool)
	userRepo := repository.NewUserRepository(queries)
	revokedRepo := repository.NewRevokedTokenRepository(queries)
	walletRepo := repository.NewWalletRepository(queries, pool)
	categoryRepo := repository.NewCategoryRepository(queries, pool)
	budgetRepo := repository.NewBudgetRepository(queries, pool)
	transactionRepo := repository.NewTransactionRepository(queries, pool)
	reportRepo := repository.NewReportRepository(queries)
	notificationRepo := repository.NewNotificationRepository(queries)
	chatRepo := repository.NewChatRepository(queries)

	tokenService := service.NewTokenService(cfg.JWTSecret)
	emailSender := newEmailSender(cfg, logger)
	iconUploader := newIconUploader(cfg, logger)
	userService := service.NewUserService(userRepo, emailSender, logger)
	authService := service.NewAuthService(userRepo, revokedRepo, tokenService, logger)
	walletService := service.NewWalletService(walletRepo, logger)
	categoryService := service.NewCategoryService(categoryRepo, logger)
	budgetService := service.NewBudgetService(budgetRepo, logger)
	transactionService := service.NewTransactionService(transactionRepo, walletRepo, categoryRepo, logger)
	reportService := service.NewReportService(reportRepo, walletRepo, categoryRepo, logger)
	notificationService := service.NewNotificationService(notificationRepo, budgetRepo, logger)
	aiServiceClient := service.NewHTTPAIServiceClient(cfg.AIServiceURL)
	chatService := service.NewChatService(chatRepo, walletRepo, categoryRepo, aiServiceClient, logger)

	userHandler := handler.NewUserHandler(userService, logger)
	authHandler := handler.NewAuthHandler(authService, logger)
	walletHandler := handler.NewWalletHandler(walletService, logger)
	categoryHandler := handler.NewCategoryHandler(categoryService, iconUploader, logger)
	budgetHandler := handler.NewBudgetHandler(budgetService, logger)
	transactionHandler := handler.NewTransactionHandler(transactionService, logger)
	reportHandler := handler.NewReportHandler(reportService, logger)
	notificationHandler := handler.NewNotificationHandler(notificationService, logger)
	chatHandler := handler.NewChatHandler(chatService, logger)

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return response.Error(c, logger, err)
		},
	})
	app.Use(cors.New(cors.Config{
		AllowOrigins: cfg.CORSAllowedOrigins,
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PUT, PATCH, DELETE, OPTIONS",
	}))
	registerRoutes(app, userHandler, authHandler, walletHandler, categoryHandler, budgetHandler, transactionHandler, reportHandler, notificationHandler, chatHandler, tokenService, logger)

	go func() {
		if err := app.Listen(":" + cfg.Port); err != nil {
			logger.Fatal("server stopped unexpectedly", zap.Error(err))
		}
	}()
	logger.Info("server started", zap.String("port", cfg.Port))

	// F-10's budget-crossing evaluation job — the first periodic background
	// process in this codebase (specs/notification-handling/plan.md Finding
	// #2). schedulerCtx is cancelled in waitForShutdown so the ticker
	// goroutine never outlives the process on SIGTERM/SIGINT.
	schedulerCtx, stopScheduler := context.WithCancel(context.Background())
	go runNotificationScheduler(schedulerCtx, notificationService, logger)

	waitForShutdown(app, stopScheduler, logger)
}

// runNotificationScheduler runs NotificationService.EvaluateBudgets on a
// fixed interval until ctx is cancelled. A ticker, not a one-shot timer
// loop, so a slow evaluation never causes ticks to pile up.
func runNotificationScheduler(ctx context.Context, notificationService *service.NotificationService, logger *zap.Logger) {
	ticker := time.NewTicker(common.NotificationJobInterval)
	defer ticker.Stop()

	logger.Info("notification scheduler started", zap.Duration("interval", common.NotificationJobInterval))
	for {
		select {
		case <-ctx.Done():
			logger.Info("notification scheduler stopped")
			return
		case <-ticker.C:
			notificationService.EvaluateBudgets(ctx)
		}
	}
}

func waitForShutdown(app *fiber.App, stopScheduler context.CancelFunc, logger *zap.Logger) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server")
	stopScheduler()
	if err := app.ShutdownWithTimeout(common.ShutdownTimeout); err != nil {
		logger.Error("error during shutdown", zap.Error(err))
	}
}

func newLogger() (*zap.Logger, error) {
	if os.Getenv("APP_ENV") == "production" {
		return zap.NewProduction()
	}
	return zap.NewDevelopment()
}

// newEmailSender picks SMTP once SMTP_HOST is set, otherwise falls back to
// the log-only placeholder — SMTP delivery is not required to run the API
// locally (see config.Config.SMTPHost doc comment).
func newEmailSender(cfg *config.Config, logger *zap.Logger) service.EmailSender {
	if cfg.SMTPHost == "" {
		logger.Warn("SMTP_HOST not set — activation emails will only be logged, not sent")
		return service.NewLogEmailSender(logger)
	}
	logger.Info("SMTP email sender configured", zap.String("host", cfg.SMTPHost), zap.String("port", cfg.SMTPPort))
	return service.NewSMTPEmailSender(service.SMTPConfig{
		Host:       cfg.SMTPHost,
		Port:       cfg.SMTPPort,
		Username:   cfg.SMTPUsername,
		Password:   cfg.SMTPPassword,
		FromEmail:  cfg.SMTPFromEmail,
		FromName:   cfg.SMTPFromName,
		AppBaseURL: cfg.AppBaseURL,
	})
}

// newIconUploader picks R2 once R2_ACCOUNT_ID is set, otherwise falls back
// to a placeholder that fails only the individual upload request — same
// "don't fail startup" convention as newEmailSender.
func newIconUploader(cfg *config.Config, logger *zap.Logger) service.IconUploader {
	if cfg.R2AccountID == "" {
		logger.Warn("R2_ACCOUNT_ID not set — category icon uploads will fail with 503 ICON_UPLOAD_UNAVAILABLE")
		return service.UnconfiguredIconUploader{}
	}
	uploader, err := service.NewR2IconUploader(service.R2Config{
		AccountID:       cfg.R2AccountID,
		AccessKeyID:     cfg.R2AccessKeyID,
		SecretAccessKey: cfg.R2SecretAccessKey,
		Bucket:          cfg.R2Bucket,
		PublicBaseURL:   cfg.R2PublicBaseURL,
	})
	if err != nil {
		logger.Error("failed to configure R2 icon uploader — falling back to disabled uploads", zap.Error(err))
		return service.UnconfiguredIconUploader{}
	}
	logger.Info("R2 icon uploader configured", zap.String("bucket", cfg.R2Bucket))
	return uploader
}
