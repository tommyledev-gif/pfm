package dto

// CreateCategoryRequest is the body of POST /categories. Length limits here
// mirror common.CategoryNameMaxLength/CategoryIconMaxLength — validator/v10
// struct tags are compile-time string literals and cannot reference a Go
// const, so the numbers are kept in sync by convention (same as
// CreateWalletRequest's max=100 mirroring common.WalletNameMaxLength).
type CreateCategoryRequest struct {
	Name string  `json:"name" validate:"required,max=50"`
	Icon *string `json:"icon" validate:"omitempty,max=32"`
	Type string  `json:"type" validate:"required,oneof=income expense"`
}

// UpdateCategoryRequest is the body of PATCH /categories/{id}. Deliberately
// has no `type` field at the type level (spec.md: "type is never accepted by
// this endpoint") — decoded via the existing dto.DecodeStrict (already used
// by UpdateWalletRequest) so an unrecognized field like "type" is rejected
// with 400, not silently ignored.
type UpdateCategoryRequest struct {
	Name *string `json:"name" validate:"omitempty,max=50"`
	Icon *string `json:"icon" validate:"omitempty,max=32"`
}

// HasUpdates reports whether at least one field was supplied — an empty
// body is a client mistake (400), not a no-op 200 (spec.md S-CAT-25).
func (r UpdateCategoryRequest) HasUpdates() bool {
	return r.Name != nil || r.Icon != nil
}
