package common

import "net/http"

// Error code constants returned in the API's { error_code, message, details? }
// response shape (CLAUDE.md API Design). Never construct these as raw strings
// elsewhere — always go through AppError / the sentinel errors below.
const (
	ErrCodeInvalidInput        = "INVALID_INPUT"
	ErrCodeEmailAlreadyExists  = "EMAIL_ALREADY_EXISTS"
	ErrCodeForbidden           = "FORBIDDEN"
	ErrCodeNotFound            = "NOT_FOUND"
	ErrCodeTokenExpired        = "TOKEN_EXPIRED"
	ErrCodeWeakPassword        = "WEAK_PASSWORD"
	ErrCodePasswordMismatch    = "PASSWORD_MISMATCH"
	ErrCodeRateLimited         = "RATE_LIMITED"
	ErrCodeInvalidCredentials  = "INVALID_CREDENTIALS"
	ErrCodeAccountNotActivated = "ACCOUNT_NOT_ACTIVATED"
	ErrCodeAccountDisabled     = "ACCOUNT_DISABLED"
	// ErrCodeUnauthenticated is used for missing/invalid/expired JWTs. Neither
	// spec.md nor plan.md names a specific code for this case (their Error
	// Flows tables show "—"), so this is an implementation-level choice made
	// to keep the API's error shape ({error_code, message}) consistent even
	// on 401s rather than sending an empty error_code.
	ErrCodeUnauthenticated = "UNAUTHENTICATED"
	// ErrCodeWalletAccessDenied and ErrCodeWalletNotFound (F-03 Wallet
	// Management) are deliberately distinct — a wallet owned by someone else
	// is a 403, not a 404, since wallet IDs are unguessable UUIDv4s with no
	// meaningful enumeration risk (specs/wallet-management/spec.md S-WAL-16).
	ErrCodeWalletAccessDenied = "WALLET_ACCESS_DENIED"
	ErrCodeWalletNotFound     = "WALLET_NOT_FOUND"
	// ErrCodeCategoryAccessDenied/ErrCodeCategoryNotFound (F-04 Category
	// Management) follow the same 403-vs-404 split as Wallet's equivalents —
	// unguessable UUIDv4 IDs, so "belongs to someone else" (or is a
	// never-writable system category) is a 403, not a 404
	// (specs/category-management/spec.md S-CAT-16/S-CAT-20).
	ErrCodeCategoryAccessDenied  = "CATEGORY_ACCESS_DENIED"
	ErrCodeCategoryNotFound      = "CATEGORY_NOT_FOUND"
	ErrCodeCategoryAlreadyExists = "CATEGORY_ALREADY_EXISTS"
	// ErrCodeCategoryInUse backs the active-Budget delete guard (spec.md
	// S-CAT-27) — wired up in F-05's plan.md Finding #2 / BUD-T16, now that
	// the budgets table exists.
	ErrCodeCategoryInUse = "CATEGORY_IN_USE"
	// ErrCodeBudgetAccessDenied/ErrCodeBudgetNotFound (F-05 Budget
	// Management) follow the same 403-vs-404 split as Wallet/Category's
	// equivalents — unguessable UUIDv4 IDs (specs/budget-management/spec.md
	// S-BUD-24/S-BUD-25).
	ErrCodeBudgetAccessDenied = "BUDGET_ACCESS_DENIED"
	ErrCodeBudgetNotFound     = "BUDGET_NOT_FOUND"
	// ErrCodeBudgetAlreadyExists backs the one-active-Budget-per-category
	// invariant (spec.md S-BUD-11/S-BUD-13).
	ErrCodeBudgetAlreadyExists = "BUDGET_ALREADY_EXISTS"
	// ErrCodeInvalidCategoryType backs the "Budget category must be
	// expense-type" business rule (spec.md S-BUD-03). 422, not 400 — the
	// request is well-formed, the referenced Category simply isn't eligible.
	ErrCodeInvalidCategoryType = "INVALID_CATEGORY_TYPE"
	// ErrCodeTransactionAccessDenied/ErrCodeTransactionNotFound (F-06
	// Transaction Management) follow the same 403-vs-404 split as Wallet/
	// Category/Budget's equivalents — unguessable UUIDv4 IDs
	// (specs/transaction-management/spec.md S-TRX-32/S-TRX-33).
	ErrCodeTransactionAccessDenied = "TRANSACTION_ACCESS_DENIED"
	ErrCodeTransactionNotFound     = "TRANSACTION_NOT_FOUND"
	// ErrCodeInsufficientBalance backs the insufficient-balance floor on
	// expense Transaction creation only — never Update/Delete
	// (specs/transaction-management/spec.md Context #3, S-TRX-09/S-TRX-18).
	// 409, grouped with the other "conflict with current resource state"
	// codes (BUDGET_ALREADY_EXISTS, CATEGORY_IN_USE, CURRENCY_LOCKED).
	ErrCodeInsufficientBalance = "INSUFFICIENT_BALANCE"
	// ErrCodeCategoryTypeMismatch backs the "Transaction type must match its
	// Category's type" business rule (spec.md S-TRX-14/S-TRX-40). 422, same
	// reasoning as ErrCodeInvalidCategoryType — the request is well-formed,
	// the referenced Category simply isn't eligible for this Transaction's type.
	ErrCodeCategoryTypeMismatch = "CATEGORY_TYPE_MISMATCH"
	// ErrCodeTransferSameWallet / ErrCodeTransferCurrencyMismatch back the
	// transfer rules: the two Wallets must differ, and share one currency —
	// there is no exchange-rate conversion, so a cross-currency transfer
	// could not keep both balances honest. 422, same reasoning as
	// ErrCodeCategoryTypeMismatch.
	ErrCodeTransferSameWallet        = "TRANSFER_SAME_WALLET"
	ErrCodeTransferCurrencyMismatch  = "TRANSFER_CURRENCY_MISMATCH"
	ErrCodeTransferCategoryImmutable = "TRANSFER_CATEGORY_IMMUTABLE"
	// ErrCodeCurrencyLocked backs F-03's long-deferred 409 CURRENCY_LOCKED
	// check (specs/wallet-management/spec.md S-WAL-21) — wired up by
	// specs/transaction-management/plan.md Finding #2 / WAL-T14 now that the
	// transactions table exists. Was previously only described in a
	// wallet_service.go comment, never actually defined.
	ErrCodeCurrencyLocked = "CURRENCY_LOCKED"
	// ErrCodeNotificationAccessDenied/ErrCodeNotificationNotFound (F-10
	// Notification Handling) follow the same 403-vs-404 split as every prior
	// feature's equivalents — unguessable UUIDv4 IDs
	// (specs/notification-handling/spec.md S-NOT-14/S-NOT-15).
	ErrCodeNotificationAccessDenied = "NOTIFICATION_ACCESS_DENIED"
	ErrCodeNotificationNotFound     = "NOTIFICATION_NOT_FOUND"
	// ErrCodeAIServiceUnavailable backs POST /ai/chat's 502 when the AI
	// Service is unreachable or times out (Groq and Anthropic both failing
	// inside that service) — a system error, never surfaced with internal
	// detail (specs/ai-chat-assistant/spec.md S-AI-10).
	ErrCodeAIServiceUnavailable = "AI_SERVICE_UNAVAILABLE"
	// ErrCodeIconUploadUnavailable backs POST /categories/icon's 503 when R2
	// isn't configured (no R2_ACCOUNT_ID/etc — see config.Config) — same
	// "degrade the one endpoint, don't fail startup" convention as
	// ErrCodeAIServiceUnavailable.
	ErrCodeIconUploadUnavailable = "ICON_UPLOAD_UNAVAILABLE"
	// ErrCodeIconUploadFailed backs POST /categories/icon's 502 when R2 is
	// configured but the upload itself fails (network/auth/bucket error).
	ErrCodeIconUploadFailed = "ICON_UPLOAD_FAILED"
	// ErrCodeDuplicateCategoryInRequest backs POST /budgets/bulk's 422 when
	// the same category_id appears twice in one request
	// (specs/ai-budget-wizard/spec.md S-BWZ-23).
	ErrCodeDuplicateCategoryInRequest = "DUPLICATE_CATEGORY_IN_REQUEST"
	// ErrCodeTooManyBudgets backs POST /budgets/bulk's 422 when the request
	// exceeds the 20-item cap (specs/ai-budget-wizard/spec.md S-BWZ-25).
	ErrCodeTooManyBudgets = "TOO_MANY_BUDGETS"

	// F-13.1 AI Budget Setup Wizard v2 (specs/ai-budget-wizard-v2/plan.md
	// BWZ2-T11).
	//
	// ErrCodeDisposableNonPositive — fixed costs plus savings already consume
	// the whole income, so there is nothing left to budget. Distinct from a
	// generic INVALID_INPUT because the client has its own screen and message
	// for it, and because the user can actually act on it.
	ErrCodeDisposableNonPositive = "DISPOSABLE_NONPOSITIVE"
	// ErrCodeDisposableTooSmall — there is money, but not enough for this many
	// categories to each clear the minimum.
	ErrCodeDisposableTooSmall = "DISPOSABLE_TOO_SMALL"
	// ErrCodePlanVersionConflict — another device superseded the active plan
	// between this request reading it and trying to replace it.
	ErrCodePlanVersionConflict = "PLAN_VERSION_CONFLICT"
	// ErrCodeMethodNotAllowed/ErrCodeRequestError back response.Error's
	// *fiber.Error branch (SDS.md §6.1 / §12.1 Known Issues Log Items 1 & 4)
	// — a routing-level error raised by Fiber itself, before any handler
	// runs, for an unmatched HTTP verb (405) or any other framework-level
	// rejection Fiber didn't already give a 404 for (ErrCodeNotFound above
	// covers that case). These must keep their real status instead of being
	// coerced into a generic 500 INTERNAL_ERROR, which previously hid a
	// stale-deployment 404/405 behind a misleading "unexpected error occurred".
	ErrCodeMethodNotAllowed = "METHOD_NOT_ALLOWED"
	ErrCodeRequestError     = "REQUEST_ERROR"
)

// AppError is the single sentinel-error shape services return for known
// business error cases. Handlers/middleware map it to an HTTP response via
// errors.As — never by string-matching Error(). Details, when set, carries
// structured per-field validation failures (e.g. multiple invalid fields in
// one request) so the client gets every failure in a single response body
// instead of discovering them one submit at a time.
type AppError struct {
	Code    string
	Status  int
	Message string
	Details interface{}
}

func (e *AppError) Error() string {
	return e.Message
}

// Fixed-message sentinel errors for errors.Is comparisons. Errors whose
// message varies per call site (e.g. field-specific validation failures) are
// built with NewValidationError/NewWeakPasswordError instead.
var (
	ErrEmailAlreadyExists         = &AppError{Code: ErrCodeEmailAlreadyExists, Status: http.StatusConflict, Message: "đã tồn tại tài khoản với email này"}
	ErrForbidden                  = &AppError{Code: ErrCodeForbidden, Status: http.StatusForbidden, Message: "bạn không có quyền thực hiện hành động này"}
	ErrNotFound                   = &AppError{Code: ErrCodeNotFound, Status: http.StatusNotFound, Message: "không tìm thấy tài nguyên"}
	ErrTokenExpired               = &AppError{Code: ErrCodeTokenExpired, Status: http.StatusGone, Message: "liên kết mời đã hết hạn"}
	ErrRateLimited                = &AppError{Code: ErrCodeRateLimited, Status: http.StatusTooManyRequests, Message: "quá nhiều yêu cầu, vui lòng thử lại sau"}
	ErrInvalidCredentials         = &AppError{Code: ErrCodeInvalidCredentials, Status: http.StatusUnauthorized, Message: "email hoặc mật khẩu không đúng"}
	ErrAccountNotActive           = &AppError{Code: ErrCodeAccountNotActivated, Status: http.StatusUnauthorized, Message: "tài khoản này chưa được kích hoạt"}
	ErrAccountDisabled            = &AppError{Code: ErrCodeAccountDisabled, Status: http.StatusUnauthorized, Message: "tài khoản này đã bị vô hiệu hóa"}
	ErrPasswordMismatch           = &AppError{Code: ErrCodePasswordMismatch, Status: http.StatusBadRequest, Message: "mật khẩu và xác nhận mật khẩu không khớp"}
	ErrUnauthenticated            = &AppError{Code: ErrCodeUnauthenticated, Status: http.StatusUnauthorized, Message: "yêu cầu xác thực"}
	ErrWalletAccessDenied         = &AppError{Code: ErrCodeWalletAccessDenied, Status: http.StatusForbidden, Message: "bạn không có quyền truy cập ví này"}
	ErrWalletNotFound             = &AppError{Code: ErrCodeWalletNotFound, Status: http.StatusNotFound, Message: "không tìm thấy ví"}
	ErrCategoryAccessDenied       = &AppError{Code: ErrCodeCategoryAccessDenied, Status: http.StatusForbidden, Message: "bạn không có quyền truy cập danh mục này"}
	ErrCategoryNotFound           = &AppError{Code: ErrCodeCategoryNotFound, Status: http.StatusNotFound, Message: "không tìm thấy danh mục"}
	ErrCategoryInUse              = &AppError{Code: ErrCodeCategoryInUse, Status: http.StatusConflict, Message: "danh mục này đang được một ngân sách sử dụng"}
	ErrBudgetAccessDenied         = &AppError{Code: ErrCodeBudgetAccessDenied, Status: http.StatusForbidden, Message: "bạn không có quyền truy cập ngân sách này"}
	ErrBudgetNotFound             = &AppError{Code: ErrCodeBudgetNotFound, Status: http.StatusNotFound, Message: "không tìm thấy ngân sách"}
	ErrBudgetAlreadyExists        = &AppError{Code: ErrCodeBudgetAlreadyExists, Status: http.StatusConflict, Message: "danh mục này đã có một ngân sách đang hoạt động"}
	ErrInvalidCategoryType        = &AppError{Code: ErrCodeInvalidCategoryType, Status: http.StatusUnprocessableEntity, Message: "chỉ có thể đặt ngân sách cho danh mục chi tiêu"}
	ErrTransactionAccessDenied    = &AppError{Code: ErrCodeTransactionAccessDenied, Status: http.StatusForbidden, Message: "bạn không có quyền truy cập giao dịch này"}
	ErrTransactionNotFound        = &AppError{Code: ErrCodeTransactionNotFound, Status: http.StatusNotFound, Message: "không tìm thấy giao dịch"}
	ErrInsufficientBalance        = &AppError{Code: ErrCodeInsufficientBalance, Status: http.StatusConflict, Message: "Số dư không đủ"}
	ErrCategoryTypeMismatch       = &AppError{Code: ErrCodeCategoryTypeMismatch, Status: http.StatusUnprocessableEntity, Message: "loại giao dịch phải khớp với loại danh mục"}
	ErrTransferSameWallet         = &AppError{Code: ErrCodeTransferSameWallet, Status: http.StatusUnprocessableEntity, Message: "ví nguồn và ví nhận phải khác nhau"}
	ErrTransferCurrencyMismatch   = &AppError{Code: ErrCodeTransferCurrencyMismatch, Status: http.StatusUnprocessableEntity, Message: "chỉ chuyển được giữa hai ví cùng đơn vị tiền tệ"}
	ErrTransferCategoryImmutable  = &AppError{Code: ErrCodeTransferCategoryImmutable, Status: http.StatusUnprocessableEntity, Message: "không thể đổi danh mục của giao dịch chuyển khoản"}
	ErrCurrencyLocked             = &AppError{Code: ErrCodeCurrencyLocked, Status: http.StatusConflict, Message: "không thể đổi đơn vị tiền tệ khi ví đã có giao dịch"}
	ErrNotificationAccessDenied   = &AppError{Code: ErrCodeNotificationAccessDenied, Status: http.StatusForbidden, Message: "bạn không có quyền truy cập thông báo này"}
	ErrNotificationNotFound       = &AppError{Code: ErrCodeNotificationNotFound, Status: http.StatusNotFound, Message: "không tìm thấy thông báo"}
	ErrAIServiceUnavailable       = &AppError{Code: ErrCodeAIServiceUnavailable, Status: http.StatusBadGateway, Message: "trợ lý AI tạm thời không khả dụng, vui lòng thử lại"}
	ErrIconUploadUnavailable      = &AppError{Code: ErrCodeIconUploadUnavailable, Status: http.StatusServiceUnavailable, Message: "chức năng tải ảnh biểu tượng chưa được cấu hình"}
	ErrIconUploadFailed           = &AppError{Code: ErrCodeIconUploadFailed, Status: http.StatusBadGateway, Message: "không thể tải ảnh biểu tượng lên, vui lòng thử lại"}
	ErrDuplicateCategoryInRequest = &AppError{Code: ErrCodeDuplicateCategoryInRequest, Status: http.StatusUnprocessableEntity, Message: "một danh mục xuất hiện nhiều lần trong yêu cầu"}
	ErrTooManyBudgets             = &AppError{Code: ErrCodeTooManyBudgets, Status: http.StatusUnprocessableEntity, Message: "chỉ có thể tạo tối đa 20 ngân sách trong một lần"}
)

// F-13.1 AI Budget Setup Wizard v2.
var (
	ErrDisposableNonPositive = &AppError{Code: ErrCodeDisposableNonPositive, Status: http.StatusBadRequest, Message: "chi phí cố định và tiết kiệm đã vượt thu nhập, bạn xem lại giúp nhé"}
	ErrDisposableTooSmall    = &AppError{Code: ErrCodeDisposableTooSmall, Status: http.StatusBadRequest, Message: "số tiền còn lại quá nhỏ so với số danh mục bạn chọn, bạn bớt vài danh mục nhé"}
	ErrPlanVersionConflict   = &AppError{Code: ErrCodePlanVersionConflict, Status: http.StatusConflict, Message: "ngân sách vừa được cập nhật ở thiết bị khác, bạn thử lại nhé"}
)

// NewInvalidInputError builds a 400 INVALID_INPUT error with a field-specific message.
func NewInvalidInputError(message string) *AppError {
	return &AppError{Code: ErrCodeInvalidInput, Status: http.StatusBadRequest, Message: message}
}

// NewInvalidInputErrorWithDetails builds a 400 INVALID_INPUT error carrying
// every failing field in one response — never just the first (implementation-checklist:
// "Validation errors collected and returned as a single structured response").
func NewInvalidInputErrorWithDetails(message string, details interface{}) *AppError {
	return &AppError{Code: ErrCodeInvalidInput, Status: http.StatusBadRequest, Message: message, Details: details}
}

// NewWeakPasswordError builds a 400 WEAK_PASSWORD error — kept distinct from
// INVALID_INPUT because spec.md treats "too short" and "missing" as different
// codes (S-USR-13 vs S-USR-14).
func NewWeakPasswordError(message string) *AppError {
	return &AppError{Code: ErrCodeWeakPassword, Status: http.StatusBadRequest, Message: message}
}

// NewCategoryAlreadyExistsError builds a 409 CATEGORY_ALREADY_EXISTS error
// with a name/type-specific message (spec.md S-CAT-04/S-CAT-05/S-CAT-22).
func NewCategoryAlreadyExistsError(message string) *AppError {
	return &AppError{Code: ErrCodeCategoryAlreadyExists, Status: http.StatusConflict, Message: message}
}
