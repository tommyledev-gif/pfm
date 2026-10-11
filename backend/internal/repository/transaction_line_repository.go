package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// TransactionLines groups a Transaction's active Items and Adjustments, each
// in saved order.
type TransactionLines struct {
	Items       []model.TransactionItem
	Adjustments []model.TransactionAdjustment
}

// InsertTransactionLines writes Items then Adjustments with consecutive
// positions, inside the caller's tx (specs/transaction-line-items BR-10). One
// statement per line: a list is capped at common.TransactionItemsMax +
// common.TransactionAdjustmentsMax rows, so batching buys nothing measurable.
func (r *TransactionRepository) InsertTransactionLines(ctx context.Context, tx pgx.Tx, transactionID, userID uuid.UUID, lines TransactionLines) error {
	q := r.q.WithTx(tx)
	position := int16(0)
	for _, item := range lines.Items {
		quantity := item.Quantity
		name := item.Name
		if err := q.InsertTransactionLine(ctx, sqlc.InsertTransactionLineParams{
			TransactionID: transactionID,
			UserID:        userID,
			Position:      position,
			Kind:          string(model.LineKindItem),
			Sign:          int16(model.LineSignAdd),
			Name:          &name,
			Quantity:      &quantity,
			UnitPrice:     item.UnitPrice,
			Amount:        item.Amount,
		}); err != nil {
			return err
		}
		position++
	}
	for _, adjustment := range lines.Adjustments {
		if err := q.InsertTransactionLine(ctx, sqlc.InsertTransactionLineParams{
			TransactionID: transactionID,
			UserID:        userID,
			Position:      position,
			Kind:          string(adjustment.Kind),
			Sign:          int16(adjustment.Sign),
			Name:          adjustment.Label,
			Amount:        adjustment.Amount,
		}); err != nil {
			return err
		}
		position++
	}
	return nil
}

// ListActiveLines returns a Transaction's active lines. tx may be nil for a
// plain read; UpdateTransaction passes its tx so the read sees the row it
// locked.
func (r *TransactionRepository) ListActiveLines(ctx context.Context, tx pgx.Tx, transactionID, userID uuid.UUID) (TransactionLines, error) {
	q := r.q
	if tx != nil {
		q = r.q.WithTx(tx)
	}
	rows, err := q.ListActiveLinesByTransaction(ctx, transactionID, userID)
	if err != nil {
		return TransactionLines{}, err
	}
	return toTransactionLines(rows), nil
}

// ListActiveLinesByTransactionIDs groups the active lines of several
// Transactions by Transaction id (export Items sheet).
func (r *TransactionRepository) ListActiveLinesByTransactionIDs(ctx context.Context, userID uuid.UUID, transactionIDs []uuid.UUID) (map[uuid.UUID]TransactionLines, error) {
	result := make(map[uuid.UUID]TransactionLines)
	if len(transactionIDs) == 0 {
		return result, nil
	}
	rows, err := r.q.ListActiveLinesByTransactionIDs(ctx, userID, transactionIDs)
	if err != nil {
		return nil, err
	}
	grouped := make(map[uuid.UUID][]sqlc.TransactionLine)
	for _, row := range rows {
		grouped[row.TransactionID] = append(grouped[row.TransactionID], row)
	}
	for id, group := range grouped {
		result[id] = toTransactionLines(group)
	}
	return result, nil
}

// SoftDeleteActiveLines retires every active line of a Transaction inside the
// caller's tx — the first half of an edit's replace-all (BR-11, BR-12).
func (r *TransactionRepository) SoftDeleteActiveLines(ctx context.Context, tx pgx.Tx, transactionID, userID uuid.UUID) error {
	return r.q.WithTx(tx).SoftDeleteActiveLinesByTransaction(ctx, transactionID, userID)
}

// CountActiveItems returns the Item count per Transaction id; ids with no
// Items are absent from the map.
func (r *TransactionRepository) CountActiveItems(ctx context.Context, userID uuid.UUID, transactionIDs []uuid.UUID) (map[uuid.UUID]int, error) {
	counts := make(map[uuid.UUID]int)
	if len(transactionIDs) == 0 {
		return counts, nil
	}
	rows, err := r.q.CountActiveItemsByTransactionIDs(ctx, userID, transactionIDs)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		counts[row.TransactionID] = int(row.ItemCount)
	}
	return counts, nil
}

// LockTransactionForUpdate row-locks a live Transaction inside the caller's tx
// and returns its current amount and updated_at. pgx.ErrNoRows means it is
// gone (deleted meanwhile) or not the caller's.
func (r *TransactionRepository) LockTransactionForUpdate(ctx context.Context, tx pgx.Tx, transactionID, userID uuid.UUID) (int64, time.Time, error) {
	row, err := r.q.WithTx(tx).LockTransactionForUpdate(ctx, transactionID, userID)
	if err != nil {
		return 0, time.Time{}, err
	}
	return row.Amount, row.UpdatedAt, nil
}

func toTransactionLines(rows []sqlc.TransactionLine) TransactionLines {
	lines := TransactionLines{
		Items:       []model.TransactionItem{},
		Adjustments: []model.TransactionAdjustment{},
	}
	for _, row := range rows {
		if model.LineKind(row.Kind) == model.LineKindItem {
			item := model.TransactionItem{UnitPrice: row.UnitPrice, Amount: row.Amount}
			if row.Name != nil {
				item.Name = *row.Name
			}
			if row.Quantity != nil {
				item.Quantity = *row.Quantity
			}
			lines.Items = append(lines.Items, item)
			continue
		}
		lines.Adjustments = append(lines.Adjustments, model.TransactionAdjustment{
			Kind:   model.LineKind(row.Kind),
			Sign:   model.LineSign(row.Sign),
			Label:  row.Name,
			Amount: row.Amount,
		})
	}
	return lines
}
