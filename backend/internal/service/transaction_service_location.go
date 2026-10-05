package service

import (
	"strings"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// Transaction location rules (026_transactions_location.sql):
//   - create: an optional map pin on any transaction type — coordinates, an
//     optional place name, an optional note. Range/length checks are shape
//     validation and live on dto.TransactionLocationRequest.
//   - update: only the note can change. Coordinates and place name are fixed
//     at creation, and a Transaction created without a pin can never gain a
//     note (there is nothing for it to describe).
//   - empty or whitespace-only text is stored as NULL, never "".

// newTransactionLocation converts the create request's location into the
// domain shape, or nil when none was sent. The nil-coordinate check repeats
// the DTO's `required` so a caller that skipped handler validation (e.g. the
// CSV import, should it ever pass locations) gets a 400 instead of a panic.
func newTransactionLocation(req *dto.TransactionLocationRequest) (*model.TransactionLocation, error) {
	if req == nil {
		return nil, nil
	}
	if req.Latitude == nil || req.Longitude == nil {
		return nil, common.NewInvalidInputError("location.latitude and location.longitude are both required")
	}
	return &model.TransactionLocation{
		Latitude:  *req.Latitude,
		Longitude: *req.Longitude,
		PlaceName: normalizeLocationText(req.PlaceName),
		Note:      normalizeLocationText(req.Note),
	}, nil
}

// normalizeLocationText trims surrounding whitespace and turns an empty
// result into nil, so the column stores NULL rather than "".
func normalizeLocationText(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

// locationNoteUpdate validates a PATCH's location_note against the existing
// Transaction and returns what to hand UpdateTransaction: nil leaves the
// column unchanged, "" clears it (whitespace-only counts as empty, same as on
// create), anything else is the trimmed new note.
func locationNoteUpdate(existing *model.Transaction, requested *string) (*string, error) {
	if requested == nil {
		return nil, nil
	}
	if existing.Location == nil {
		return nil, common.NewInvalidInputError("location_note can only be set on a transaction that has a location")
	}
	trimmed := strings.TrimSpace(*requested)
	return &trimmed, nil
}
