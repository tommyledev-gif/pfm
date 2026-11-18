package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/repository/sqlc"
)

func intentionParams(title string, month time.Time) SpendingIntentionParams {
	total := int64(200_000_000)
	return SpendingIntentionParams{Title: title, Kind: "one_time", Currency: "VND", TotalAmount: &total, TargetMonth: month}
}

// specs/ai-chat-spending-intentions: create, read back, list in month order,
// edit, soft-delete, and the idempotency key against the real table.
func TestLiveSpendingIntentionLifecycle(t *testing.T) {
	pool := testPool(t)
	userID, stranger := newUser(t, pool), newUser(t, pool)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM spending_intentions WHERE user_id = ANY($1)`, []uuid.UUID{userID, stranger})
	})
	repo := NewSpendingIntentionRepository(sqlc.New(pool))
	ctx := context.Background()
	nov := time.Date(2026, time.November, 1, 0, 0, 0, 0, time.UTC)
	oct := time.Date(2026, time.October, 1, 0, 0, 0, 0, time.UTC)

	later, err := repo.Create(ctx, userID, intentionParams("Tháng sau", nov), nil)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := repo.Create(ctx, userID, intentionParams("Tháng này", oct), nil); err != nil {
		t.Fatalf("create: %v", err)
	}
	list, err := repo.List(ctx, userID)
	if err != nil || len(list) != 2 || list[0].Title != "Tháng này" {
		t.Fatalf("list must be soonest month first, got %v %v", list, err)
	}
	if n, _ := repo.Count(ctx, userID); n != 2 {
		t.Fatalf("count = %d", n)
	}

	// Own rows only: another User's id is "no rows", for read, edit and delete.
	if _, err := repo.GetByID(ctx, stranger, later.ID); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("a stranger must not read it: %v", err)
	}
	if _, err := repo.Update(ctx, stranger, later.ID, intentionParams("Chiếm", nov)); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("a stranger must not edit it: %v", err)
	}
	if deleted, _ := repo.Delete(ctx, stranger, later.ID); deleted {
		t.Fatal("a stranger must not delete it")
	}

	edited, err := repo.Update(ctx, userID, later.ID, intentionParams("Đã sửa", nov))
	if err != nil || edited.Title != "Đã sửa" {
		t.Fatalf("update: %v %v", edited, err)
	}
	if deleted, err := repo.Delete(ctx, userID, later.ID); err != nil || !deleted {
		t.Fatalf("delete: %v %v", deleted, err)
	}
	if deleted, _ := repo.Delete(ctx, userID, later.ID); deleted {
		t.Fatal("a second delete must report nothing deleted")
	}
	if _, err := repo.GetByID(ctx, userID, later.ID); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("a deleted intention must not be read: %v", err)
	}
	if n, _ := repo.Count(ctx, userID); n != 1 {
		t.Fatalf("a deleted intention must not count, got %d", n)
	}
}

// BR-16: the same key twice is one row; the lookup still finds a deleted one.
func TestLiveSpendingIntentionKey(t *testing.T) {
	pool := testPool(t)
	userID := newUser(t, pool)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM spending_intentions WHERE user_id = $1`, userID)
	})
	repo := NewSpendingIntentionRepository(sqlc.New(pool))
	ctx := context.Background()
	month := time.Date(2026, time.November, 1, 0, 0, 0, 0, time.UTC)
	key := "msg_1_1"

	first, err := repo.Create(ctx, userID, intentionParams("Nước hoa", month), &key)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if _, err := repo.Create(ctx, userID, intentionParams("Nước hoa", month), &key); !errors.Is(err, ErrIntentionKeyTaken) {
		t.Fatalf("the same key must lose the race, got %v", err)
	}
	if _, err := repo.Delete(ctx, userID, first.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	found, err := repo.GetByKey(ctx, userID, key)
	if err != nil || found.DeletedAt == nil {
		t.Fatalf("the key lookup must still find the deleted row: %v %v", found, err)
	}
}

// The table's own guards: an instalment of one month or a one-time purchase
// with a payment never reaches a row.
func TestLiveSpendingIntentionChecks(t *testing.T) {
	pool := testPool(t)
	userID := newUser(t, pool)
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DELETE FROM spending_intentions WHERE user_id = $1`, userID)
	})
	repo := NewSpendingIntentionRepository(sqlc.New(pool))
	month := time.Date(2026, time.November, 1, 0, 0, 0, 0, time.UTC)
	payment, one := int64(100_000_000), 1

	oneMonth := intentionParams("Trả góp", month)
	oneMonth.Kind, oneMonth.MonthlyAmount, oneMonth.InstallmentMonths = "installment", &payment, &one
	if _, err := repo.Create(context.Background(), userID, oneMonth, nil); err == nil {
		t.Fatal("a one-month instalment must be refused by the table")
	}
	mixed := intentionParams("Một lần", month)
	mixed.MonthlyAmount = &payment
	if _, err := repo.Create(context.Background(), userID, mixed, nil); err == nil {
		t.Fatal("a one-time purchase with a monthly payment must be refused by the table")
	}
}
