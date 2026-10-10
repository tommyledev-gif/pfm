package service

import (
	"context"
	"testing"
)

func testUploader() *R2IconUploader {
	return &R2IconUploader{cfg: R2Config{PublicBaseURL: "https://img.example.com/"}}
}

func TestObjectKeyOnlyAcceptsOurOwnImageURLs(t *testing.T) {
	cases := []struct {
		name, url, wantKey string
		wantOK             bool
	}{
		{"wallet icon", "https://img.example.com/wallet-icons/0b1c.png", "wallet-icons/0b1c.png", true},
		{"avatar", "https://img.example.com/avatars/0b1c.jpg", "avatars/0b1c.jpg", true},
		{"other host", "https://evil.example.org/wallet-icons/0b1c.png", "", false},
		{"unknown prefix", "https://img.example.com/backups/db.sql.gz", "", false},
		{"prefix only", "https://img.example.com/avatars/", "avatars/", true},
		{"parent traversal", "https://img.example.com/avatars/../backups/db.sql.gz", "", false},
		{"query string", "https://img.example.com/avatars/a.png?x=1", "", false},
		{"backslash", `https://img.example.com/avatars/..\a.png`, "", false},
		{"empty", "", "", false},
		{"base only", "https://img.example.com/", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			key, ok := testUploader().objectKey(tc.url)
			if ok != tc.wantOK || key != tc.wantKey {
				t.Fatalf("objectKey(%q) = (%q, %v), want (%q, %v)", tc.url, key, ok, tc.wantKey, tc.wantOK)
			}
		})
	}
}

func TestUploadIconRefusesAnythingButProcessedImages(t *testing.T) {
	// No client is configured: refusal must happen before any network call.
	for _, contentType := range []string{"image/svg+xml", "text/html", "image/webp", ""} {
		if _, err := testUploader().UploadIcon(context.Background(), "avatars", contentType, []byte("x")); err == nil {
			t.Errorf("content type %q was accepted", contentType)
		}
	}
}

func TestDeleteIconIgnoresForeignURLs(t *testing.T) {
	// A foreign URL must be a no-op, not an S3 call (the client is nil here,
	// so a call would panic).
	if err := testUploader().DeleteIcon(context.Background(), "https://evil.example.org/avatars/a.png"); err != nil {
		t.Fatalf("DeleteIcon(foreign) = %v, want nil", err)
	}
	if err := (UnconfiguredIconUploader{}).DeleteIcon(context.Background(), "anything"); err != nil {
		t.Fatalf("UnconfiguredIconUploader.DeleteIcon = %v, want nil", err)
	}
}
