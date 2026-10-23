package service

import "github.com/example/pfm/backend/internal/common"

// AccountDeletionPolicy names the one account the test-phase deletion tool
// (mobile Security screen) is open to: ACCOUNT_DELETION_OPERATOR_EMAIL. It was
// a personal email hard-coded in the backend and in the app bundle
// (specs/security-hardening-2026-10 F-18); it now comes from configuration,
// and the app learns it only as GET /users/me's can_delete_accounts. The zero
// value, like an empty email, opens the tool to nobody.
type AccountDeletionPolicy struct {
	operatorEmail string
}

func NewAccountDeletionPolicy(operatorEmail string) AccountDeletionPolicy {
	return AccountDeletionPolicy{operatorEmail: common.NormalizeEmail(operatorEmail)}
}

// IsOperator reports whether email belongs to the configured operator.
func (p AccountDeletionPolicy) IsOperator(email string) bool {
	return p.operatorEmail != "" && common.NormalizeEmail(email) == p.operatorEmail
}
