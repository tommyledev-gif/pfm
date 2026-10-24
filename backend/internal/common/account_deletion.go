package common

// Account deletion tool on the mobile Thành viên screen: a super admin
// (users.is_super_admin) or ACCOUNT_DELETION_OPERATOR_EMAIL finds any account
// and soft-deletes it (service.AccountDeletionPolicy), checked on top of the
// /admin group's role gate.
const (
	// AccountSearchLimit caps one search's results. The tool is for picking
	// out one account, not for browsing; a longer query narrows it.
	AccountSearchLimit = 20
)
