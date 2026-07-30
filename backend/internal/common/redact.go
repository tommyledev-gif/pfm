package common

import "strings"

// MaskEmail is the only email shape allowed in a log statement anywhere in
// this codebase (CLAUDE.md: "Không log sensitive data... email trong prod
// log"). "homer@example.com" -> "h***@example.com".
func MaskEmail(email string) string {
	at := strings.IndexByte(email, '@')
	if at <= 0 {
		return "***"
	}
	return email[:1] + "***" + email[at:]
}
