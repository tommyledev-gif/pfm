package model

// LineKind is the kind of a transaction_lines row (029_transaction_lines.sql).
// LineKindItem is an Item; every other kind is an Adjustment.
type LineKind string

const (
	LineKindItem     LineKind = "item"
	LineKindTax      LineKind = "tax"
	LineKindFee      LineKind = "fee"
	LineKindDiscount LineKind = "discount"
	LineKindOther    LineKind = "other"
)

// LineSign is a line's effect on the computed total: +1 adds, -1 subtracts.
type LineSign int16

const (
	LineSignAdd      LineSign = 1
	LineSignSubtract LineSign = -1
)

// TransactionItem is one line of what was bought or received
// (specs/transaction-line-items BR-03). It has no Category of its own — it
// belongs to its Transaction's Category. Money fields are integer minor units
// of the Transaction's Wallet currency.
type TransactionItem struct {
	Name      string
	Quantity  int32
	UnitPrice *int64
	Amount    int64
}

// TransactionAdjustment explains part of the gap between the Items total and
// the Transaction amount (BR-06). Label is required for LineKindOther only.
type TransactionAdjustment struct {
	Kind   LineKind
	Sign   LineSign
	Label  *string
	Amount int64
}

// SignedAmount is the Adjustment's contribution to the computed total.
func (a TransactionAdjustment) SignedAmount() int64 {
	return int64(a.Sign) * a.Amount
}
