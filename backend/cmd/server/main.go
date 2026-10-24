package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/config"
	"github.com/example/pfm/backend/internal/handler"
	"github.com/example/pfm/backend/internal/middleware"
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

	pool, err := newPool(context.Background(), cfg)
	if err != nil {
		logger.Fatal("failed to connect to database", zap.Error(err))
	}
	defer pool.Close()

	queries := sqlc.New(pool)
	userRepo := repository.NewUserRepository(queries)
	revokedRepo := repository.NewRevokedTokenRepository(queries)
	sessionRepo := repository.NewSessionRepository(queries, pool)
	walletRepo := repository.NewWalletRepository(queries, pool)
	categoryRepo := repository.NewCategoryRepository(queries, pool)
	budgetRepo := repository.NewBudgetRepository(queries, pool)
	transactionRepo := repository.NewTransactionRepository(queries, pool)
	auditLogRepo := repository.NewAuditLogRepository(queries)
	reportRepo := repository.NewReportRepository(queries)
	notificationRepo := repository.NewNotificationRepository(queries)
	chatRepo := repository.NewChatRepository(queries)
	chatThreadRepo := repository.NewChatThreadRepository(queries, pool)
	budgetPlanRepo := repository.NewBudgetPlanRepository(queries)
	analyticsRepo := repository.NewAnalyticsRepository(queries)
	intentLogRepo := repository.NewIntentParseLogRepository(queries)
	passkeyRepo := repository.NewPasskeyRepository(queries)

	tokenService := service.NewTokenService(cfg.JWTSecret)
	emailSender := newEmailSender(cfg, logger)
	iconUploader := newIconUploader(cfg, logger)
	// One resolver shared by every spend figure (budgets, notifications,
	// reports' default window) so no two screens disagree on "this cycle".
	cycleResolver := service.NewCycleResolver(budgetPlanRepo)
	userService := service.NewUserService(userRepo, emailSender, logger)
	sessionService := service.NewSessionService(sessionRepo, tokenService, logger)
	authService := service.NewAuthService(userRepo, revokedRepo, tokenService, sessionService, logger)
	accountSwitchService := service.NewAccountSwitchService(userRepo, revokedRepo, tokenService, sessionService, logger)
	sessionRevocationService := service.NewSessionRevocationService(userRepo, accountSwitchService, sessionService, logger)
	passwordResetRepo := repository.NewPasswordResetRepository(queries, pool)
	passwordResetService := service.NewPasswordResetService(userRepo, passwordResetRepo, cfg.JWTSecret, emailSender, sessionService, logger)
	tokenRetention := service.NewTokenRetention(sessionRepo, revokedRepo, logger).WithResetCodes(passwordResetRepo)
	openLegacyRefreshWindow(context.Background(), queries, authService, logger)
	enableUnboundSessionCleanup(context.Background(), queries, sessionService, logger)
	walletService := service.NewWalletService(walletRepo, logger)
	walletMemberService := service.NewWalletMemberService(walletRepo, walletRepo, userRepo, logger)
	categoryService := service.NewCategoryService(categoryRepo, logger)
	budgetService := service.NewBudgetService(budgetRepo, cycleResolver, logger)
	transactionService := service.NewTransactionService(transactionRepo, walletRepo, categoryRepo, logger)
	auditLogService := service.NewAuditLogService(auditLogRepo, transactionRepo, logger)
	transactionExportService := service.NewTransactionExportService(transactionRepo, walletRepo, logger)
	// Takes transactionService itself, not a repo: every imported row is
	// written through its CreateTransaction (specs/transaction-export-import/
	// spec.md Context #4), never by a second insert path.
	transactionImportService := service.NewTransactionImportService(transactionService, transactionRepo, walletRepo, categoryRepo, tokenService, logger)
	reportService := service.NewReportService(reportRepo, walletRepo, categoryRepo, cycleResolver, logger)
	notificationService := service.NewNotificationService(notificationRepo, budgetRepo, cycleResolver, logger)
	aiEndpoint := service.AIServiceEndpoint{BaseURL: cfg.AIServiceURL, Token: cfg.AIServiceToken}
	if cfg.AIServiceToken == "" {
		logger.Warn("AI_SERVICE_TOKEN not set — AI Service calls carry no credential (docs/ops-runbook.md §9)")
	}
	aiServiceClient := service.NewHTTPAIServiceClient(aiEndpoint)
	chatService := service.NewChatService(chatRepo, walletRepo, categoryRepo, aiServiceClient, logger)
	chatImageService := service.NewChatImageService(walletRepo, categoryRepo, transactionRepo, service.NewHTTPAIImageClient(aiEndpoint), logger)
	chatThreadService := service.NewChatThreadService(chatThreadRepo)
	aiBudgetClient := service.NewHTTPAIBudgetClient(aiEndpoint)
	budgetWizardService := service.NewBudgetWizardService(budgetRepo, categoryRepo, walletRepo, aiBudgetClient, logger)
	// Feature-12 US-03 (specs/ai-chat-query-spending/): figures reuse the
	// report queries and BudgetService itself; free text gets its own
	// interpreter client, token guard and log.
	analyticsService := service.NewAnalyticsService(reportRepo, analyticsRepo, walletRepo, categoryRepo, budgetService, cycleResolver, logger)
	consultTokens := service.NewConsultTokenBudget(common.ConsultTokenBudgetPerMinute, common.ConsultTokenBudgetWindow)
	aiConsultClient := service.NewHTTPAIConsultClient(aiEndpoint)
	consultService := service.NewConsultService(analyticsService, analyticsRepo, walletRepo, categoryRepo, aiConsultClient, consultTokens, intentLogRepo, cycleResolver, logger)
	intentLogRetention := service.NewIntentLogRetention(intentLogRepo, logger)
	passkeyService, err := service.NewPasskeyService(newPasskeyRelyingParty(cfg.Passkey, logger), passkeyRepo, userRepo, sessionService, logger)
	if err != nil {
		logger.Fatal("failed to configure passkeys", zap.Error(err))
	}

	userHandler := handler.NewUserHandler(userService, logger)
	authHandler := handler.NewAuthHandler(authService, logger)
	accountSwitchHandler := handler.NewAccountSwitchHandler(accountSwitchService, logger)
	sessionRevocationHandler := handler.NewSessionRevocationHandler(sessionRevocationService, logger)
	deletionPolicy := service.NewAccountDeletionPolicy(cfg.AccountDeletionOperatorEmail)
	profileHandler := handler.NewProfileHandler(service.NewProfileService(userRepo, iconUploader, logger).WithAccountDeletionPolicy(deletionPolicy), logger)
	accessRequestHandler := handler.NewAccessRequestHandler(service.NewAccessRequestService(userRepo, notificationRepo, emailSender, logger), logger)
	accountDeletionHandler := handler.NewAccountDeletionHandler(service.NewAccountDeletionService(userRepo, sessionService, deletionPolicy, logger), logger)
	walletHandler := handler.NewWalletHandler(walletService, iconUploader, logger)
	walletMemberHandler := handler.NewWalletMemberHandler(walletMemberService, logger)
	categoryHandler := handler.NewCategoryHandler(categoryService, iconUploader, logger)
	budgetHandler := handler.NewBudgetHandler(budgetService, iconUploader, logger)
	transactionHandler := handler.NewTransactionHandler(transactionService, logger)
	auditLogHandler := handler.NewAuditLogHandler(auditLogService, logger)
	transactionExportHandler := handler.NewTransactionExportHandler(transactionExportService, logger)
	transactionImportHandler := handler.NewTransactionImportHandler(transactionImportService, logger)
	reportHandler := handler.NewReportHandler(reportService, logger)
	notificationHandler := handler.NewNotificationHandler(notificationService, logger)
	chatHandler := handler.NewChatHandler(chatService, chatThreadService, logger)
	chatImageHandler := handler.NewChatImageHandler(chatImageService, cfg.AIImageEnabled, logger)
	budgetWizardHandler := handler.NewBudgetWizardHandler(budgetWizardService, logger)
	analyticsHandler := handler.NewAnalyticsHandler(analyticsService, consultService, logger)
	passkeyHandler := handler.NewPasskeyHandler(passkeyService, logger)
	assetLinks := handler.NewAssetLinksHandler(cfg.Passkey.AndroidPackage, cfg.Passkey.AndroidCertSHA256)

	app := fiber.New(fiber.Config{
		BodyLimit:    common.HTTPBodyLimitBytes,
		ReadTimeout:  common.HTTPReadTimeout,
		WriteTimeout: common.HTTPWriteTimeout,
		IdleTimeout:  common.HTTPIdleTimeout,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return response.Error(c, logger, err)
		},
	})
	// Order matters: the request logger is outermost so it sees (and logs) the
	// 500 that Recover makes of a panic; security headers go on every response,
	// errors and CORS preflights included.
	app.Use(middleware.RequestLogger(logger, healthPath, healthReadyPath))
	app.Use(middleware.Recover(logger))
	app.Use(middleware.SecurityHeaders())
	app.Use(cors.New(cors.Config{
		AllowOrigins:  cfg.CORSAllowedOrigins,
		AllowHeaders:  "Origin, Content-Type, Accept, Authorization, " + fiber.HeaderXRequestID + ", " + common.HeaderDeviceID + ", " + common.HeaderDeviceName,
		AllowMethods:  "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		ExposeHeaders: fiber.HeaderXRequestID,
	}))
	registerRoutes(app, userHandler, authHandler, walletHandler, walletMemberHandler, categoryHandler, budgetHandler, transactionHandler, transactionExportHandler, transactionImportHandler, auditLogHandler, reportHandler, notificationHandler, chatHandler, chatImageHandler, budgetWizardHandler, analyticsHandler, accountSwitchHandler, sessionRevocationHandler, profileHandler, accessRequestHandler, accountDeletionHandler, passkeyHandler, assetLinks, tokenService, sessionService, pool, logger)
	appUpdateHandler := handler.NewAppUpdateHandler(service.NewAppUpdateService(cfg.AppUpdatesDir), logger).WithPublicAPKURL(cfg.APKPublicURL)
	registerAppUpdateRoutes(app, appUpdateHandler, cfg.AppUpdatesDir)
	registerPasswordResetRoutes(app, handler.NewPasswordResetHandler(passwordResetService, logger), logger)

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
	go runIntentLogRetention(schedulerCtx, intentLogRetention, logger)
	go runTokenRetention(schedulerCtx, tokenRetention, logger)

	waitForShutdown(app, stopScheduler, logger)
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
