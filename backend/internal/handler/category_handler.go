package handler

import (
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// CategoryHandler is HTTP-only for F-04 (Category Management): parse
// request, call service, map result to a response. No business logic lives
// here — duplicate-checking, the system-category write guard, and the
// visibility split are all in CategoryService.
//
// CSRF: not applicable — Bearer-JWT API, no cookie/session auth surface
// (same reasoning as WalletHandler).
type CategoryHandler struct {
	categoryService *service.CategoryService
	logger          *zap.Logger
}

func NewCategoryHandler(categoryService *service.CategoryService, logger *zap.Logger) *CategoryHandler {
	return &CategoryHandler{categoryService: categoryService, logger: logger}
}

// CreateCategory handles POST /categories (registered behind JWTAuth only —
// every active user manages only their own categories, no role gate).
func (h *CategoryHandler) CreateCategory(c *fiber.Ctx) error {
	var req dto.CreateCategoryRequest
	if err := c.BodyParser(&req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	category, err := h.categoryService.CreateCategory(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusCreated, "category created successfully", dto.NewCategoryResponse(category))
}

// ListCategories handles GET /categories (optional ?type=income|expense).
func (h *CategoryHandler) ListCategories(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	categoryType, err := categoryTypeQueryParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	categories, err := h.categoryService.ListCategories(c.Context(), userID, categoryType)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "categories retrieved successfully", dto.NewListCategoriesResponse(categories))
}

// GetCategory handles GET /categories/:id.
func (h *CategoryHandler) GetCategory(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	categoryID, err := categoryIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	category, err := h.categoryService.GetCategory(c.Context(), userID, categoryID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "category retrieved successfully", dto.NewCategoryResponse(category))
}

// UpdateCategory handles PATCH /categories/:id. Uses dto.DecodeStrict instead
// of c.BodyParser so an unrecognized "type" (or any other) field is rejected
// with 400 rather than silently ignored (plan.md Finding #6).
func (h *CategoryHandler) UpdateCategory(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	categoryID, err := categoryIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	var req dto.UpdateCategoryRequest
	if err := dto.DecodeStrict(c.Body(), &req); err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("malformed request body or unrecognized field"))
	}
	if err := validate.Struct(req); err != nil {
		return response.Error(c, h.logger, newValidationError(err))
	}

	category, err := h.categoryService.UpdateCategory(c.Context(), userID, categoryID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "category updated successfully", dto.NewCategoryResponse(category))
}

// DeleteCategory handles DELETE /categories/:id. The active-Budget block
// (spec.md S-CAT-27) is not implemented yet — see CategoryService.DeleteCategory.
func (h *CategoryHandler) DeleteCategory(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}
	categoryID, err := categoryIDParam(c)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	category, err := h.categoryService.DeleteCategory(c.Context(), userID, categoryID)
	if err != nil {
		return response.Error(c, h.logger, err)
	}

	return response.Success(c, fiber.StatusOK, "category deleted successfully", dto.NewCategoryResponse(category))
}

// categoryIDParam parses the :id path segment, returning 400 INVALID_INPUT
// (spec.md S-CAT-18) before any service/DB call for a malformed UUID.
func categoryIDParam(c *fiber.Ctx) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.UUID{}, common.NewInvalidInputError("category id must be a valid UUID")
	}
	return id, nil
}

// categoryTypeQueryParam validates an optional ?type= filter against the
// allowed enum before it ever reaches the repository (spec.md S-CAT-13) —
// an empty query param means "no filter", not an error.
func categoryTypeQueryParam(c *fiber.Ctx) (*string, error) {
	raw := c.Query("type")
	if raw == "" {
		return nil, nil
	}
	if raw != "income" && raw != "expense" {
		return nil, common.NewInvalidInputError("type must be one of: income, expense")
	}
	return &raw, nil
}
