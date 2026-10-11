package repository

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// Real-SQL checks for the hand-written transaction_lines queries and the
// 029 CHECK constraints (specs/transaction-line-items). Skipped unless
// PFM_TEST_DATABASE_URL is set — see session_repository_integration_test.go.

func newExpenseTransaction(t *testing.T, pool *pgxpool.Pool, repo *TransactionRepository, userID uuid.UUID) uuid.UUID {
	t.Helper()
	ctx := context.Background()
	var walletID, categoryID uuid.UUID
	if err := pool.QueryRow(ctx,
		`INSERT INTO wallets (user_id, name, type, balance, currency) VALUES ($1, 'Lines test', 'cash', 0, 'VND') RETURNING id`,
		userID).Scan(&walletID); err != nil {
		t.Fatalf("insert wallet: %v", err)
	}
	if err := pool.QueryRow(ctx,
		`INSERT INTO categories (user_id, name, type) VALUES ($1, 'Lines test', 'expense') RETURNING id`,
		userID).Scan(&categoryID); err != nil {
		t.Fatalf("insert category: %v", err)
	}
	tx, err := repo.BeginTx(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed
	created, err := repo.CreateTransaction(ctx, tx, CreateTransactionParams{
		UserID: userID, WalletID: walletID, CategoryID: categoryID, Amount: 10800000,
		Type: string(model.TransactionTypeExpense), OccurredAt: time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("create transaction: %v", err)
	}
	label := "VAT"
	unitPrice := int64(1500000)
	if err := repo.InsertTransactionLines(ctx, tx, created.ID, userID, TransactionLines{
		Items: []model.TransactionItem{
			{Name: "Sữa", Quantity: 2, UnitPrice: &unitPrice, Amount: 3000000},
			{Name: "Bánh mì", Quantity: 1, Amount: 7000000},
		},
		Adjustments: []model.TransactionAdjustment{{Kind: model.LineKindTax, Sign: model.LineSignAdd, Label: &label, Amount: 800000}},
	}); err != nil {
		t.Fatalf("insert lines: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM transaction_lines WHERE transaction_id = $1`, created.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM transaction_audit_logs WHERE transaction_id = $1`, created.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM transactions WHERE id = $1`, created.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM categories WHERE id = $1`, categoryID)
		_, _ = pool.Exec(ctx, `DELETE FROM wallets WHERE id = $1`, walletID)
	})
	return created.ID
}

func TestTransactionLines_RoundTripCountReplaceLock(t *testing.T) {
	pool := testPool(t)
	repo := NewTransactionRepository(sqlc.New(pool), pool)
	userID := newUser(t, pool)
	ctx := context.Background()
	id := newExpenseTransaction(t, pool, repo, userID)

	lines, err := repo.ListActiveLines(ctx, nil, id, userID)
	if err != nil || len(lines.Items) != 2 || len(lines.Adjustments) != 1 || lines.Items[0].Name != "Sữa" {
		t.Fatalf("round trip: %+v err=%v", lines, err)
	}
	if other, _ := repo.ListActiveLines(ctx, nil, id, uuid.New()); len(other.Items) != 0 {
		t.Fatal("lines leaked to another user")
	}
	counts, err := repo.CountActiveItems(ctx, userID, []uuid.UUID{id})
	if err != nil || counts[id] != 2 {
		t.Fatalf("count: %v err=%v", counts, err)
	}
	byID, err := repo.ListActiveLinesByTransactionIDs(ctx, userID, []uuid.UUID{id})
	if err != nil || len(byID[id].Items) != 2 {
		t.Fatalf("by ids: %+v err=%v", byID, err)
	}

	tx, err := repo.BeginTx(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck // no-op once committed
	amount, _, err := repo.LockTransactionForUpdate(ctx, tx, id, userID)
	if err != nil || amount != 10800000 {
		t.Fatalf("lock: amount=%d err=%v", amount, err)
	}
	if err := repo.SoftDeleteActiveLines(ctx, tx, id, userID); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if after, _ := repo.ListActiveLines(ctx, nil, id, userID); len(after.Items) != 0 {
		t.Fatal("expected no active lines after replace")
	}
	var retired int
	if err := pool.QueryRow(ctx, `SELECT COUNT(*) FROM transaction_lines WHERE transaction_id = $1 AND deleted_at IS NOT NULL`, id).Scan(&retired); err != nil || retired != 3 {
		t.Fatalf("expected 3 retired rows kept, got %d err=%v", retired, err)
	}
}

// The CHECKs back the service rules: a discount that adds is refused.
func TestTransactionLines_CheckConstraints(t *testing.T) {
	pool := testPool(t)
	repo := NewTransactionRepository(sqlc.New(pool), pool)
	userID := newUser(t, pool)
	ctx := context.Background()
	id := newExpenseTransaction(t, pool, repo, userID)

	_, err := pool.Exec(ctx,
		`INSERT INTO transaction_lines (transaction_id, user_id, position, kind, sign, amount) VALUES ($1, $2, 9, 'discount', 1, 100)`,
		id, userID)
	if err == nil {
		t.Fatal("expected transaction_lines_sign_check to refuse an adding discount")
	}
}
