package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

type sentEmail struct{ kind, to, token string }

// recordingEmailSender captures what AccessRequestService sends. Sends run on
// a goroutine, so tests wait on the channel instead of reading a slice.
type recordingEmailSender struct{ sent chan sentEmail }

func newRecordingEmailSender() *recordingEmailSender {
	return &recordingEmailSender{sent: make(chan sentEmail, 8)}
}

func (r *recordingEmailSender) SendActivationEmail(_ context.Context, to, token string) error {
	r.sent <- sentEmail{"activation", to, token}
	return nil
}
func (r *recordingEmailSender) SendAccessRequestEmail(_ context.Context, admin, _, token string) error {
	r.sent <- sentEmail{"request", admin, token}
	return nil
}
func (r *recordingEmailSender) SendAccessApprovedEmail(_ context.Context, to, token string) error {
	r.sent <- sentEmail{"approved", to, token}
	return nil
}

func (r *recordingEmailSender) SendPasswordResetCode(_ context.Context, to, code string) error {
	r.sent <- sentEmail{"reset", to, code}
	return nil
}

func (r *recordingEmailSender) next(t *testing.T) sentEmail {
	t.Helper()
	select {
	case e := <-r.sent:
		return e
	case <-time.After(2 * time.Second):
		t.Fatal("no email was sent")
		return sentEmail{}
	}
}

type fakeAccessNotifier struct {
	mu   sync.Mutex
	sent []uuid.UUID // admin IDs notified
}

func (f *fakeAccessNotifier) CreateAccessRequestNotification(_ context.Context, adminID uuid.UUID, _, _ string, _ uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.sent = append(f.sent, adminID)
	return nil
}

func newTestAccessRequestService(t *testing.T) (*AccessRequestService, *fakeUserRepo, *fakeAccessNotifier, *recordingEmailSender, *model.User) {
	t.Helper()
	repo := newFakeUserRepo()
	admin := &model.User{ID: uuid.New(), Email: "admin@example.com", Role: model.UserRoleAdmin, Status: model.UserStatusActive}
	member := &model.User{ID: uuid.New(), Email: "member@example.com", Role: model.UserRoleMember, Status: model.UserStatusActive}
	repo.byEmail[admin.Email] = admin
	repo.byEmail[member.Email] = member
	notifier := &fakeAccessNotifier{}
	email := newRecordingEmailSender()
	return NewAccessRequestService(repo, notifier, email, zap.NewNop()), repo, notifier, email, admin
}

func TestAccessRequest_RequestThenApproveByToken(t *testing.T) {
	svc, repo, notifier, email, admin := newTestAccessRequestService(t)

	if err := svc.RequestAccess(context.Background(), " New@Example.com ", "ADMIN@example.com"); err != nil {
		t.Fatalf("RequestAccess: %v", err)
	}
	requester, err := repo.GetUserByEmail(context.Background(), "new@example.com")
	if err != nil || requester.Status != model.UserStatusRequested || requester.InvitedBy == nil || *requester.InvitedBy != admin.ID {
		t.Fatalf("request row = %+v, %v; want status requested addressed to the admin", requester, err)
	}
	if len(notifier.sent) != 1 || notifier.sent[0] != admin.ID {
		t.Fatalf("notifications = %v, want one for the admin", notifier.sent)
	}
	request := email.next(t)
	if request.kind != "request" || request.to != admin.Email {
		t.Fatalf("email = %+v, want the approval email to the admin", request)
	}

	approved, err := svc.ApproveByToken(context.Background(), request.token)
	if err != nil {
		t.Fatalf("ApproveByToken: %v", err)
	}
	if approved.Status != model.UserStatusPending || approved.InviteToken == nil {
		t.Fatalf("approved = %+v, want a pending invite", approved)
	}
	sent := email.next(t)
	if sent.kind != "approved" || sent.to != "new@example.com" || sent.token != *approved.InviteToken {
		t.Fatalf("email = %+v, want the activation link to the requester", sent)
	}

	// The link works once.
	if _, err := svc.ApproveByToken(context.Background(), request.token); !errors.Is(err, common.ErrAccessRequestHandled) {
		t.Fatalf("second approval: got %v, want ACCESS_REQUEST_HANDLED", err)
	}
}

func TestAccessRequest_AdminMustBeAnActiveAdmin(t *testing.T) {
	svc, _, _, _, _ := newTestAccessRequestService(t)
	for _, adminEmail := range []string{"nobody@example.com", "member@example.com"} {
		if err := svc.RequestAccess(context.Background(), "new@example.com", adminEmail); !errors.Is(err, common.ErrAdminNotFound) {
			t.Errorf("admin %q: got %v, want ADMIN_NOT_FOUND", adminEmail, err)
		}
	}
	var appErr *common.AppError
	if err := svc.RequestAccess(context.Background(), "admin@example.com", "admin@example.com"); !errors.As(err, &appErr) || appErr.Code != common.ErrCodeInvalidInput {
		t.Errorf("same email twice: got %v, want INVALID_INPUT", err)
	}
}

// An email that already has an account answers exactly like a new request,
// and nothing is sent.
func TestAccessRequest_ExistingEmailIsSilent(t *testing.T) {
	svc, _, notifier, email, _ := newTestAccessRequestService(t)

	if err := svc.RequestAccess(context.Background(), "member@example.com", "admin@example.com"); err != nil {
		t.Fatalf("got %v, want nil", err)
	}
	if len(notifier.sent) != 0 {
		t.Fatalf("notified %v for an existing account", notifier.sent)
	}
	select {
	case e := <-email.sent:
		t.Fatalf("sent %+v for an existing account", e)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestAccessRequest_ApproveFromApp(t *testing.T) {
	svc, repo, _, email, _ := newTestAccessRequestService(t)
	if err := svc.RequestAccess(context.Background(), "new@example.com", "admin@example.com"); err != nil {
		t.Fatalf("RequestAccess: %v", err)
	}
	email.next(t)
	requester, _ := repo.GetUserByEmail(context.Background(), "new@example.com")

	// Two approvals at once (email link and app): exactly one wins.
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := svc.Approve(context.Background(), requester.ID)
			results <- err
		}()
	}
	wg.Wait()
	close(results)
	wins := 0
	for err := range results {
		switch {
		case err == nil:
			wins++
		case !errors.Is(err, common.ErrAccessRequestHandled):
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if wins != 1 {
		t.Fatalf("%d approvals succeeded, want exactly 1", wins)
	}

	member, _ := repo.GetUserByEmail(context.Background(), "member@example.com")
	if _, err := svc.Approve(context.Background(), member.ID); !errors.Is(err, common.ErrAccessRequestHandled) {
		t.Fatalf("approving an active user: got %v, want ACCESS_REQUEST_HANDLED", err)
	}
	if _, err := svc.Approve(context.Background(), uuid.New()); !errors.Is(err, common.ErrNotFound) {
		t.Fatalf("unknown id: got %v, want NOT_FOUND", err)
	}
}
