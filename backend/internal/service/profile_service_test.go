package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/imageupload"
	"github.com/example/pfm/backend/internal/model"
)

// recordingUploader is an IconUploader that records what was stored and deleted.
type recordingUploader struct {
	uploaded  []string
	deleted   []string
	uploadErr error
	deleteErr error
	counter   int
}

func (u *recordingUploader) UploadIcon(_ context.Context, prefix, _ string, _ []byte) (string, error) {
	if u.uploadErr != nil {
		return "", u.uploadErr
	}
	u.counter++
	url := fmt.Sprintf("https://img.example.com/%s/%d.png", prefix, u.counter)
	u.uploaded = append(u.uploaded, url)
	return url, nil
}

func (u *recordingUploader) DeleteIcon(_ context.Context, url string) error {
	u.deleted = append(u.deleted, url)
	return u.deleteErr
}

var pngImage = &imageupload.Image{Data: []byte("x"), ContentType: imageupload.ContentTypePNG}

const invalidNameMessage = "Tên chỉ gồm chữ, số, dấu cách và . , ' -"

func newProfileFixture(t *testing.T) (*ProfileService, *fakeUserRepo, *recordingUploader, *model.User) {
	t.Helper()
	users := newFakeUserRepo()
	uploader := &recordingUploader{}
	user := seedUser(users, "a@example.com", model.UserStatusActive)
	return NewProfileService(users, uploader, zap.NewNop()), users, uploader, user
}

func wantInvalidInput(t *testing.T, err error, wantMessage string) {
	t.Helper()
	var appErr *common.AppError
	if !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Fatalf("err = %v, want INVALID_INPUT", err)
	}
	if appErr.Message != wantMessage {
		t.Fatalf("message = %q, want %q", appErr.Message, wantMessage)
	}
}

func TestProfileUpdateFullNameAcceptsRealNames(t *testing.T) {
	svc, _, _, user := newProfileFixture(t)
	cases := map[string]string{
		"Nguyễn Văn A":      "Nguyễn Văn A",
		"  Lê   Thị  Mai  ": "Lê Thị Mai",
		"O'Brien-Smith Jr.": "O'Brien-Smith Jr.",
		"Trần, Minh":        "Trần, Minh",
		"An":                "An",
		"Anh 2":             "Anh 2",
		"Dr. D’Arcy":        "Dr. D’Arcy",
	}
	for raw, want := range cases {
		got, err := svc.UpdateFullName(context.Background(), user.ID, raw)
		if err != nil {
			t.Errorf("%q: %v", raw, err)
			continue
		}
		if got.FullName == nil || *got.FullName != want {
			t.Errorf("%q stored as %v, want %q", raw, got.FullName, want)
		}
	}
}

func TestProfileUpdateFullNameNormalisesToNFC(t *testing.T) {
	svc, _, _, user := newProfileFixture(t)
	decomposed := "Nguyễn" // "Nguyễn" as e + combining circumflex + combining tilde
	got, err := svc.UpdateFullName(context.Background(), user.ID, decomposed)
	if err != nil {
		t.Fatal(err)
	}
	if *got.FullName != "Nguyễn" {
		t.Fatalf("stored %q (%d bytes), want the precomposed form", *got.FullName, len(*got.FullName))
	}
}

func TestProfileUpdateFullNameRejects(t *testing.T) {
	svc, users, _, user := newProfileFixture(t)
	cases := []struct{ name, raw, message string }{
		{"empty", "", "Nhập tên."},
		{"only spaces", "   \t ", "Nhập tên."},
		{"too long", strings.Repeat("a", 61), "Tên tối đa 60 ký tự."},
		{"html", "<script>alert(1)</script>", invalidNameMessage},
		{"angle bracket", "A<B", invalidNameMessage},
		{"emoji", "An 😀", invalidNameMessage},
		{"control character", "An\x00Binh", invalidNameMessage},
		{"zero width space", "An​Binh", invalidNameMessage},
		{"bidi override", "An‮Binh", invalidNameMessage},
		{"at sign", "an@example.com", invalidNameMessage},
		{"slash", "a/b", invalidNameMessage},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.UpdateFullName(context.Background(), user.ID, tc.raw)
			wantInvalidInput(t, err, tc.message)
		})
	}
	if got := users.byID(user.ID); got.FullName != nil {
		t.Fatalf("a rejected name must not be stored, got %q", *got.FullName)
	}
}

func TestProfileNameLimitCountsCharactersNotBytes(t *testing.T) {
	svc, _, _, user := newProfileFixture(t)
	sixty := strings.Repeat("ê", 60) // 120 bytes
	if _, err := svc.UpdateFullName(context.Background(), user.ID, sixty); err != nil {
		t.Fatalf("60 characters must fit: %v", err)
	}
	if _, err := svc.UpdateFullName(context.Background(), user.ID, sixty+"ê"); err == nil {
		t.Fatal("61 characters must not fit")
	}
}

func TestProfileSetAvatarStoresURLAndDeletesTheOldObject(t *testing.T) {
	svc, users, uploader, user := newProfileFixture(t)

	first, err := svc.SetAvatar(context.Background(), user.ID, pngImage)
	if err != nil {
		t.Fatal(err)
	}
	if first.AvatarURL == nil || !strings.Contains(*first.AvatarURL, "/avatars/") {
		t.Fatalf("avatar url = %v, want one under avatars/", first.AvatarURL)
	}
	if len(uploader.deleted) != 0 {
		t.Fatalf("nothing to delete on the first avatar, got %v", uploader.deleted)
	}

	second, err := svc.SetAvatar(context.Background(), user.ID, pngImage)
	if err != nil {
		t.Fatal(err)
	}
	if *second.AvatarURL == *first.AvatarURL {
		t.Fatal("a new upload must get a new URL")
	}
	if len(uploader.deleted) != 1 || uploader.deleted[0] != *first.AvatarURL {
		t.Fatalf("deleted = %v, want exactly the first avatar %s", uploader.deleted, *first.AvatarURL)
	}
	if got := users.byID(user.ID); *got.AvatarURL != *second.AvatarURL {
		t.Fatalf("stored avatar = %s, want %s", *got.AvatarURL, *second.AvatarURL)
	}
}

func TestProfileSetAvatarKeepsTheNewAvatarWhenCleanupFails(t *testing.T) {
	svc, _, uploader, user := newProfileFixture(t)
	if _, err := svc.SetAvatar(context.Background(), user.ID, pngImage); err != nil {
		t.Fatal(err)
	}
	uploader.deleteErr = errors.New("r2 is down")

	second, err := svc.SetAvatar(context.Background(), user.ID, pngImage)
	if err != nil || second.AvatarURL == nil {
		t.Fatalf("a failed cleanup of the old object must not fail the upload: %v", err)
	}
}

func TestProfileSetAvatarUploadFailureChangesNothing(t *testing.T) {
	svc, users, uploader, user := newProfileFixture(t)
	uploader.uploadErr = errors.New("r2 is down")

	_, err := svc.SetAvatar(context.Background(), user.ID, pngImage)
	if !errors.Is(err, common.ErrIconUploadFailed) {
		t.Fatalf("err = %v, want ErrIconUploadFailed", err)
	}
	if got := users.byID(user.ID); got.AvatarURL != nil {
		t.Fatalf("avatar = %v, want unchanged", *got.AvatarURL)
	}
}

func TestProfileSetAvatarWithoutStorageIsServiceUnavailable(t *testing.T) {
	users := newFakeUserRepo()
	user := seedUser(users, "a@example.com", model.UserStatusActive)
	svc := NewProfileService(users, UnconfiguredIconUploader{}, zap.NewNop())

	if _, err := svc.SetAvatar(context.Background(), user.ID, pngImage); !errors.Is(err, common.ErrIconUploadUnavailable) {
		t.Fatalf("err = %v, want ErrIconUploadUnavailable", err)
	}
}

func TestProfileRemoveAvatar(t *testing.T) {
	svc, users, uploader, user := newProfileFixture(t)
	set, _ := svc.SetAvatar(context.Background(), user.ID, pngImage)

	got, err := svc.RemoveAvatar(context.Background(), user.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.AvatarURL != nil || users.byID(user.ID).AvatarURL != nil {
		t.Fatal("avatar must be cleared")
	}
	if len(uploader.deleted) != 1 || uploader.deleted[0] != *set.AvatarURL {
		t.Fatalf("deleted = %v, want the removed avatar", uploader.deleted)
	}
	if _, err := svc.RemoveAvatar(context.Background(), user.ID); err != nil {
		t.Fatalf("removing twice must be a no-op, got %v", err)
	}
}

func TestProfileUnknownUserIsUnauthenticated(t *testing.T) {
	svc, _, _, _ := newProfileFixture(t)
	ghost := seedUser(newFakeUserRepo(), "ghost@example.com", model.UserStatusActive)
	if _, err := svc.Get(context.Background(), ghost.ID); !errors.Is(err, common.ErrUnauthenticated) {
		t.Fatalf("err = %v, want ErrUnauthenticated", err)
	}
}
