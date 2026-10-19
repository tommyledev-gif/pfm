package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config is read once at startup from environment variables (Docker Compose
// injects these — see infra/docker-compose.yml). No values are hardcoded.
type Config struct {
	Port               string
	DatabaseURL        string
	JWTSecret          string
	CORSAllowedOrigins string

	// SMTP dispatches the activation email (service.SMTPEmailSender). SMTPHost
	// empty means "no provider configured yet" — main.go falls back to
	// service.LogEmailSender rather than failing startup, since SMTP delivery
	// is not required to run the API locally.
	SMTPHost      string
	SMTPPort      string
	SMTPUsername  string
	SMTPPassword  string
	SMTPFromEmail string
	SMTPFromName  string
	// AppBaseURL is the web frontend origin the activation link points at
	// (`{AppBaseURL}/activate?token=...`), not the API's own origin.
	AppBaseURL string

	// AIServiceURL is the internal-only base URL for the Python AI Service
	// (Feature-12 AI Chat Assistant) — reachable only via the Docker network
	// service name, never a host-mapped port. Empty means "not configured";
	// ChatService's AIServiceClient call then fails and POST /ai/chat
	// degrades to 502 AI_SERVICE_UNAVAILABLE rather than failing startup.
	AIServiceURL string

	// AIImageEnabled is the operator switch for image reading
	// (specs/ai-chat-image-capture BR-18, plan F35). Off unless AI_IMAGE_ENABLED
	// is "true"; flipping it needs a restart, not a release.
	AIImageEnabled bool

	// R2* configures the Cloudflare R2 bucket that stores user-uploaded
	// category icons (service.R2IconUploader). R2AccountID empty means "not
	// configured yet" — main.go falls back to
	// service.UnconfiguredIconUploader, same "don't fail startup" pattern as
	// SMTPHost/AIServiceURL above; POST /categories/icon then degrades to
	// 503 ICON_UPLOAD_UNAVAILABLE.
	R2AccountID       string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2Bucket          string
	R2PublicBaseURL   string

	// DBMaxConns caps the pgx pool. pgx's own default is max(4, CPU count),
	// which on a small VPS is a handful of connections for the whole API.
	DBMaxConns int32

	// Passkey configures WebAuthn sign-in (config_passkey.go).
	Passkey PasskeyConfig

	// AppUpdatesDir holds the mobile app's published OTA updates and APKs
	// (service.AppUpdateService, docs/ops-runbook.md §8). Missing or empty is
	// fine: every client is told "no update" and the APK link answers 404.
	AppUpdatesDir string
}

// MinJWTSecretBytes is the shortest JWT_SECRET accepted. The same key signs
// every access, refresh, switch and import token, and HS256 is only as strong
// as that key: a short one is guessable offline from any token, after which
// anyone can mint a token for any user or role.
const MinJWTSecretBytes = 32

const defaultDBMaxConns = 10

func Load() (*Config, error) {
	cfg := &Config{
		Port:               getEnvOrDefault("PORT", "8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		CORSAllowedOrigins: getEnvOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:8081"),

		SMTPHost:      os.Getenv("SMTP_HOST"),
		SMTPPort:      getEnvOrDefault("SMTP_PORT", "587"),
		SMTPUsername:  os.Getenv("SMTP_USERNAME"),
		SMTPPassword:  os.Getenv("SMTP_PASSWORD"),
		SMTPFromEmail: getEnvOrDefault("SMTP_FROM_EMAIL", "no-reply@pfm.local"),
		SMTPFromName:  getEnvOrDefault("SMTP_FROM_NAME", "PFM"),
		AppBaseURL:    getEnvOrDefault("APP_BASE_URL", "http://localhost:8082"),

		AIServiceURL:   getEnvOrDefault("AI_SERVICE_URL", "http://ai-service:8000"),
		AIImageEnabled: os.Getenv("AI_IMAGE_ENABLED") == "true",

		R2AccountID:       os.Getenv("R2_ACCOUNT_ID"),
		R2AccessKeyID:     os.Getenv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: os.Getenv("R2_SECRET_ACCESS_KEY"),
		R2Bucket:          os.Getenv("R2_BUCKET"),
		R2PublicBaseURL:   os.Getenv("R2_PUBLIC_BASE_URL"),

		AppUpdatesDir: getEnvOrDefault("APP_UPDATES_DIR", "/data/app-updates"),
	}
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("config.Load: DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("config.Load: JWT_SECRET is required")
	}
	if len(cfg.JWTSecret) < MinJWTSecretBytes {
		return nil, fmt.Errorf("config.Load: JWT_SECRET must be at least %d bytes (got %d) — generate one with `openssl rand -hex 32`", MinJWTSecretBytes, len(cfg.JWTSecret))
	}

	maxConns, err := getEnvInt("DB_MAX_CONNS", defaultDBMaxConns)
	if err != nil {
		return nil, err
	}
	cfg.DBMaxConns = int32(maxConns)

	if cfg.Passkey, err = loadPasskeyConfig(); err != nil {
		return nil, err
	}
	return cfg, nil
}

// getEnvInt reads a positive integer, falling back to def when unset. A set
// but invalid value is an error rather than a silent default: a typo in
// DB_MAX_CONNS should stop the deploy, not quietly run with another limit.
func getEnvInt(key string, def int) (int, error) {
	raw := os.Getenv(key)
	if raw == "" {
		return def, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n < 1 || n > 1000 {
		return 0, fmt.Errorf("config.Load: %s must be an integer between 1 and 1000, got %q", key, raw)
	}
	return n, nil
}

func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
