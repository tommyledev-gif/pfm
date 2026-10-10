package service

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/unicode/norm"

	"github.com/example/pfm/backend/internal/common"
)

// ProfileNameMaxLength is the longest display name, in characters.
const ProfileNameMaxLength = 60

// normalizeFullName validates and cleans a display name:
//
//   - Unicode NFC, so "ữ" typed as one character or as u + combining marks is
//     one stored value (Vietnamese keyboards produce both);
//   - leading/trailing space trimmed, runs of whitespace collapsed to one space;
//   - 1 to ProfileNameMaxLength characters;
//   - only letters, combining marks, digits, spaces and . , ' ’ - — no markup
//     characters, control characters, emoji or zero-width tricks, since the name
//     is shown to other users (the admin list) and echoed into UI.
//
// The messages reach the UI as-is, so they follow the pfm-ux-copy skill.
func normalizeFullName(raw string) (string, error) {
	name := strings.Join(strings.Fields(norm.NFC.String(raw)), " ")
	if name == "" {
		return "", common.NewInvalidInputError("Nhập tên.")
	}
	if utf8.RuneCountInString(name) > ProfileNameMaxLength {
		return "", common.NewInvalidInputError("Tên tối đa 60 ký tự.")
	}
	for _, r := range name {
		if !allowedNameRune(r) {
			return "", common.NewInvalidInputError("Tên chỉ gồm chữ, số, dấu cách và . , ' -")
		}
	}
	return name, nil
}

func allowedNameRune(r rune) bool {
	switch {
	case unicode.IsLetter(r), unicode.IsMark(r), unicode.IsDigit(r):
		return true
	case r == ' ', r == '.', r == ',', r == '\'', r == '’', r == '-':
		return true
	}
	return false
}
