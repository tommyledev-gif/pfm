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
//   - update: an existing pin can be moved (new coordinates + new place
//     name, PATCH `location`, 2026-10-07) and its note edited (PATCH
//     `location_note`), independently. A Transaction created without a pin
//     can gain one later through the same `location` field (2026-10-14), with
//     its note in the same PATCH. A pin is never removed, and a note alone
//     cannot go on a Transaction with no pin (there is nothing to describe).
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
// create), anything else is the trimmed new note. addsPin is true when the
// same PATCH gives a pin-less Transaction its pin, which the note then goes on.
func locationNoteUpdate(existing *model.Transaction, requested *string, addsPin bool) (*string, error) {
	if requested == nil {
		return nil, nil
	}
	if existing.Location == nil && !addsPin {
		return nil, common.NewInvalidInputError("location_note can only be set on a transaction that has a location")
	}
	trimmed := strings.TrimSpace(*requested)
	return &trimmed, nil
}

// locationMove is a validated PATCH `location`: the pin's new position and
// that position's place name (nil = store NULL).
type locationMove struct {
	Latitude  float64
	Longitude float64
	PlaceName *string
}

// locationMoveUpdate validates a PATCH's location: nil when the PATCH did not
// touch the pin, otherwise the new position — a move of the existing pin, or
// the first pin of a Transaction that had none. PlaceName is normalized like
// on create; absent counts as "no name", never "keep the old one", because
// the old name described the old position. The nil-coordinate check repeats
// the DTO's `required`, same reason as newTransactionLocation.
func locationMoveUpdate(requested *dto.TransactionLocationMoveRequest) (*locationMove, error) {
	if requested == nil {
		return nil, nil
	}
	if requested.Latitude == nil || requested.Longitude == nil {
		return nil, common.NewInvalidInputError("location.latitude and location.longitude are both required")
	}
	return &locationMove{
		Latitude:  *requested.Latitude,
		Longitude: *requested.Longitude,
		PlaceName: normalizeLocationText(requested.PlaceName),
	}, nil
}

// locationUpdate is everything a PATCH changes about a Transaction's
// location, already validated against it. Both parts are independent; nil
// means "not in this PATCH".
type locationUpdate struct {
	// Note is locationNoteUpdate's result: nil = unchanged, "" = clear.
	Note *string
	// Move is locationMoveUpdate's result: nil = pin unchanged.
	Move *locationMove
}

// resolveLocationUpdate validates both location fields of a PATCH.
func resolveLocationUpdate(existing *model.Transaction, req dto.UpdateTransactionRequest) (locationUpdate, error) {
	move, err := locationMoveUpdate(req.Location)
	if err != nil {
		return locationUpdate{}, err
	}
	note, err := locationNoteUpdate(existing, req.LocationNote, move != nil && existing.Location == nil)
	if err != nil {
		return locationUpdate{}, err
	}
	return locationUpdate{Note: note, Move: move}, nil
}
