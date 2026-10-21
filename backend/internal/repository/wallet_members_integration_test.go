package repository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// Real-Postgres checks of the hand-written shared-wallet SQL
// (specs/shared-wallets, mig 034/035): card colour, the membership
// lifecycle, the live-membership unique index, the shared wallet list, and
// the wallet-scoped transaction list. Skipped without PFM_TEST_DATABASE_URL
// — see testPool.

func newSharedWallet(t *testing.T, pool *pgxpool.Pool, repo *WalletRepository, ownerID uuid.UUID) *model.Wallet {
	t.Helper()
	ctx := context.Background()
	tx, err := repo.BeginTx(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	color := "teal"
	wallet, err := repo.CreateWallet(ctx, tx, CreateWalletParams{
		UserID: ownerID, Name: "Chi tiêu nhà", Type: "cash", Balance: 1_000_000_00, Currency: "VND", Color: &color,
	})
	if err != nil {
		t.Fatalf("create wallet: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM transactions WHERE wallet_id = $1`, wallet.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM wallet_members WHERE wallet_id = $1`, wallet.ID)
		_, _ = pool.Exec(ctx, `DELETE FROM wallets WHERE id = $1`, wallet.ID)
	})
	return wallet
}

func insertExpense(t *testing.T, pool *pgxpool.Pool, userID, walletID uuid.UUID, amount int64) uuid.UUID {
	t.Helper()
	var categoryID, id uuid.UUID
	ctx := context.Background()
	if err := pool.QueryRow(ctx, `SELECT id FROM categories WHERE user_id IS NULL AND type = 'expense' AND deleted_at IS NULL LIMIT 1`).Scan(&categoryID); err != nil {
		t.Fatalf("system category: %v", err)
	}
	err := pool.QueryRow(ctx,
		`INSERT INTO transactions (user_id, wallet_id, category_id, amount, type, occurred_at) VALUES ($1, $2, $3, $4, 'expense', $5) RETURNING id`,
		userID, walletID, categoryID, amount, time.Now().UTC()).Scan(&id)
	if err != nil {
		t.Fatalf("insert transaction: %v", err)
	}
	return id
}

func TestWalletRepository_ColorAndMembershipLifecycle(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	repo := NewWalletRepository(sqlc.New(pool), pool)
	ownerID, memberID := newUser(t, pool), newUser(t, pool)
	t.Cleanup(func() {
		_, _ = pool.Exec(ctx, `DELETE FROM notifications WHERE user_id IN ($1, $2)`, ownerID, memberID)
	})
	wallet := newSharedWallet(t, pool, repo, ownerID)
	if wallet.Color == nil || *wallet.Color != "teal" {
		t.Fatalf("colour not stored: %v", wallet.Color)
	}

	// Colour: a presence-flag CASE, so null clears it and omitted keeps it.
	updated, err := repo.UpdateWallet(ctx, UpdateWalletParams{ID: wallet.ID, UserID: ownerID, ColorProvided: true})
	if err != nil || updated.Color != nil {
		t.Fatalf("clear colour: %+v, %v", updated.Color, err)
	}

	tx, err := repo.BeginTx(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	member, err := repo.CreateWalletMember(ctx, tx, wallet.ID, memberID, model.WalletMemberRoleEditor, ownerID)
	if err != nil {
		t.Fatalf("create member: %v", err)
	}
	if err := repo.CreateWalletNotification(ctx, tx, memberID, "wallet_invite", "t", "b", ownerID); err != nil {
		t.Fatalf("notification: %v", err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatalf("commit: %v", err)
	}
	if member.Status != model.WalletMemberStatusPending {
		t.Fatalf("expected pending, got %s", member.Status)
	}

	// A second live membership for the same person is refused by the index.
	tx2, _ := repo.BeginTx(ctx)
	if _, err := repo.CreateWalletMember(ctx, tx2, wallet.ID, memberID, model.WalletMemberRoleViewer, ownerID); err == nil {
		t.Fatal("expected a unique violation for a second live membership")
	}
	_ = tx2.Rollback(ctx)

	invitations, err := repo.ListPendingWalletInvitations(ctx, memberID)
	if err != nil || len(invitations) != 1 || invitations[0].WalletID != wallet.ID {
		t.Fatalf("pending invitations: %+v, %v", invitations, err)
	}
	shared, err := repo.ListSharedWalletsForUser(ctx, memberID)
	if err != nil || len(shared) != 0 {
		t.Fatalf("a pending invitation must not share the wallet yet: %+v, %v", shared, err)
	}

	tx3, _ := repo.BeginTx(ctx)
	if _, err := repo.AcceptWalletInvitation(ctx, tx3, wallet.ID, memberID); err != nil {
		t.Fatalf("accept: %v", err)
	}
	_ = tx3.Commit(ctx)

	shared, err = repo.ListSharedWalletsForUser(ctx, memberID)
	if err != nil || len(shared) != 1 || shared[0].Access != model.WalletAccessEditor || shared[0].OwnerName == nil {
		t.Fatalf("shared wallet after accept: %+v, %v", shared, err)
	}
	counts, err := repo.CountActiveMembersByWallets(ctx, []uuid.UUID{wallet.ID})
	if err != nil || counts[wallet.ID] != 1 {
		t.Fatalf("member count: %v, %v", counts, err)
	}
	members, err := repo.ListWalletMembers(ctx, wallet.ID)
	if err != nil || len(members) != 1 || members[0].Name == "" {
		t.Fatalf("members: %+v, %v", members, err)
	}
	if _, err := repo.UpdateWalletMemberRole(ctx, wallet.ID, memberID, model.WalletMemberRoleViewer); err != nil {
		t.Fatalf("change role: %v", err)
	}
	names, err := repo.ListUserDisplayNames(ctx, []uuid.UUID{ownerID, memberID})
	if err != nil || len(names) != 2 {
		t.Fatalf("display names: %v, %v", names, err)
	}

	if _, err := repo.RemoveWalletMember(ctx, wallet.ID, memberID); err != nil {
		t.Fatalf("remove: %v", err)
	}
	if _, err := repo.GetLiveWalletMember(ctx, wallet.ID, memberID); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("removed member still live: %v", err)
	}
	// Removed, the same person may be invited again.
	tx4, _ := repo.BeginTx(ctx)
	if _, err := repo.CreateWalletMember(ctx, tx4, wallet.ID, memberID, model.WalletMemberRoleViewer, ownerID); err != nil {
		t.Fatalf("re-invite after removal: %v", err)
	}
	_ = tx4.Commit(ctx)
}

func TestTransactionRepository_WalletScopedList(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	walletRepo := NewWalletRepository(sqlc.New(pool), pool)
	txRepo := NewTransactionRepository(sqlc.New(pool), pool)
	ownerID, memberID := newUser(t, pool), newUser(t, pool)
	wallet := newSharedWallet(t, pool, walletRepo, ownerID)
	insertExpense(t, pool, ownerID, wallet.ID, 10_000_00)
	insertExpense(t, pool, memberID, wallet.ID, 20_000_00)

	filter := ListTransactionsFilter{WalletID: &wallet.ID, Limit: 10}
	own, err := txRepo.ListTransactionsByUser(ctx, ownerID, filter)
	if err != nil || len(own) != 1 {
		t.Fatalf("unscoped list must stay the caller's own: %d, %v", len(own), err)
	}

	filter.WalletScoped = true
	all, err := txRepo.ListTransactionsByUser(ctx, ownerID, filter)
	if err != nil || len(all) != 2 {
		t.Fatalf("wallet-scoped list should hold both entries: %d, %v", len(all), err)
	}
	total, err := txRepo.CountTransactionsByUser(ctx, ownerID, filter)
	if err != nil || total != 2 {
		t.Fatalf("wallet-scoped count: %d, %v", total, err)
	}

	// The flag never widens a list without a wallet filter.
	wide, err := txRepo.ListTransactionsByUser(ctx, ownerID, ListTransactionsFilter{WalletScoped: true, Limit: 10})
	if err != nil || len(wide) != 1 {
		t.Fatalf("WalletScoped without a wallet must not widen the list: %d, %v", len(wide), err)
	}
}

// The anomaly answer's row listing (analytics_anomaly.sql), hand-written too:
// one type, the window, the currency, newest first, transfers excluded.
func TestAnalyticsRepository_ListTransactionsInWindow(t *testing.T) {
	pool := testPool(t)
	ctx := context.Background()
	walletRepo := NewWalletRepository(sqlc.New(pool), pool)
	userID := newUser(t, pool)
	wallet := newSharedWallet(t, pool, walletRepo, userID)
	insertExpense(t, pool, userID, wallet.ID, 30_000_00)
	insertExpense(t, pool, userID, wallet.ID, 40_000_00)

	expense := "expense"
	rows, err := NewAnalyticsRepository(sqlc.New(pool)).ListTransactionsInWindow(ctx, userID, AnalyticsFilter{
		Currency: "VND", Start: time.Now().Add(-time.Hour), End: time.Now().Add(time.Hour), TxType: &expense,
	}, 10)
	if err != nil || len(rows) != 2 || rows[0].CategoryName == "" {
		t.Fatalf("window listing: %+v, %v", rows, err)
	}
}
