package service

import (
	"context"
	"fmt"
	"testing"

	"github.com/google/uuid"

	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/repository"
)

// fakeChatThreadRepo holds one user's thread oldest first, the way the table
// orders it by created_at.
type fakeChatThreadRepo struct {
	rows       []repository.ChatThreadRow
	lastBefore *string
	lastLimit  int
	fullCalls  int
}

func (f *fakeChatThreadRepo) UpsertMessage(context.Context, repository.UpsertChatThreadMessageParams) error {
	return nil
}

func (f *fakeChatThreadRepo) ListByUser(context.Context, uuid.UUID) ([]repository.ChatThreadRow, error) {
	f.fullCalls++
	return f.rows, nil
}

// Newest first, older than `before` when set — the SQL's contract.
func (f *fakeChatThreadRepo) ListPageByUser(_ context.Context, _ uuid.UUID, before *string, limit int) ([]repository.ChatThreadRow, error) {
	f.lastBefore, f.lastLimit = before, limit
	end := len(f.rows)
	if before != nil {
		end = 0
		for i, r := range f.rows {
			if r.ClientMessageID == *before {
				end = i
				break
			}
		}
	}
	var out []repository.ChatThreadRow
	for i := end - 1; i >= 0 && len(out) < limit; i-- {
		out = append(out, f.rows[i])
	}
	return out, nil
}

func threadOf(n int) []repository.ChatThreadRow {
	rows := make([]repository.ChatThreadRow, n)
	for i := range rows {
		rows[i] = repository.ChatThreadRow{ClientMessageID: fmt.Sprintf("m%d", i), Payload: "{}"}
	}
	return rows
}

func ids(resp *dto.GetChatThreadResponse) []string {
	out := make([]string, len(resp.Messages))
	for i, m := range resp.Messages {
		out[i] = m.ClientMessageID
	}
	return out
}

func TestChatThreadService_GetThread_NoLimitReturnsWholeThread(t *testing.T) {
	repo := &fakeChatThreadRepo{rows: threadOf(5)}
	resp, err := NewChatThreadService(repo).GetThread(context.Background(), uuid.New(), dto.GetChatThreadQuery{})
	if err != nil {
		t.Fatal(err)
	}
	if repo.fullCalls != 1 || len(resp.Messages) != 5 || resp.HasMore {
		t.Fatalf("expected the whole thread unpaged, got %v hasMore=%v", ids(resp), resp.HasMore)
	}
}

func TestChatThreadService_GetThread_LatestPageOldestFirst(t *testing.T) {
	repo := &fakeChatThreadRepo{rows: threadOf(5)}
	resp, err := NewChatThreadService(repo).GetThread(context.Background(), uuid.New(), dto.GetChatThreadQuery{Limit: 2})
	if err != nil {
		t.Fatal(err)
	}
	if got := fmt.Sprint(ids(resp)); got != "[m3 m4]" || !resp.HasMore {
		t.Fatalf("expected [m3 m4] with more left, got %s hasMore=%v", got, resp.HasMore)
	}
	if repo.lastLimit != 3 || repo.lastBefore != nil {
		t.Fatalf("expected limit+1 and no cursor, got limit=%d before=%v", repo.lastLimit, repo.lastBefore)
	}
}

func TestChatThreadService_GetThread_OlderPageEndsTheThread(t *testing.T) {
	repo := &fakeChatThreadRepo{rows: threadOf(5)}
	resp, err := NewChatThreadService(repo).GetThread(context.Background(), uuid.New(), dto.GetChatThreadQuery{Limit: 3, Before: "m2"})
	if err != nil {
		t.Fatal(err)
	}
	if got := fmt.Sprint(ids(resp)); got != "[m0 m1]" || resp.HasMore {
		t.Fatalf("expected [m0 m1] and nothing older, got %s hasMore=%v", got, resp.HasMore)
	}
	if repo.lastBefore == nil || *repo.lastBefore != "m2" {
		t.Fatalf("expected cursor m2 passed through, got %v", repo.lastBefore)
	}
}
