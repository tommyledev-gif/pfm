package common

// Account deletion tool on the mobile Security screen — a test-phase tool
// that lets one named account soft-delete any other account. Who that account
// is comes from ACCOUNT_DELETION_OPERATOR_EMAIL (service.AccountDeletionPolicy),
// checked on top of the /admin group's role gate.
const (
	// AccountSearchLimit caps one search's results. The tool is for picking
	// out one account, not for browsing; a longer query narrows it.
	AccountSearchLimit = 20
)
