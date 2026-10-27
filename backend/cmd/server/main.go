// Command server is the PFM HTTP API. main reads its configuration, connects
// to Postgres, builds every handler (wiring.go), registers the routes
// (routes.go), starts the background jobs (jobs.go) and serves until the
// process is told to stop.
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
	"github.com/example/pfm/backend/internal/middleware"
	"github.com/example/pfm/backend/internal/response"
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

	routes, jobs, err := wire(cfg, pool, logger)
	if err != nil {
		logger.Fatal("failed to build the API", zap.Error(err))
	}

	app := newApp(cfg, logger)
	registerRoutes(app, routes)

	go func() {
		if err := app.Listen(":" + cfg.Port); err != nil {
			logger.Fatal("server stopped unexpectedly", zap.Error(err))
		}
	}()
	logger.Info("server started", zap.String("port", cfg.Port))

	stopJobs := startBackgroundJobs(jobs, logger)
	waitForShutdown(app, stopJobs, logger)
}

// newApp creates the Fiber app with its size and time limits, and the
// middleware every request passes through.
//
// Order matters: the request logger is outermost so it sees (and logs) the
// 500 that Recover makes of a panic; security headers go on every response,
// errors and CORS preflights included.
func newApp(cfg *config.Config, logger *zap.Logger) *fiber.App {
	app := fiber.New(fiber.Config{
		BodyLimit:    common.HTTPBodyLimitBytes,
		ReadTimeout:  common.HTTPReadTimeout,
		WriteTimeout: common.HTTPWriteTimeout,
		IdleTimeout:  common.HTTPIdleTimeout,
		// A handler that returns an error instead of writing a response is
		// answered here, in the same envelope as every other error.
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return response.Error(c, logger, err)
		},
	})
	app.Use(middleware.RequestLogger(logger, healthPath, healthReadyPath))
	app.Use(middleware.Recover(logger))
	app.Use(middleware.SecurityHeaders())
	app.Use(cors.New(cors.Config{
		AllowOrigins:  cfg.CORSAllowedOrigins,
		AllowHeaders:  "Origin, Content-Type, Accept, Authorization, " + fiber.HeaderXRequestID + ", " + common.HeaderDeviceID + ", " + common.HeaderDeviceName,
		AllowMethods:  "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		ExposeHeaders: fiber.HeaderXRequestID,
	}))
	return app
}

// waitForShutdown blocks until SIGINT/SIGTERM (Docker sends SIGTERM on
// `docker compose up` replacing the container), then stops the background
// jobs and lets in-flight requests finish, up to common.ShutdownTimeout.
func waitForShutdown(app *fiber.App, stopJobs func(), logger *zap.Logger) {
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server")
	stopJobs()
	if err := app.ShutdownWithTimeout(common.ShutdownTimeout); err != nil {
		logger.Error("error during shutdown", zap.Error(err))
	}
}

// newLogger is JSON at info level in production (what ops/archive-logs.sh
// parses), human-readable at debug level everywhere else.
func newLogger() (*zap.Logger, error) {
	if os.Getenv("APP_ENV") == "production" {
		return zap.NewProduction()
	}
	return zap.NewDevelopment()
}
