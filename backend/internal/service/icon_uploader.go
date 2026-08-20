package service

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// IconUploader is the storage boundary for user-uploaded category icons
// (spec: any category avatar the client renders should support a custom
// png/jpg/svg image, not just the built-in emoji `icon` string). Mirrors
// EmailSender's shape — CategoryHandler depends on this interface, not the
// provider, so swapping storage backends later never touches the handler.
type IconUploader interface {
	// UploadIcon stores data under a random key derived from filename and
	// returns the publicly-reachable URL to save on the category row.
	UploadIcon(ctx context.Context, filename, contentType string, data []byte) (string, error)
}

// R2Config is the subset of config.Config the R2 uploader needs — passed as
// a plain struct rather than *config.Config, same isolation convention as
// service.SMTPConfig.
type R2Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	Bucket          string
	// PublicBaseURL is the public origin that serves the bucket's objects —
	// either R2's own r2.dev subdomain or a custom domain fronting it via
	// Cloudflare (a plain bucket has no public HTTP access on its own).
	PublicBaseURL string
}

// R2IconUploader stores category icons in a Cloudflare R2 bucket. R2 is
// S3-compatible, so a plain S3 client (minio-go — lighter than
// aws-sdk-go-v2 for this single-bucket, single-operation use) talks to it
// via R2's S3 API endpoint (https://<account_id>.r2.cloudflarestorage.com).
type R2IconUploader struct {
	client *minio.Client
	cfg    R2Config
}

func NewR2IconUploader(cfg R2Config) (*R2IconUploader, error) {
	endpoint := fmt.Sprintf("%s.r2.cloudflarestorage.com", cfg.AccountID)
	client, err := minio.New(endpoint, &minio.Options{
		Creds: credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		// R2's S3 API only speaks HTTPS.
		Secure: true,
		// R2 ignores the region value but the S3 client requires one be set.
		Region: "auto",
	})
	if err != nil {
		return nil, fmt.Errorf("service.NewR2IconUploader: %w", err)
	}
	return &R2IconUploader{client: client, cfg: cfg}, nil
}

func (u *R2IconUploader) UploadIcon(ctx context.Context, filename, contentType string, data []byte) (string, error) {
	key := fmt.Sprintf("category-icons/%s-%s", uuid.NewString(), sanitizeFilename(filename))
	_, err := u.client.PutObject(ctx, u.cfg.Bucket, key, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return "", fmt.Errorf("service.R2IconUploader.UploadIcon: %w", err)
	}
	return fmt.Sprintf("%s/%s", strings.TrimSuffix(u.cfg.PublicBaseURL, "/"), key), nil
}

// sanitizeFilename strips path separators from a client-supplied filename
// before it becomes part of an object key — the uuid prefix already
// guarantees uniqueness, this just stops "../../etc" style path traversal
// in the key itself.
func sanitizeFilename(name string) string {
	name = strings.ReplaceAll(name, "/", "_")
	name = strings.ReplaceAll(name, "\\", "_")
	if name == "" {
		return "icon"
	}
	return name
}

// UnconfiguredIconUploader is the placeholder used when R2 credentials
// aren't set — same "don't fail startup, fail the individual request"
// convention as LogEmailSender vs. a missing SMTP_HOST.
type UnconfiguredIconUploader struct{}

func (UnconfiguredIconUploader) UploadIcon(context.Context, string, string, []byte) (string, error) {
	return "", fmt.Errorf("service.UnconfiguredIconUploader.UploadIcon: icon storage is not configured")
}
