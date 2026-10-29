package main

import (
	"context"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/config"
	"github.com/example/pfm/backend/internal/handler"
	"github.com/example/pfm/backend/internal/repository"
	"github.com/example/pfm/backend/internal/repository/sqlc"
	"github.com/example/pfm/backend/internal/service"
)

// routeHandlers is everything registerRoutes needs: one handler per feature,
// plus the few services the auth middleware and health probe call directly.
// wire fills it in; registerRoutes only reads it.
type routeHandlers struct {
	logger *zap.Logger

	// Called by middleware.JWTAuth on every protected request, and by the
	// readiness probe.
	tokens   *service.TokenService
	sessions *service.SessionService
	db       dbPinger

	// Sign-in, sessions and the signed-in user's own account.
	auth              *handler.AuthHandler
	accountSwitch     *handler.AccountSwitchHandler
	sessionRevocation *handler.SessionRevocationHandler
	deviceSessions    *handler.DeviceSessionHandler
	passkey           *handler.PasskeyHandler
	passwordReset     *handler.PasswordResetHandler
	accessRequest     *handler.AccessRequestHandler
	profile           *handler.ProfileHandler

	// Admin tools.
	user            *handler.UserHandler
	accountDeletion *handler.AccountDeletionHandler

	// Money features.
	wallet            *handler.WalletHandler
	walletMember      *handler.WalletMemberHandler
	category          *handler.CategoryHandler
	budget            *handler.BudgetHandler
	transaction       *handler.TransactionHandler
	transactionExport *handler.TransactionExportHandler
	transactionImport *handler.TransactionImportHandler
	auditLog          *handler.AuditLogHandler
	report            *handler.ReportHandler
	notification      *handler.NotificationHandler

	// AI features.
	chat         *handler.ChatHandler
	chatImage    *handler.ChatImageHandler
	budgetWizard *handler.BudgetWizardHandler
	analytics    *handler.AnalyticsHandler

	// Served outside the JSON API: Android's passkey file and mobile updates.
	assetLinks    fiber.Handler
	appUpdate     *handler.AppUpdateHandler
	appUpdatesDir string
}

// wire builds the API from the bottom up: repositories (SQL) → services
// (business rules) → handlers (HTTP). Each layer is handed only the layer
// below it, which is what keeps a handler from reaching the database itself.
// It also returns the background jobs, which are services run on a timer.
func wire(cfg *config.Config, pool *pgxpool.Pool, logger *zap.Logger) (routeHandlers, []backgroundJob, error) {
	ctx := context.Background()

	// ---- Repositories: data access only, all sharing one connection pool.
	queries := sqlc.New(pool)
	userRepo := repository.NewUserRepository(queries)
	revokedRepo := repository.NewRevokedTokenRepository(queries)
	sessionRepo := repository.NewSessionRepository(queries, pool)
	passwordResetRepo := repository.NewPasswordResetRepository(queries, pool)
	passkeyRepo := repository.NewPasskeyRepository(queries)
	walletRepo := repository.NewWalletRepository(queries, pool)
	categoryRepo := repository.NewCategoryRepository(queries, pool)
	budgetRepo := repository.NewBudgetRepository(queries, pool)
	budgetPlanRepo := repository.NewBudgetPlanRepository(queries)
	transactionRepo := repository.NewTransactionRepository(queries, pool)
	auditLogRepo := repository.NewAuditLogRepository(queries)
	reportRepo := repository.NewReportRepository(queries)
	notificationRepo := repository.NewNotificationRepository(queries)
	chatRepo := repository.NewChatRepository(queries)
	chatThreadRepo := repository.NewChatThreadRepository(queries, pool)
	analyticsRepo := repository.NewAnalyticsRepository(queries)
	intentLogRepo := repository.NewIntentParseLogRepository(queries)

	// ---- Outside services, each optional: unset config degrades one feature
	// instead of stopping startup (see newEmailSender, newIconUploader).
	emailSender := newEmailSender(cfg, logger)
	iconUploader := newIconUploader(cfg, logger)
	if cfg.AIServiceToken == "" {
		logger.Warn("AI_SERVICE_TOKEN not set — AI Service calls carry no credential (docs/ops-runbook.md §9)")
	}
	aiEndpoint := service.AIServiceEndpoint{BaseURL: cfg.AIServiceURL, Token: cfg.AIServiceToken}

	// ---- Auth and accounts.
	tokenService := service.NewTokenService(cfg.JWTSecret)
	sessionService := service.NewSessionService(sessionRepo, tokenService, logger)
	authService := service.NewAuthService(userRepo, revokedRepo, tokenService, sessionService, logger)
	accountSwitchService := service.NewAccountSwitchService(userRepo, revokedRepo, tokenService, sessionService, logger)
	sessionRevocationService := service.NewSessionRevocationService(userRepo, accountSwitchService, sessionService, logger)
	passwordResetService := service.NewPasswordResetService(userRepo, passwordResetRepo, cfg.JWTSecret, emailSender, sessionService, logger)
	passkeyService, err := service.NewPasskeyService(newPasskeyRelyingParty(cfg.Passkey, logger), passkeyRepo, userRepo, sessionService, logger)
	if err != nil {
		return routeHandlers{}, nil, fmt.Errorf("wire: configure passkeys: %w", err)
	}
	// Both read when a past migration was applied, so they need the database.
	openLegacyRefreshWindow(ctx, queries, authService, logger)
	enableUnboundSessionCleanup(ctx, queries, sessionService, logger)
	deletionPolicy := service.NewAccountDeletionPolicy(cfg.AccountDeletionOperatorEmail)

	// ---- Money features. One CycleResolver is shared by every spend figure
	// (budgets, notifications, reports, analytics) so no two screens disagree
	// on what "this cycle" is.
	cycleResolver := service.NewCycleResolver(budgetPlanRepo)
	walletService := service.NewWalletService(walletRepo, logger)
	walletMemberService := service.NewWalletMemberService(walletRepo, walletRepo, userRepo, emailSender, logger)
	categoryService := service.NewCategoryService(categoryRepo, logger)
	budgetService := service.NewBudgetService(budgetRepo, cycleResolver, logger)
	transactionService := service.NewTransactionService(transactionRepo, walletRepo, categoryRepo, logger)
	// Import is handed transactionService itself, not a repository: every
	// imported row goes through CreateTransaction, never a second insert path
	// (specs/transaction-export-import/spec.md Context #4).
	transactionImportService := service.NewTransactionImportService(transactionService, transactionRepo, walletRepo, categoryRepo, tokenService, logger)
	reportService := service.NewReportService(reportRepo, walletRepo, categoryRepo, cycleResolver, logger)
	notificationService := service.NewNotificationService(notificationRepo, budgetRepo, cycleResolver, logger)

	// ---- AI features: each talks to the internal Python AI Service.
	chatService := service.NewChatService(chatRepo, walletRepo, categoryRepo, service.NewHTTPAIServiceClient(aiEndpoint), logger)
	chatImageService := service.NewChatImageService(walletRepo, categoryRepo, transactionRepo, service.NewHTTPAIImageClient(aiEndpoint), logger)
	budgetWizardService := service.NewBudgetWizardService(budgetRepo, categoryRepo, walletRepo, service.NewHTTPAIBudgetClient(aiEndpoint), logger)
	// Spending questions reuse the report queries and BudgetService; free text
	// gets its own AI client, a per-minute token budget and a question log
	// (specs/ai-chat-query-spending/).
	analyticsService := service.NewAnalyticsService(reportRepo, analyticsRepo, walletRepo, categoryRepo, budgetService, cycleResolver, logger)
	consultTokens := service.NewConsultTokenBudget(common.ConsultTokenBudgetPerMinute, common.ConsultTokenBudgetWindow)
	consultService := service.NewConsultService(analyticsService, analyticsRepo, walletRepo, categoryRepo, service.NewHTTPAIConsultClient(aiEndpoint), consultTokens, intentLogRepo, cycleResolver, logger)

	// ---- Handlers: HTTP only, one per feature.
	routes := routeHandlers{
		logger:   logger,
		tokens:   tokenService,
		sessions: sessionService,
		db:       pool,

		auth:              handler.NewAuthHandler(authService, logger),
		accountSwitch:     handler.NewAccountSwitchHandler(accountSwitchService, logger),
		sessionRevocation: handler.NewSessionRevocationHandler(sessionRevocationService, logger),
		deviceSessions:    handler.NewDeviceSessionHandler(sessionService, logger),
		passkey:           handler.NewPasskeyHandler(passkeyService, logger),
		passwordReset:     handler.NewPasswordResetHandler(passwordResetService, logger),
		accessRequest:     handler.NewAccessRequestHandler(service.NewAccessRequestService(userRepo, notificationRepo, emailSender, logger), logger),
		profile:           handler.NewProfileHandler(service.NewProfileService(userRepo, iconUploader, logger).WithAccountDeletionPolicy(deletionPolicy), logger),

		user:            handler.NewUserHandler(service.NewUserService(userRepo, emailSender, logger), logger),
		accountDeletion: handler.NewAccountDeletionHandler(service.NewAccountDeletionService(userRepo, sessionService, deletionPolicy, logger), logger),

		wallet:            handler.NewWalletHandler(walletService, iconUploader, logger),
		walletMember:      handler.NewWalletMemberHandler(walletMemberService, logger),
		category:          handler.NewCategoryHandler(categoryService, iconUploader, logger),
		budget:            handler.NewBudgetHandler(budgetService, iconUploader, logger),
		transaction:       handler.NewTransactionHandler(transactionService, logger),
		transactionExport: handler.NewTransactionExportHandler(service.NewTransactionExportService(transactionRepo, walletRepo, logger), logger),
		transactionImport: handler.NewTransactionImportHandler(transactionImportService, logger),
		auditLog:          handler.NewAuditLogHandler(service.NewAuditLogService(auditLogRepo, transactionRepo, logger), logger),
		report:            handler.NewReportHandler(reportService, logger),
		notification:      handler.NewNotificationHandler(notificationService, logger),

		chat:         handler.NewChatHandler(chatService, service.NewChatThreadService(chatThreadRepo), logger),
		chatImage:    handler.NewChatImageHandler(chatImageService, cfg.AIImageEnabled, logger),
		budgetWizard: handler.NewBudgetWizardHandler(budgetWizardService, logger),
		analytics:    handler.NewAnalyticsHandler(analyticsService, consultService, logger),

		assetLinks:    handler.NewAssetLinksHandler(cfg.Passkey.AndroidPackage, cfg.Passkey.AndroidCertSHA256),
		appUpdate:     handler.NewAppUpdateHandler(service.NewAppUpdateService(cfg.AppUpdatesDir), logger).WithPublicAPKURL(cfg.APKPublicURL),
		appUpdatesDir: cfg.AppUpdatesDir,
	}

	// ---- Background jobs (jobs.go). The budget check waits for its first
	// interval; the clean-ups also run at startup, so a backend restarted more
	// often than their interval still cleans up.
	jobs := []backgroundJob{
		{
			name:     "budget notifications",
			interval: common.NotificationJobInterval,
			run:      notificationService.EvaluateBudgets,
		},
		{
			name:       "token retention",
			interval:   common.TokenPurgeInterval,
			runAtStart: true,
			run:        service.NewTokenRetention(sessionRepo, revokedRepo, logger).WithResetCodes(passwordResetRepo).Purge,
		},
		{
			name:       "question log retention",
			interval:   common.IntentLogPurgeInterval,
			runAtStart: true,
			run:        service.NewIntentLogRetention(intentLogRepo, logger).Purge,
		},
	}

	return routes, jobs, nil
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
