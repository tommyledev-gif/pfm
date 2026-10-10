package service

import (
	"bytes"
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/imageupload"
)

// IconUploader is the storage boundary for user-uploaded images — entity
// icons (Category/Wallet/Budget) and user avatars. Mirrors EmailSender's
// shape — handlers depend on this interface, not the provider, so swapping
// storage backends later never touches a handler. keyPrefix (e.g.
// "category-icons", "wallet-icons", "avatars") namespaces the object keys so
// one implementation serves every entity (specs/wallet-budget-icons/plan.md
// Finding #5).
//
// Callers pass bytes that already went through imageupload.Process: the
// uploader trusts neither a client filename nor a client Content-Type, and
// picks the key and extension itself.
type IconUploader interface {
	// UploadIcon stores data under a random key (namespaced by keyPrefix)
	// and returns the publicly-reachable URL to save on the caller's row.
	// contentType must be one imageupload produces.
	UploadIcon(ctx context.Context, keyPrefix, contentType string, data []byte) (string, error)
	// DeleteIcon removes the object a URL returned by UploadIcon points at.
	// A URL that is not one of ours is ignored, so a caller can pass whatever
	// a row holds without checking where it came from.
	DeleteIcon(ctx context.Context, iconURL string) error
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

// objectExtensions is the only set of types ever stored; anything else is
// refused here even if a caller skipped imageupload.Process.
var objectExtensions = map[string]string{
	imageupload.ContentTypePNG:  ".png",
	imageupload.ContentTypeJPEG: ".jpg",
}

// iconImmutableCacheControl is safe because every upload gets a fresh random
// key: an object's bytes never change under its URL.
const iconImmutableCacheControl = "public, max-age=31536000, immutable"

func (u *R2IconUploader) UploadIcon(ctx context.Context, keyPrefix, contentType string, data []byte) (string, error) {
	ext, ok := objectExtensions[contentType]
	if !ok {
		return "", fmt.Errorf("service.R2IconUploader.UploadIcon: unsupported content type %q", contentType)
	}
	key := fmt.Sprintf("%s/%s%s", keyPrefix, uuid.NewString(), ext)
	_, err := u.client.PutObject(ctx, u.cfg.Bucket, key, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{
		ContentType:  contentType,
		CacheControl: iconImmutableCacheControl,
	})
	if err != nil {
		return "", fmt.Errorf("service.R2IconUploader.UploadIcon: %w", err)
	}
	return fmt.Sprintf("%s/%s", strings.TrimSuffix(u.cfg.PublicBaseURL, "/"), key), nil
}

func (u *R2IconUploader) DeleteIcon(ctx context.Context, iconURL string) error {
	key, ok := u.objectKey(iconURL)
	if !ok {
		return nil
	}
	if err := u.client.RemoveObject(ctx, u.cfg.Bucket, key, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("service.R2IconUploader.DeleteIcon: %w", err)
	}
	return nil
}

// objectKey maps a public URL back to its object key, only when the URL is
// under this bucket's public origin and one of the prefixes this app writes
// to. Anything else — a URL typed by hand, a legacy value, a key trying to
// escape with ".." — is not ours to delete.
func (u *R2IconUploader) objectKey(iconURL string) (string, bool) {
	base := strings.TrimSuffix(u.cfg.PublicBaseURL, "/") + "/"
	if !strings.HasPrefix(iconURL, base) {
		return "", false
	}
	key := strings.TrimPrefix(iconURL, base)
	if strings.Contains(key, "..") || strings.ContainsAny(key, "?#\\") {
		return "", false
	}
	for _, prefix := range common.ImageKeyPrefixes {
		if strings.HasPrefix(key, prefix+"/") {
			return key, true
		}
	}
	return "", false
}

// UnconfiguredIconUploader is the placeholder used when R2 credentials
// aren't set — same "don't fail startup, fail the individual request"
// convention as LogEmailSender vs. a missing SMTP_HOST.
type UnconfiguredIconUploader struct{}

func (UnconfiguredIconUploader) UploadIcon(context.Context, string, string, []byte) (string, error) {
	return "", fmt.Errorf("service.UnconfiguredIconUploader.UploadIcon: icon storage is not configured")
}

// DeleteIcon is a no-op: with no storage configured there is nothing stored.
func (UnconfiguredIconUploader) DeleteIcon(context.Context, string) error { return nil }
