package config

import (
	"fmt"
	"os"
)

// Config is read once at startup from environment variables (Docker Compose
// injects these — see infra/docker-compose.yml). No values are hardcoded.
type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
}

func Load() (*Config, error) {
	cfg := &Config{
		Port:        getEnvOrDefault("PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		JWTSecret:   os.Getenv("JWT_SECRET"),
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
