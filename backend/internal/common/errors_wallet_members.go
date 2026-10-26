package common

import (
	"net/http"
	"time"
)

// Shared wallets (specs/shared-wallets plan §3). Access failures reuse
// WALLET_ACCESS_DENIED / WALLET_NOT_FOUND; these cover the membership
// lifecycle itself. The app maps each code to its own sentence.
const (
	ErrCodeWalletMemberUserNotFound = "WALLET_MEMBER_USER_NOT_FOUND"
	ErrCodeWalletMemberNotFound     = "WALLET_MEMBER_NOT_FOUND"
	ErrCodeWalletMemberExists       = "WALLET_MEMBER_EXISTS"
	ErrCodeWalletMemberLimit        = "WALLET_MEMBER_LIMIT"
	ErrCodeWalletInvitationNotFound = "WALLET_INVITATION_NOT_FOUND"
)

// WalletMemberLimit caps live memberships (pending + active) per wallet
// (spec BR-02): a household, not a company.
const WalletMemberLimit = 10

// Invitee lookups per owner (middleware.MemberLookupRateLimiter). The invite
// field looks the account up as the owner types, so a burst is normal; the
// hourly cap keeps it from being a way to test addresses in bulk.
const (
	MemberLookupRateLimit       = 120
	MemberLookupRateLimitWindow = time.Hour
)

var (
	ErrWalletMemberUserNotFound = &AppError{Code: ErrCodeWalletMemberUserNotFound, Status: http.StatusNotFound, Message: "không tìm thấy tài khoản này"}
	ErrWalletMemberNotFound     = &AppError{Code: ErrCodeWalletMemberNotFound, Status: http.StatusNotFound, Message: "người này không có trong ví"}
	ErrWalletMemberExists       = &AppError{Code: ErrCodeWalletMemberExists, Status: http.StatusConflict, Message: "người này đã được mời vào ví"}
	ErrWalletMemberLimit        = &AppError{Code: ErrCodeWalletMemberLimit, Status: http.StatusConflict, Message: "ví đã đủ 10 người"}
	ErrWalletInvitationNotFound = &AppError{Code: ErrCodeWalletInvitationNotFound, Status: http.StatusNotFound, Message: "lời mời không còn hiệu lực"}
)
