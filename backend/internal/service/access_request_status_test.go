package service

import (
	"context"
	"testing"
)

// The requester's device keeps its login button off until this turns false.
// Anything but a request still waiting answers false, so an active account
// and an unknown email cannot be told apart through it.
func TestAccessRequest_AwaitingApproval(t *testing.T) {
	ctx := context.Background()
	svc, repo, _, email, _ := newTestAccessRequestService(t)

	awaiting := func(address string) bool {
		t.Helper()
		got, err := svc.AwaitingApproval(ctx, address)
		if err != nil {
			t.Fatalf("AwaitingApproval(%q): %v", address, err)
		}
		return got
	}

	if awaiting("member@example.com") || awaiting("nobody@example.com") {
		t.Fatal("an active account or an unknown email answered true")
	}

	if err := svc.RequestAccess(ctx, "new@example.com", "admin@example.com"); err != nil {
		t.Fatalf("RequestAccess: %v", err)
	}
	email.next(t)
	if !awaiting(" New@Example.com ") {
		t.Fatal("a waiting request answered false (email not normalized?)")
	}

	requester, _ := repo.GetUserByEmail(ctx, "new@example.com")
	if _, err := svc.Approve(ctx, requester.ID); err != nil {
		t.Fatalf("Approve: %v", err)
	}
	email.next(t)
	if awaiting("new@example.com") {
		t.Fatal("an approved request still answered true")
	}

	if err := svc.RequestAccess(ctx, "other@example.com", "admin@example.com"); err != nil {
		t.Fatalf("RequestAccess: %v", err)
	}
	email.next(t)
	other, _ := repo.GetUserByEmail(ctx, "other@example.com")
	if err := svc.Reject(ctx, other.ID); err != nil {
		t.Fatalf("Reject: %v", err)
	}
	if awaiting("other@example.com") {
		t.Fatal("a rejected request still answered true")
	}
}
