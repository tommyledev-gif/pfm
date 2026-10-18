package common

import "net/http"

// Image capture error codes (specs/ai-chat-image-capture plan §5). The
// messages reach the UI as-is when the client has no copy of its own for a
// code, so they follow the pfm-ux-copy skill.
const (
	ErrCodeImageTooLarge        = "IMAGE_TOO_LARGE"
	ErrCodeUnsupportedImageType = "UNSUPPORTED_IMAGE_TYPE"
	ErrCodeAIImageBusy          = "AI_IMAGE_BUSY"
	ErrCodeAIImageDisabled      = "AI_IMAGE_DISABLED"
)

var (
	ErrImageTooLarge = &AppError{Code: ErrCodeImageTooLarge, Status: http.StatusRequestEntityTooLarge, Message: "Ảnh quá lớn. Chọn ảnh khác."}
	// Same wording as the icon upload's type error (handler/image_upload.go).
	ErrUnsupportedImageType = &AppError{Code: ErrCodeUnsupportedImageType, Status: http.StatusUnsupportedMediaType, Message: "Chỉ nhận ảnh PNG, JPEG hoặc WebP."}
	// ErrAIImageDisabled: the operator switch is off (spec BR-18).
	ErrAIImageDisabled = &AppError{Code: ErrCodeAIImageDisabled, Status: http.StatusServiceUnavailable, Message: "Đọc ảnh đang tạm dừng."}
)

// aiImageBusyDefaultMessage is used as-is only by a client without its own
// copy; mobile builds the minutes from details.retry_after_seconds.
const aiImageBusyDefaultMessage = "Chưa đọc được ảnh. Thử lại sau 1 phút."

// NewAIImageBusyError: the provider is out of capacity (spec BR-19).
// retryAfterSeconds is nil when the provider gave no wait time.
func NewAIImageBusyError(retryAfterSeconds *int) *AppError {
	return &AppError{
		Code:    ErrCodeAIImageBusy,
		Status:  http.StatusServiceUnavailable,
		Message: aiImageBusyDefaultMessage,
		Details: map[string]interface{}{"retry_after_seconds": retryAfterSeconds},
	}
}
