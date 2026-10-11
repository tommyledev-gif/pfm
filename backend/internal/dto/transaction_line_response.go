package dto

import "github.com/example/pfm/backend/internal/model"

// TransactionItemResponse / TransactionAdjustmentResponse are the `items` /
// `adjustments` entries of a single-Transaction response
// (specs/transaction-line-items US-02). Money is integer minor units.
type TransactionItemResponse struct {
	Name      string `json:"name"`
	Quantity  int32  `json:"quantity"`
	UnitPrice *int64 `json:"unit_price"`
	Amount    int64  `json:"amount"`
}

type TransactionAdjustmentResponse struct {
	Kind      string  `json:"kind"`
	Direction string  `json:"direction"`
	Label     *string `json:"label"`
	Amount    int64   `json:"amount"`
}

// newLineResponses returns nil slices when the lines were not loaded (list
// rows), so the JSON omits both keys; loaded-but-empty lines marshal as [].
func newLineResponses(t *model.Transaction) (*[]TransactionItemResponse, *[]TransactionAdjustmentResponse) {
	if t.Items == nil && t.Adjustments == nil {
		return nil, nil
	}
	items := make([]TransactionItemResponse, 0, len(t.Items))
	for _, item := range t.Items {
		items = append(items, TransactionItemResponse{
			Name:      item.Name,
			Quantity:  item.Quantity,
			UnitPrice: item.UnitPrice,
			Amount:    item.Amount,
		})
	}
	adjustments := make([]TransactionAdjustmentResponse, 0, len(t.Adjustments))
	for _, adjustment := range t.Adjustments {
		direction := AdjustmentDirectionAdd
		if adjustment.Sign == model.LineSignSubtract {
			direction = AdjustmentDirectionSubtract
		}
		adjustments = append(adjustments, TransactionAdjustmentResponse{
			Kind:      string(adjustment.Kind),
			Direction: direction,
			Label:     adjustment.Label,
			Amount:    adjustment.Amount,
		})
	}
	return &items, &adjustments
}
