package handler

import (
	"io"

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
	iconUploader    service.IconUploader
	logger          *zap.Logger
}

func NewCategoryHandler(categoryService *service.CategoryService, iconUploader service.IconUploader, logger *zap.Logger) *CategoryHandler {
	return &CategoryHandler{categoryService: categoryService, iconUploader: iconUploader, logger: logger}
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

// UploadIcon handles POST /categories/icon (multipart, field "file") — a
// standalone upload step rather than part of Create/Update, so a client can
// pick an image before a category exists yet (the create form) and reuse
// the same returned icon_url on both Create and Update requests.
func (h *CategoryHandler) UploadIcon(c *fiber.Ctx) error {
	if _, err := callerUUID(c); err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("missing \"file\" in multipart body"))
	}
	if fileHeader.Size > common.CategoryIconMaxUploadBytes {
		return response.Error(c, h.logger, common.NewInvalidInputError("icon file exceeds the 2MB size limit"))
	}
	contentType := fileHeader.Header.Get("Content-Type")
	if !common.CategoryIconAllowedContentTypes[contentType] {
		return response.Error(c, h.logger, common.NewInvalidInputError("icon must be a PNG, JPEG, or SVG image"))
	}

	file, err := fileHeader.Open()
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("could not read uploaded file"))
	}
	defer file.Close() //nolint:errcheck // read-only handle, nothing to flush

	data, err := io.ReadAll(file)
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("could not read uploaded file"))
	}

	iconURL, err := h.iconUploader.UploadIcon(c.Context(), common.CategoryIconKeyPrefix, fileHeader.Filename, contentType, data)
	if err != nil {
		h.logger.Error("icon upload failed", zap.Error(err))
		if _, unconfigured := h.iconUploader.(service.UnconfiguredIconUploader); unconfigured {
			return response.Error(c, h.logger, common.ErrIconUploadUnavailable)
		}
		return response.Error(c, h.logger, common.ErrIconUploadFailed)
	}

	return response.Success(c, fiber.StatusOK, "icon uploaded successfully", fiber.Map{"icon_url": iconURL})
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
