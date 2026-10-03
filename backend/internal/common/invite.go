package common

import (
	"strings"
	"time"
)

// Resend-invitation cooldown. The first resend opens shortly after the
// original email, enough to stop a double-tap from sending two emails while
// still letting an admin fix "it never arrived" right away; every resend
// after that waits much longer so a stuck invite can't be used to flood
// someone's inbox.
const (
	InviteResendFirstCooldown = 1 * time.Minute
	InviteResendCooldown      = 30 * time.Minute
)

// InviteResendAvailableAt is the earliest moment a pending invite may be
// resent, given when its current email went out and how many resends it has
// already had. Shared by UserService (the rule) and dto.UserResponse (so
// clients can count down without re-deriving the rule).
func InviteResendAvailableAt(sentAt time.Time, resendCount int32) time.Time {
	if resendCount == 0 {
		return sentAt.Add(InviteResendFirstCooldown)
	}
	return sentAt.Add(InviteResendCooldown)
}

// NormalizeEmail is the single canonical form an email is stored and looked
// up in — mailbox addresses are case-insensitive in practice, so
// "User@Gmail.com" and "user@gmail.com" must be the same account. Migration
// 023 enforces the lowercase half of this with a CHECK constraint.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}
