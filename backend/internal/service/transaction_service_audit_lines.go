package service

import (
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/model"
	"github.com/example/pfm/backend/internal/repository"
)

// Audit shapes for Items and Adjustments (specs/transaction-line-items
// AC-24). Keys mirror the API's `items` / `adjustments` entries so a client
// renders history with the same field names it already knows.

// auditLinesSummary is the before/after value of the `items` key on an update
// entry: count and Items total for the one-line summary, plus the full lists
// so removed lines stay visible (BR-12).
func auditLinesSummary(lines repository.TransactionLines) map[string]any {
	return map[string]any{
		"count":       len(lines.Items),
		"items_total": itemsTotal(lines),
		"items":       auditItems(lines.Items),
		"adjustments": auditAdjustments(lines.Adjustments),
	}
}

// addLinesToSnapshot adds the lists to a create/delete snapshot when the
// Transaction has any, the same "only when present" rule as location.
func addLinesToSnapshot(snapshot map[string]any, t *model.Transaction) {
	if len(t.Items) == 0 && len(t.Adjustments) == 0 {
		return
	}
	snapshot["items"] = auditItems(t.Items)
	snapshot["adjustments"] = auditAdjustments(t.Adjustments)
}

func auditItems(items []model.TransactionItem) []map[string]any {
	out := make([]map[string]any, 0, len(items))
	for _, item := range items {
		out = append(out, map[string]any{
			"name":       item.Name,
			"quantity":   item.Quantity,
			"unit_price": item.UnitPrice,
			"amount":     item.Amount,
		})
	}
	return out
}

func auditAdjustments(adjustments []model.TransactionAdjustment) []map[string]any {
	out := make([]map[string]any, 0, len(adjustments))
	for _, adjustment := range adjustments {
		direction := dto.AdjustmentDirectionAdd
		if adjustment.Sign == model.LineSignSubtract {
			direction = dto.AdjustmentDirectionSubtract
		}
		out = append(out, map[string]any{
			"kind":      string(adjustment.Kind),
			"direction": direction,
			"label":     adjustment.Label,
			"amount":    adjustment.Amount,
		})
	}
	return out
}
