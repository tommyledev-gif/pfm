package repository

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/example/pfm/backend/internal/repository/sqlc"
)

func threadCount(t *testing.T, pool *pgxpool.Pool, userID uuid.UUID) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM chat_thread_messages WHERE user_id = $1`, userID).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	return n
}

// specs/security-hardening-2026-10 S-HRD-43/44: a sync is one batch, written
// all or nothing.
func TestLiveChatThreadUpsertMessagesIsAtomic(t *testing.T) {
	pool := testPool(t)
	userID := newUser(t, pool)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM chat_thread_messages WHERE user_id = $1`, userID)
	})
	repo := NewChatThreadRepository(sqlc.New(pool), pool)
	ctx := context.Background()

	// A NUL byte is not valid text in Postgres, so the second row fails.
	bad := []ChatThreadUpsert{
		{ClientMessageID: "msg_1", Payload: `{"a":1}`},
		{ClientMessageID: "msg_2", Payload: "bad\x00payload"},
		{ClientMessageID: "msg_3", Payload: `{"c":3}`},
	}
	if err := repo.UpsertMessages(ctx, userID, bad); err == nil {
		t.Fatal("expected the batch to fail")
	}
	if n := threadCount(t, pool, userID); n != 0 {
		t.Fatalf("a failed batch must write nothing, found %d rows", n)
	}

	good := []ChatThreadUpsert{
		{ClientMessageID: "msg_1", Payload: `{"a":1}`},
		{ClientMessageID: "msg_2", Payload: `{"b":2}`},
		{ClientMessageID: "msg_1", Payload: `{"a":2}`}, // same id twice: the last one wins
	}
	if err := repo.UpsertMessages(ctx, userID, good); err != nil {
		t.Fatalf("UpsertMessages: %v", err)
	}
	if n := threadCount(t, pool, userID); n != 2 {
		t.Fatalf("want 2 rows, found %d", n)
	}
	rows, err := repo.ListByUser(ctx, userID)
	if err != nil {
		t.Fatal(err)
	}
	for _, r := range rows {
		if r.ClientMessageID == "msg_1" && r.Payload != `{"a":2}` {
			t.Fatalf("msg_1 payload = %s", r.Payload)
		}
	}
}
