package handler

import (
	"errors"
	"fmt"
	"io"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/imageupload"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// readImageUpload reads the multipart "file" field and returns it validated
// and re-encoded by imageupload.Process. Every image-upload endpoint (the
// three entity icons and the avatar) goes through here, so the rules live in
// one place and none of them depends on what the client declared.
//
// The messages reach the UI as-is (mobile shows the envelope's message), so
// they follow the pfm-ux-copy skill.
func readImageUpload(c *fiber.Ctx) (*imageupload.Image, error) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		return nil, common.NewInvalidInputError("Chưa chọn ảnh.")
	}
	maxBytes := common.CategoryIconMaxUploadBytes
	if fileHeader.Size > int64(maxBytes) {
		return nil, imageTooLarge(maxBytes)
	}

	file, err := fileHeader.Open()
	if err != nil {
		return nil, common.NewInvalidInputError("Không đọc được ảnh này. Chọn ảnh khác.")
	}
	defer file.Close() //nolint:errcheck // read-only handle, nothing to flush

	// One byte past the limit is enough to tell "too large" from "fits".
	data, err := io.ReadAll(io.LimitReader(file, int64(maxBytes)+1))
	if err != nil {
		return nil, common.NewInvalidInputError("Không đọc được ảnh này. Chọn ảnh khác.")
	}

	img, err := imageupload.Process(data, maxBytes)
	switch {
	case err == nil:
		return img, nil
	case errors.Is(err, imageupload.ErrTooLarge):
		return nil, imageTooLarge(maxBytes)
	case errors.Is(err, imageupload.ErrUnsupportedType):
		return nil, common.NewInvalidInputError("Chỉ nhận ảnh PNG, JPEG hoặc WebP.")
	case errors.Is(err, imageupload.ErrDimensions):
		return nil, common.NewInvalidInputError("Kích thước ảnh quá lớn. Chọn ảnh nhỏ hơn.")
	default:
		return nil, common.NewInvalidInputError("Không đọc được ảnh này. Chọn ảnh khác.")
	}
}

// uploadIcon is the whole of POST /wallets/icon, /categories/icon and
// /budgets/icon (multipart, field "file"): a standalone upload step, so a
// client can pick an image before the entity exists (the create form) and
// send the returned icon_url with Create or Update. The three differ only in
// keyPrefix, the folder their icons are stored under.
func uploadIcon(c *fiber.Ctx, uploader service.IconUploader, keyPrefix string, logger *zap.Logger) error {
	if _, err := callerUUID(c); err != nil {
		return response.Error(c, logger, common.ErrUnauthenticated)
	}

	img, err := readImageUpload(c)
	if err != nil {
		return response.Error(c, logger, err)
	}

	iconURL, err := uploader.UploadIcon(c.Context(), keyPrefix, img.ContentType, img.Data)
	if err != nil {
		logger.Error("icon upload failed", zap.Error(err))
		if _, unconfigured := uploader.(service.UnconfiguredIconUploader); unconfigured {
			return response.Error(c, logger, common.ErrIconUploadUnavailable)
		}
		return response.Error(c, logger, common.ErrIconUploadFailed)
	}

	return response.Success(c, fiber.StatusOK, "icon uploaded successfully", fiber.Map{"icon_url": iconURL})
}

func imageTooLarge(maxBytes int) error {
	return common.NewInvalidInputError(fmt.Sprintf("Ảnh lớn hơn %d MB. Chọn ảnh nhỏ hơn.", maxBytes>>20))
}
