package service

import (
	"fmt"
	"strings"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// Pure rules for the Items and Adjustments of a Transaction
// (specs/transaction-line-items BR-03 to BR-09). No I/O.
//
// Overflow: the DTO caps every line at common.MaxTransactionAmountCents
// (~1e14) and a list at TransactionItemsMax + TransactionAdjustmentsMax lines,
// so any sum here stays below ~1.1e16 — far inside int64.

// defaultItemQuantity applies when an Item omits its quantity (BR-03).
const defaultItemQuantity int32 = 1

// lineFieldError mirrors handler.fieldError's JSON shape so a client parses
// shape errors from the handler and from here the same way.
type lineFieldError struct {
	Field string `json:"field"`
	Rule  string `json:"rule"`
	Path  string `json:"path"`
}

// fixedAdjustmentSigns are the kinds whose direction is not the User's choice
// (BR-06). "other" is absent: its direction is required input.
var fixedAdjustmentSigns = map[model.LineKind]model.LineSign{
	model.LineKindTax:      model.LineSignAdd,
	model.LineKindFee:      model.LineSignAdd,
	model.LineKindDiscount: model.LineSignSubtract,
}

// normalizeLines trims names, applies the quantity default and the kind →
// direction rule, and collects every Kind-dependent error into one 400
// (independent checks are reported together, never one per round trip).
func normalizeLines(items []dto.TransactionItemRequest, adjustments []dto.TransactionAdjustmentRequest) (repository.TransactionLines, error) {
	var problems []lineFieldError
	if len(items) == 0 && len(adjustments) > 0 {
		problems = append(problems, lineFieldError{Field: "Adjustments", Rule: "requires_items", Path: "Adjustments"})
	}

	lines := repository.TransactionLines{
		Items:       make([]model.TransactionItem, 0, len(items)),
		Adjustments: make([]model.TransactionAdjustment, 0, len(adjustments)),
	}
	for i, item := range items {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			problems = append(problems, lineFieldError{Field: "Name", Rule: "required", Path: fmt.Sprintf("Items[%d].Name", i)})
		}
		quantity := defaultItemQuantity
		if item.Quantity != nil {
			quantity = *item.Quantity
		}
		lines.Items = append(lines.Items, model.TransactionItem{
			Name: name, Quantity: quantity, UnitPrice: item.UnitPrice, Amount: item.Amount,
		})
	}
	for i, adjustment := range adjustments {
		normalized, adjustmentProblems := normalizeAdjustment(i, adjustment)
		problems = append(problems, adjustmentProblems...)
		lines.Adjustments = append(lines.Adjustments, normalized)
	}

	if len(problems) > 0 {
		return repository.TransactionLines{}, common.NewInvalidInputErrorWithDetails("items or adjustments failed validation", problems)
	}
	return lines, nil
}

func normalizeAdjustment(index int, req dto.TransactionAdjustmentRequest) (model.TransactionAdjustment, []lineFieldError) {
	var problems []lineFieldError
	kind := model.LineKind(req.Kind)
	path := func(field string) string { return fmt.Sprintf("Adjustments[%d].%s", index, field) }

	var requested *model.LineSign
	if req.Direction != nil {
		sign := model.LineSignAdd
		if *req.Direction == dto.AdjustmentDirectionSubtract {
			sign = model.LineSignSubtract
		}
		requested = &sign
	}

	var label *string
	if req.Label != nil {
		if trimmed := strings.TrimSpace(*req.Label); trimmed != "" {
			label = &trimmed
		}
	}

	sign, fixed := fixedAdjustmentSigns[kind]
	switch {
	case fixed && requested != nil && *requested != sign:
		problems = append(problems, lineFieldError{Field: "Direction", Rule: "kind_direction", Path: path("Direction")})
	case !fixed && requested == nil:
		problems = append(problems, lineFieldError{Field: "Direction", Rule: "required", Path: path("Direction")})
	case !fixed:
		sign = *requested
	}
	if kind == model.LineKindOther && label == nil {
		problems = append(problems, lineFieldError{Field: "Label", Rule: "required", Path: path("Label")})
	}

	return model.TransactionAdjustment{Kind: kind, Sign: sign, Label: label, Amount: req.Amount}, problems
}

// itemsTotal is the sum of the Items' line amounts.
func itemsTotal(lines repository.TransactionLines) int64 {
	var total int64
	for _, item := range lines.Items {
		total += item.Amount
	}
	return total
}

// computedTotal is Items total + adding Adjustments - subtracting ones (BR-07).
func computedTotal(lines repository.TransactionLines) int64 {
	total := itemsTotal(lines)
	for _, adjustment := range lines.Adjustments {
		total += adjustment.SignedAmount()
	}
	return total
}

// reconcile enforces the balance rule (BR-07). A list without Items passes:
// normalizeLines has already refused Adjustments without Items (BR-08).
func reconcile(amount int64, lines repository.TransactionLines) error {
	if len(lines.Items) == 0 {
		return nil
	}
	if computed := computedTotal(lines); computed != amount {
		return common.NewItemsTotalMismatchError(itemsTotal(lines), computed, amount)
	}
	return nil
}

// hasLines reports whether a normalized list carries anything to store.
func hasLines(lines repository.TransactionLines) bool {
	return len(lines.Items) > 0 || len(lines.Adjustments) > 0
}

// attachLines copies loaded lines onto a Transaction for the response.
func attachLines(t *model.Transaction, lines repository.TransactionLines) {
	t.Items = lines.Items
	t.Adjustments = lines.Adjustments
	if t.Items == nil {
		t.Items = []model.TransactionItem{}
	}
	if t.Adjustments == nil {
		t.Adjustments = []model.TransactionAdjustment{}
	}
	t.ItemCount = len(t.Items)
}
