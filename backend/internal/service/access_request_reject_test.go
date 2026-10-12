package service

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// fileRequest files a request for email and drains the admin's approval
// email, returning the waiting row and the approval token from that email.
func fileRequest(t *testing.T, svc *AccessRequestService, repo *fakeUserRepo, email *recordingEmailSender, address string) (*model.User, string) {
	t.Helper()
	if err := svc.RequestAccess(context.Background(), address, "admin@example.com"); err != nil {
		t.Fatalf("RequestAccess: %v", err)
	}
	sent := email.next(t)
	requester, err := repo.GetUserByEmail(context.Background(), address)
	if err != nil {
		t.Fatalf("request row: %v", err)
	}
	return requester, sent.token
}

func TestAccessRequest_Reject(t *testing.T) {
	svc, repo, notifier, email, _ := newTestAccessRequestService(t)
	requester, approvalToken := fileRequest(t, svc, repo, email, "new@example.com")

	if err := svc.Reject(context.Background(), requester.ID); err != nil {
		t.Fatalf("Reject: %v", err)
	}
	if _, err := repo.GetUserByEmail(context.Background(), "new@example.com"); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("request row after reject: got %v, want it soft-deleted", err)
	}
	// Nothing goes to the requester.
	select {
	case e := <-email.sent:
		t.Fatalf("sent %+v on reject", e)
	case <-time.After(100 * time.Millisecond):
	}

	// The admin's email link is dead, and so is approving from a stale list.
	if _, err := svc.ApproveByToken(context.Background(), approvalToken); !errors.Is(err, common.ErrAccessRequestHandled) {
		t.Fatalf("email link after reject: got %v, want ACCESS_REQUEST_HANDLED", err)
	}
	if _, err := svc.Approve(context.Background(), requester.ID); !errors.Is(err, common.ErrNotFound) {
		t.Fatalf("approve after reject: got %v, want NOT_FOUND", err)
	}

	// The email is free again: the person can send a new request.
	again, _ := fileRequest(t, svc, repo, email, "new@example.com")
	if again.ID == requester.ID || again.Status != model.UserStatusRequested {
		t.Fatalf("new request = %+v, want a fresh waiting row", again)
	}
	if len(notifier.sent) != 2 {
		t.Fatalf("notifications = %d, want 2 (one per request)", len(notifier.sent))
	}
}

func TestAccessRequest_RejectNotWaiting(t *testing.T) {
	svc, repo, _, email, _ := newTestAccessRequestService(t)

	member, _ := repo.GetUserByEmail(context.Background(), "member@example.com")
	if err := svc.Reject(context.Background(), member.ID); !errors.Is(err, common.ErrAccessRequestHandled) {
		t.Fatalf("rejecting an active user: got %v, want ACCESS_REQUEST_HANDLED", err)
	}

	approved, _ := fileRequest(t, svc, repo, email, "approved@example.com")
	if _, err := svc.Approve(context.Background(), approved.ID); err != nil {
		t.Fatalf("Approve: %v", err)
	}
	email.next(t)
	if err := svc.Reject(context.Background(), approved.ID); !errors.Is(err, common.ErrAccessRequestHandled) {
		t.Fatalf("rejecting an approved request: got %v, want ACCESS_REQUEST_HANDLED", err)
	}

	if err := svc.Reject(context.Background(), uuid.New()); !errors.Is(err, common.ErrNotFound) {
		t.Fatalf("unknown id: got %v, want NOT_FOUND", err)
	}

	rejected, _ := fileRequest(t, svc, repo, email, "rejected@example.com")
	if err := svc.Reject(context.Background(), rejected.ID); err != nil {
		t.Fatalf("Reject: %v", err)
	}
	if err := svc.Reject(context.Background(), rejected.ID); !errors.Is(err, common.ErrNotFound) {
		t.Fatalf("second reject: got %v, want NOT_FOUND (row is gone)", err)
	}
}

// staleReadUserRepo answers GetUserByID with a copy read before another
// admin acted, so the service's status check passes and only the
// conditional UPDATE can catch the race.
type staleReadUserRepo struct {
	*fakeUserRepo
	stale *model.User
}

func (s staleReadUserRepo) GetUserByID(context.Context, uuid.UUID) (*model.User, error) {
	cp := *s.stale
	return &cp, nil
}

func TestAccessRequest_RejectLosesRaceToApproval(t *testing.T) {
	svc, repo, notifier, email, _ := newTestAccessRequestService(t)
	requester, _ := fileRequest(t, svc, repo, email, "new@example.com")

	if _, err := svc.Approve(context.Background(), requester.ID); err != nil {
		t.Fatalf("Approve: %v", err)
	}
	email.next(t)

	stale := NewAccessRequestService(staleReadUserRepo{repo, requester}, notifier, email, zap.NewNop())
	if err := stale.Reject(context.Background(), requester.ID); !errors.Is(err, common.ErrAccessRequestHandled) {
		t.Fatalf("reject after approval won: got %v, want ACCESS_REQUEST_HANDLED", err)
	}
	if u, err := repo.GetUserByEmail(context.Background(), "new@example.com"); err != nil || u.Status != model.UserStatusPending {
		t.Fatalf("row = %+v, %v; want the approval to stand", u, err)
	}
}

// An approval and a rejection at once: exactly one wins. The loser sees
// ACCESS_REQUEST_HANDLED, or NOT_FOUND when the rejection deleted the row
// before the approval read it.
func TestAccessRequest_ApproveAndRejectAtOnce(t *testing.T) {
	svc, repo, _, email, _ := newTestAccessRequestService(t)
	requester, _ := fileRequest(t, svc, repo, email, "new@example.com")

	var wg sync.WaitGroup
	results := make(chan error, 2)
	wg.Add(2)
	go func() {
		defer wg.Done()
		_, err := svc.Approve(context.Background(), requester.ID)
		results <- err
	}()
	go func() {
		defer wg.Done()
		results <- svc.Reject(context.Background(), requester.ID)
	}()
	wg.Wait()
	close(results)

	wins := 0
	for err := range results {
		switch {
		case err == nil:
			wins++
		case !errors.Is(err, common.ErrAccessRequestHandled) && !errors.Is(err, common.ErrNotFound):
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if wins != 1 {
		t.Fatalf("%d of approve/reject succeeded, want exactly 1", wins)
	}
}
