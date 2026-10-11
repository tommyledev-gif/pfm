package dto

// TransactionItemRequest is one entry of `items` on POST/PATCH /transactions
// (specs/transaction-line-items BR-03). Tags repeat common.TransactionLine*/
// TransactionItemQuantityMax/MaxTransactionAmountCents as literals — struct
// tags cannot reference a const; keep them in step by hand. Quantity is
// optional and defaults to 1 in the service.
type TransactionItemRequest struct {
	Name      string `json:"name" validate:"required,max=100"`
	Quantity  *int32 `json:"quantity" validate:"omitempty,gte=1,lte=9999"`
	UnitPrice *int64 `json:"unit_price" validate:"omitempty,gt=0,lte=99999999999999"`
	Amount    int64  `json:"amount" validate:"required,gt=0,lte=99999999999999"`
}

// TransactionAdjustmentRequest is one entry of `adjustments` (BR-06).
// Direction is required for kind "other" and must agree with the kind's fixed
// direction otherwise; Label is required for "other". Both checks live in the
// service (they depend on Kind).
type TransactionAdjustmentRequest struct {
	Kind      string  `json:"kind" validate:"required,oneof=tax fee discount other"`
	Direction *string `json:"direction" validate:"omitempty,oneof=add subtract"`
	Label     *string `json:"label" validate:"omitempty,max=100"`
	Amount    int64   `json:"amount" validate:"required,gt=0,lte=99999999999999"`
}

// Wire values of TransactionAdjustmentRequest.Direction / the response's
// `direction`.
const (
	AdjustmentDirectionAdd      = "add"
	AdjustmentDirectionSubtract = "subtract"
)
