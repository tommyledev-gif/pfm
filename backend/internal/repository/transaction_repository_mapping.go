package repository

import (
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository/sqlc"
)

// Row -> model conversions for TransactionRepository, split from
// transaction_repository.go to keep that file under the 300-line limit.

// toTransactionModel converts the bare transactions row that Create/Update/
// SoftDelete return. WalletName/CategoryName/ToWalletName are not on that row
// — the service fills them in from what it already loaded.
func toTransactionModel(row sqlc.Transaction) *model.Transaction {
	return &model.Transaction{
		ID:         row.ID,
		UserID:     row.UserID,
		WalletID:   row.WalletID,
		CategoryID: row.CategoryID,
		Amount:     row.Amount,
		Type:       model.TransactionType(row.Type),
		Note:       row.Note,
		OccurredAt: row.OccurredAt,
		CreatedAt:  row.CreatedAt,
		UpdatedAt:  row.UpdatedAt,
		DeletedAt:  row.DeletedAt,
		ToWalletID: row.ToWalletID,
		Location:   toTransactionLocation(row.LocationLat, row.LocationLng, row.LocationName, row.LocationNote),
	}
}

// toJoinedTransactionModel converts the wallets/categories-joined row shape
// shared by GetTransactionByID, GetTransactionByIdempotencyKey and
// ListTransactionsByUser. The latter two row types have exactly the same
// fields, so callers convert them with sqlc.GetTransactionByIDRow(row) — if
// the three select lists ever drift apart, that conversion stops compiling,
// which is the point.
func toJoinedTransactionModel(row sqlc.GetTransactionByIDRow) *model.Transaction {
	return &model.Transaction{
		ID:           row.ID,
		UserID:       row.UserID,
		WalletID:     row.WalletID,
		WalletName:   row.WalletName,
		CategoryID:   row.CategoryID,
		CategoryName: row.CategoryName,
		Amount:       row.Amount,
		Type:         model.TransactionType(row.Type),
		Note:         row.Note,
		OccurredAt:   row.OccurredAt,
		CreatedAt:    row.CreatedAt,
		UpdatedAt:    row.UpdatedAt,
		DeletedAt:    row.DeletedAt,
		ToWalletID:   row.ToWalletID,
		ToWalletName: row.ToWalletName,
		Location:     toTransactionLocation(row.LocationLat, row.LocationLng, row.LocationName, row.LocationNote),
	}
}

// toTransactionLocation returns nil unless both coordinates are present —
// transactions_location_pair_check guarantees they are NULL together, so a
// lone coordinate never reaches here from a real row.
func toTransactionLocation(lat, lng *float64, placeName, note *string) *model.TransactionLocation {
	if lat == nil || lng == nil {
		return nil
	}
	return &model.TransactionLocation{
		Latitude:  *lat,
		Longitude: *lng,
		PlaceName: placeName,
		Note:      note,
	}
}
