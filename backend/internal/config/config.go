package config

import (
	"fmt"
	"os"
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
}

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
	}
	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("config.Load: DATABASE_URL is required")
	}
	if cfg.JWTSecret == "" {
		return nil, fmt.Errorf("config.Load: JWT_SECRET is required")
	}
	return cfg, nil
}

func getEnvOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
