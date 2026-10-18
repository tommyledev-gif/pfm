package service

import (
	"strings"
	"unicode/utf8"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
)

// imageLines is one receipt's lines in proposal shape, money in xu.
type imageLines struct {
	items       []dto.ChatActionItem
	adjustments []dto.ChatActionAdjustment
	review      dto.ChatActionReviewLines
	reconciles  bool
}

// lineOutcome says what happened to a receipt's lines (spec BR-15, plan F25).
type lineOutcome int

const (
	linesNone     lineOutcome = iota // nothing to attach
	linesAttached                    // attached; may or may not reconcile
	linesTooMany                     // over the maximum: none attached, the lead-in says so
	linesInvalid                     // a line failed a shape check: none attached
)

// fixedImageAdjustmentDirections mirrors the TXI kind → direction rule
// (transaction_lines.go fixedAdjustmentSigns): the model's own direction is
// ignored for these kinds, so the confirm can never fail on kind_direction.
var fixedImageAdjustmentDirections = map[string]string{
	string(model.LineKindTax):      dto.AdjustmentDirectionAdd,
	string(model.LineKindFee):      dto.AdjustmentDirectionAdd,
	string(model.LineKindDiscount): dto.AdjustmentDirectionSubtract,
}

// resolveImageLines turns the AI's receipt lines into proposal lines. The
// printed total stays the source of truth: lines that do not add up are kept
// and reported (reconciles = false), never used to change the total. Any
// line failing a shape check drops every line — never a partial list.
func resolveImageLines(totalXu int64, items []AIProposedImageItem, adjustments []AIProposedImageAdjustment) (imageLines, lineOutcome) {
	if len(items) == 0 {
		return imageLines{}, linesNone
	}
	if len(items) > common.TransactionItemsMax || len(adjustments) > common.TransactionAdjustmentsMax {
		return imageLines{}, linesTooMany
	}
	out := imageLines{
		items:       make([]dto.ChatActionItem, 0, len(items)),
		adjustments: make([]dto.ChatActionAdjustment, 0, len(adjustments)),
		review:      dto.ChatActionReviewLines{Items: []int{}, Adjustments: []int{}},
	}
	maxVND := common.MaxTransactionAmountCents / common.VNDToCentsFactor
	var computedVND int64
	for i, p := range items {
		item, ok := resolveImageItem(p, maxVND)
		if !ok {
			return imageLines{}, linesInvalid
		}
		computedVND += p.AmountVND
		if computedVND > maxVND {
			return imageLines{}, linesInvalid
		}
		out.items = append(out.items, item)
		if p.NeedsReview {
			out.review.Items = append(out.review.Items, i)
		}
	}
	for i, p := range adjustments {
		adjustment, ok := resolveImageAdjustment(p, maxVND)
		if !ok {
			return imageLines{}, linesInvalid
		}
		if adjustment.Direction == dto.AdjustmentDirectionAdd {
			computedVND += p.AmountVND
		} else {
			computedVND -= p.AmountVND
		}
		out.adjustments = append(out.adjustments, adjustment)
		if p.NeedsReview {
			out.review.Adjustments = append(out.review.Adjustments, i)
		}
	}
	out.reconciles = computedVND*common.VNDToCentsFactor == totalXu
	return out, linesAttached
}

func (l imageLines) hasReviewMarks() bool {
	return len(l.review.Items) > 0 || len(l.review.Adjustments) > 0
}

func resolveImageItem(p AIProposedImageItem, maxVND int64) (dto.ChatActionItem, bool) {
	name := truncateRunes(strings.TrimSpace(p.Name), common.TransactionLineNameMaxLength)
	quantity := p.Quantity
	if quantity == 0 {
		quantity = defaultItemQuantity
	}
	if name == "" || quantity < 1 || quantity > common.TransactionItemQuantityMax || p.AmountVND <= 0 || p.AmountVND > maxVND {
		return dto.ChatActionItem{}, false
	}
	var unitPrice *int64
	if p.UnitPriceVND != nil {
		if *p.UnitPriceVND <= 0 || *p.UnitPriceVND > maxVND {
			return dto.ChatActionItem{}, false
		}
		cents := *p.UnitPriceVND * common.VNDToCentsFactor
		unitPrice = &cents
	}
	return dto.ChatActionItem{Name: name, Quantity: quantity, UnitPrice: unitPrice, Amount: p.AmountVND * common.VNDToCentsFactor}, true
}

func resolveImageAdjustment(p AIProposedImageAdjustment, maxVND int64) (dto.ChatActionAdjustment, bool) {
	if p.AmountVND <= 0 || p.AmountVND > maxVND {
		return dto.ChatActionAdjustment{}, false
	}
	var label *string
	if p.Label != nil {
		if trimmed := truncateRunes(strings.TrimSpace(*p.Label), common.TransactionLineNameMaxLength); trimmed != "" {
			label = &trimmed
		}
	}
	direction, fixed := fixedImageAdjustmentDirections[p.Kind]
	switch {
	case fixed:
	case p.Kind == string(model.LineKindOther) && label != nil &&
		(p.Direction == dto.AdjustmentDirectionAdd || p.Direction == dto.AdjustmentDirectionSubtract):
		direction = p.Direction
	default:
		return dto.ChatActionAdjustment{}, false
	}
	return dto.ChatActionAdjustment{Kind: p.Kind, Direction: direction, Label: label, Amount: p.AmountVND * common.VNDToCentsFactor}, true
}

func truncateRunes(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	return string([]rune(s)[:max])
}
