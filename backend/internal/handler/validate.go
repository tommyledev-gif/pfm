package handler

import (
	"fmt"

	"github.com/go-playground/validator/v10"

	"github.com/example/pfm/backend/internal/common"
)

var validate = validator.New()

// fieldError is one entry in a 400 response's `details` array — every
// failing field is reported at once, not just the first (implementation-checklist:
// "Validation errors collected and returned as a single structured response").
type fieldError struct {
	Field string `json:"field"`
	Rule  string `json:"rule"`
}

// newValidationError wraps a bind/validate failure as a single
// 400 INVALID_INPUT AppError whose Details lists every failing field.
func newValidationError(err error) *common.AppError {
	verrs, ok := err.(validator.ValidationErrors)
	if !ok || len(verrs) == 0 {
		return common.NewInvalidInputError("request validation failed")
	}

	details := make([]fieldError, 0, len(verrs))
	for _, fe := range verrs {
		details = append(details, fieldError{Field: fe.Field(), Rule: fe.Tag()})
	}

	message := fmt.Sprintf("field '%s' failed validation: %s", verrs[0].Field(), verrs[0].Tag())
	return common.NewInvalidInputErrorWithDetails(message, details)
}
