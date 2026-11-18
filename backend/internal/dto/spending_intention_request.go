package dto

import "github.com/google/uuid"

// SpendingIntentionRequest is the editable set of a spending intention
// (specs/ai-chat-spending-intentions): the body of a create and of an edit.
// An edit replaces the whole set, so the client always sends every field.
//
// Amounts are integer xu. TargetMonth is "YYYY-MM"; empty means the current
// cycle's month. Shape is checked here (types, lengths); the business rules
// (one-time vs instalment fields, Category, month window) are the service's.
type SpendingIntentionRequest struct {
	Title             string     `json:"title" validate:"required,max=80"`
	Kind              string     `json:"kind" validate:"required,oneof=one_time installment"`
	CategoryID        *uuid.UUID `json:"category_id"`
	Currency          string     `json:"currency" validate:"omitempty,len=3"`
	TotalAmount       *int64     `json:"total_amount" validate:"omitempty,min=1"`
	MonthlyAmount     *int64     `json:"monthly_amount" validate:"omitempty,min=1"`
	InstallmentMonths *int       `json:"installment_months" validate:"omitempty,min=1"`
	TargetMonth       string     `json:"target_month" validate:"omitempty,len=7"`
	Note              *string    `json:"note" validate:"omitempty,max=300"`
}

// CreateSpendingIntentionRequest adds the card's own key: saving the same card
// twice keeps one intention.
type CreateSpendingIntentionRequest struct {
	SpendingIntentionRequest
	IdempotencyKey string `json:"idempotency_key" validate:"omitempty,max=100"`
}
