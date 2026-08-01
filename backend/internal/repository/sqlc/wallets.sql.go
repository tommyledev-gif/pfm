package sqlc

import (
	"context"

	"github.com/google/uuid"
)

const createWallet = `-- name: CreateWallet :one
INSERT INTO wallets (user_id, name, type, balance, currency, is_default)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, user_id, name, type, balance, currency, is_default, created_at, updated_at, deleted_at
`

type CreateWalletParams struct {
	UserID    uuid.UUID
	Name      string
	Type      string
	Balance   int64
	Currency  string
	IsDefault bool
}

func (q *Queries) CreateWallet(ctx context.Context, arg CreateWalletParams) (Wallet, error) {
	row := q.db.QueryRow(ctx, createWallet, arg.UserID, arg.Name, arg.Type, arg.Balance, arg.Currency, arg.IsDefault)
	var i Wallet
	err := row.Scan(
		&i.ID, &i.UserID, &i.Name, &i.Type, &i.Balance, &i.Currency,
		&i.IsDefault, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt,
	)
	return i, err
}

const countWalletsByUser = `-- name: CountWalletsByUser :one
SELECT COUNT(*) FROM wallets
WHERE user_id = $1
  AND deleted_at IS NULL
`

func (q *Queries) CountWalletsByUser(ctx context.Context, userID uuid.UUID) (int64, error) {
	row := q.db.QueryRow(ctx, countWalletsByUser, userID)
	var count int64
	err := row.Scan(&count)
	return count, err
}

const clearDefaultWallet = `-- name: ClearDefaultWallet :exec
UPDATE wallets
SET is_default = false, updated_at = NOW()
WHERE user_id = $1
  AND is_default = true
  AND deleted_at IS NULL
`

func (q *Queries) ClearDefaultWallet(ctx context.Context, userID uuid.UUID) error {
	_, err := q.db.Exec(ctx, clearDefaultWallet, userID)
	return err
}

const listWalletsByUser = `-- name: ListWalletsByUser :many
SELECT id, user_id, name, type, balance, currency, is_default, created_at, updated_at, deleted_at FROM wallets
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY is_default DESC, created_at ASC
`

func (q *Queries) ListWalletsByUser(ctx context.Context, userID uuid.UUID) ([]Wallet, error) {
	rows, err := q.db.Query(ctx, listWalletsByUser, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Wallet
	for rows.Next() {
		var i Wallet
		if err := rows.Scan(
			&i.ID, &i.UserID, &i.Name, &i.Type, &i.Balance, &i.Currency,
			&i.IsDefault, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

const getWalletByID = `-- name: GetWalletByID :one
SELECT id, user_id, name, type, balance, currency, is_default, created_at, updated_at, deleted_at FROM wallets
WHERE id = $1
  AND deleted_at IS NULL
LIMIT 1
`

// GetWalletByID is deliberately not scoped by user_id — see db/queries/wallets.sql.
func (q *Queries) GetWalletByID(ctx context.Context, id uuid.UUID) (Wallet, error) {
	row := q.db.QueryRow(ctx, getWalletByID, id)
	var i Wallet
	err := row.Scan(
		&i.ID, &i.UserID, &i.Name, &i.Type, &i.Balance, &i.Currency,
		&i.IsDefault, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt,
	)
	return i, err
}

const updateWallet = `-- name: UpdateWallet :one
UPDATE wallets
SET
    name       = COALESCE($3, name),
    type       = COALESCE($4, type),
    updated_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING id, user_id, name, type, balance, currency, is_default, created_at, updated_at, deleted_at
`

type UpdateWalletParams struct {
	ID     uuid.UUID
	UserID uuid.UUID
	Name   *string
	Type   *string
}

func (q *Queries) UpdateWallet(ctx context.Context, arg UpdateWalletParams) (Wallet, error) {
	row := q.db.QueryRow(ctx, updateWallet, arg.ID, arg.UserID, arg.Name, arg.Type)
	var i Wallet
	err := row.Scan(
		&i.ID, &i.UserID, &i.Name, &i.Type, &i.Balance, &i.Currency,
		&i.IsDefault, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt,
	)
	return i, err
}

const setDefaultWallet = `-- name: SetDefaultWallet :one
UPDATE wallets
SET is_default = true, updated_at = NOW()
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL
RETURNING id, user_id, name, type, balance, currency, is_default, created_at, updated_at, deleted_at
`

func (q *Queries) SetDefaultWallet(ctx context.Context, id uuid.UUID, userID uuid.UUID) (Wallet, error) {
	row := q.db.QueryRow(ctx, setDefaultWallet, id, userID)
	var i Wallet
	err := row.Scan(
		&i.ID, &i.UserID, &i.Name, &i.Type, &i.Balance, &i.Currency,
		&i.IsDefault, &i.CreatedAt, &i.UpdatedAt, &i.DeletedAt,
	)
	return i, err
}
