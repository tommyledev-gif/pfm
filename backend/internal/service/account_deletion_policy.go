package service

import (
	"github.com/example/pfm/backend/internal/common"
	"github.com/example/pfm/backend/internal/model"
)

// AccountDeletionPolicy names who the account deletion tool (mobile Thành
// viên screen) is open to: a super admin (users.is_super_admin, mig 037), and
// ACCOUNT_DELETION_OPERATOR_EMAIL. The email was a personal one hard-coded in
// the backend and in the app bundle (specs/security-hardening-2026-10 F-18);
// it now comes from configuration, and the app learns either only as GET
// /users/me's can_delete_accounts. The zero value, like an empty email, opens
// the tool to super admins alone.
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

// Grants reports whether user passes the tool's own gate: a super admin or
// the configured operator. The admin role is checked apart from it, by the
// /admin route group and by ProfileService.CanDeleteAccounts.
func (p AccountDeletionPolicy) Grants(user *model.User) bool {
	return user.IsSuperAdmin || p.IsOperator(user.Email)
}
