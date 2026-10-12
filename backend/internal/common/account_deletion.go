package common

// Account deletion tool on the mobile Security screen — a test-phase tool
// that lets one named account soft-delete any other account.
const (
	// AccountDeletionOperatorEmail is the only account that may search for
	// and delete other accounts. Checked by AccountDeletionService on top of
	// the /admin group's role gate. Mirrored in
	// mobile/src/features/security/account-deletion.ts, which only decides
	// whether the section is shown.
	AccountDeletionOperatorEmail = "owner@example.com"

	// AccountSearchLimit caps one search's results. The tool is for picking
	// out one account, not for browsing; a longer query narrows it.
	AccountSearchLimit = 20
)
