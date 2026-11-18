package model

import (
	"time"

	"github.com/google/uuid"
)

// SpendingIntention is something the User plans to spend on
// (specs/ai-chat-spending-intentions). Amounts are int64 xu, never float.
// TargetMonth is the first day of the local month the first (or only) payment
// falls in, as a UTC-midnight date.
type SpendingIntention struct {
	ID                uuid.UUID
	UserID            uuid.UUID
	Title             string
	Kind              string
	CategoryID        *uuid.UUID
	Currency          string
	TotalAmount       *int64
	MonthlyAmount     *int64
	InstallmentMonths *int
	TargetMonth       time.Time
	Note              *string
	IdempotencyKey    *string
	CreatedAt         time.Time
	UpdatedAt         time.Time
	DeletedAt         *time.Time
}

// Months is how many months the plan takes payments in: one for a one-time
// purchase.
func (i SpendingIntention) Months() int {
	if i.InstallmentMonths != nil {
		return *i.InstallmentMonths
	}
	return 1
}

// MonthlyBurden is what one month pays: the payment of an instalment plan, or
// the price of a one-time purchase. Nil while a one-time purchase has no price.
func (i SpendingIntention) MonthlyBurden() *int64 {
	if i.MonthlyAmount != nil {
		return i.MonthlyAmount
	}
	return i.TotalAmount
}

// ParseKindIntention is the interpreter's verdict for a message that describes
// something the User plans to buy (AI Service `kind: "intention"`).
const (
	ParseKindIntention               = "intention"
	ConsultKindIntention ConsultKind = "intention"
)
