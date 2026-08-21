package handler

import (
	"fmt"
	"reflect"

	"github.com/go-playground/validator/v10"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
)

var validate = validator.New()

func init() {
	// Lets `validate:"omitempty,max=N"` on a dto.OptionalString field
	// validate its inner Value exactly like a plain *string would —
	// "absent" (Set=false) and "explicit null" (Value=nil) both extract to a
	// nil interface, which omitempty treats as empty and skips further rules,
	// same as it already does for a nil *string
	// (specs/wallet-budget-icons/plan.md Finding #1: OptionalString exists so
	// the *service* layer can still tell those two cases apart — validator
	// intentionally does not need to).
	validate.RegisterCustomTypeFunc(func(field reflect.Value) interface{} {
		opt, ok := field.Interface().(dto.OptionalString)
		if !ok || !opt.Set || opt.Value == nil {
			return nil
		}
		return *opt.Value
	}, dto.OptionalString{})
}

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
