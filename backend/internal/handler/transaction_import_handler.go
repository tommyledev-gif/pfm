package handler

import (
	"io"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/dto"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// TransactionImportHandler is HTTP-only for the two import endpoints
// (specs/transaction-export-import/spec.md US-02, US-03). Row validation,
// name resolution, token issuance and the commit loop all live in
// TransactionImportService — nothing here decides whether a row is importable.
type TransactionImportHandler struct {
	importService *service.TransactionImportService
	logger        *zap.Logger
}

func NewTransactionImportHandler(importService *service.TransactionImportService, logger *zap.Logger) *TransactionImportHandler {
	return &TransactionImportHandler{importService: importService, logger: logger}
}

// Preview handles POST /transactions/import/preview (multipart, field
// "file"). Multipart handling mirrors WalletHandler.UploadIcon's exact shape
// — size check off the header before opening, then io.ReadAll — with two
// differences: the cap is 5MB, and the file is never sent to object storage.
// It exists in memory only for this request (spec.md US-02 Edge Cases: the
// upload itself is never persisted, only the derived buckets and the token).
//
// There is no Content-Type allow-list here, unlike the icon uploaders:
// excelize's own parse is the content validation (spec.md Edge Cases US-02
// #3), and a browser/RN file picker's Content-Type for .xlsx is inconsistent
// enough that gating on it would reject valid files.
func (h *TransactionImportHandler) Preview(c *fiber.Ctx) error {
	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("thiếu trường \"file\" trong multipart body"))
	}
	if fileHeader.Size > common.TransactionImportMaxUploadBytes {
		return response.Error(c, h.logger, common.NewInvalidInputError("tệp vượt quá giới hạn 5MB"))
	}

	file, err := fileHeader.Open()
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("không đọc được tệp tải lên"))
	}
	defer file.Close() //nolint:errcheck // read-only handle, nothing to flush

	data, err := io.ReadAll(file)
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("không đọc được tệp tải lên"))
	}

	result, err := h.importService.PreviewImport(c.Context(), userID, data)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "import preview generated successfully", result)
}

// Commit handles POST /transactions/import/commit.
func (h *TransactionImportHandler) Commit(c *fiber.Ctx) error {
	var req dto.ImportCommitRequest
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

	result, err := h.importService.CommitImport(c.Context(), userID, req)
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "import committed successfully", result)
}
