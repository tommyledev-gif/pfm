package handler

import (
	"io"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"
	"go.uber.org/zap"

	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/response"
	"github.com/example/pfm/backend/internal/service"
)

// ChatImageHandler serves POST /transactions/image-proposals
// (specs/ai-chat-image-capture plan §3.3). Shape checks only — business
// rules live in ChatImageService. ⚠️ Never logs the image or the caption.
type ChatImageHandler struct {
	service *service.ChatImageService
	enabled bool
	logger  *zap.Logger
}

func NewChatImageHandler(svc *service.ChatImageService, enabled bool, logger *zap.Logger) *ChatImageHandler {
	return &ChatImageHandler{service: svc, enabled: enabled, logger: logger}
}

// Switch refuses every request while the operator switch is off (spec BR-18).
// Registered before the image rate limiter, so a refused request never counts.
func (h *ChatImageHandler) Switch(c *fiber.Ctx) error {
	if !h.enabled {
		return response.Error(c, h.logger, common.ErrAIImageDisabled)
	}
	return c.Next()
}

func (h *ChatImageHandler) ProposeFromImage(c *fiber.Ctx) error {
	fileHeader, fileErr := c.FormFile(common.AIImageFormFieldImage)
	caption := strings.TrimSpace(c.FormValue(common.AIImageFormFieldCaption))

	// Independent shape checks are reported together (plan §3.3).
	var problems []fieldError
	if fileErr != nil {
		problems = append(problems, fieldError{Field: "Image", Rule: "required"})
	}
	if utf8.RuneCountInString(caption) > common.AIImageCaptionMaxLength {
		problems = append(problems, fieldError{Field: "Caption", Rule: "max"})
	}
	if len(problems) > 0 {
		return response.Error(c, h.logger, common.NewInvalidInputErrorWithDetails("image or caption failed validation", problems))
	}

	if fileHeader.Size > int64(common.AIImageMaxUploadBytes) {
		return response.Error(c, h.logger, common.ErrImageTooLarge)
	}
	file, err := fileHeader.Open()
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("Không đọc được ảnh này. Chọn ảnh khác."))
	}
	defer file.Close() //nolint:errcheck // read-only handle, nothing to flush

	// One byte past the limit is enough to tell "too large" from "fits".
	data, err := io.ReadAll(io.LimitReader(file, int64(common.AIImageMaxUploadBytes)+1))
	if err != nil {
		return response.Error(c, h.logger, common.NewInvalidInputError("Không đọc được ảnh này. Chọn ảnh khác."))
	}
	if len(data) > common.AIImageMaxUploadBytes {
		return response.Error(c, h.logger, common.ErrImageTooLarge)
	}
	mimeType := sniffImageType(data)
	if !common.AIImageAllowedContentTypes[mimeType] {
		return response.Error(c, h.logger, common.ErrUnsupportedImageType)
	}

	userID, err := callerUUID(c)
	if err != nil {
		return response.Error(c, h.logger, common.ErrUnauthenticated)
	}

	var captionPtr *string
	if caption != "" {
		captionPtr = &caption
	}
	resp, err := h.service.ProposeFromImage(c.Context(), userID, service.ImageProposalInput{
		Image: data, MIMEType: mimeType, Caption: captionPtr,
	})
	if err != nil {
		return response.Error(c, h.logger, err)
	}
	return response.Success(c, fiber.StatusOK, "image read", resp)
}

// sniffImageType decides the type from the bytes only — the file name and the
// declared Content-Type are never trusted (spec S-AIIMG-17).
func sniffImageType(data []byte) string {
	head := data
	if len(head) > common.AIImageSniffBytes {
		head = head[:common.AIImageSniffBytes]
	}
	return http.DetectContentType(head)
}
