package service

import (
	"bytes"
	_ "embed"
	"fmt"
	"html/template"
	"mime"
)

// emailContent is one rendered email. Pure data, so every template is
// unit-testable without an SMTP connection; the layout (email_layout.html)
// escapes every field for the context it lands in.
type emailContent struct {
	Subject string
	// Inbox preview line, hidden in the body.
	Preheader string
	// Small label above the heading.
	Eyebrow    string
	Heading    string
	Paragraphs []string
	// A highlighted label/value pair, e.g. the requester's email.
	Detail      *emailDetail
	ButtonLabel string
	ButtonURL   string
	StepsTitle  string
	Steps       []string
	Footnotes   []string
}

type emailDetail struct {
	Label string
	Value string
}

//go:embed email_layout.html
var emailLayoutHTML string

// Parsed once at startup: a broken layout fails the process, not a send.
var emailLayout = template.Must(template.New("email").
	Funcs(template.FuncMap{"inc": func(i int) int { return i + 1 }}).
	Parse(emailLayoutHTML))

const (
	activationSubject  = "Kích hoạt tài khoản Budgest"
	activateButton     = "Kích hoạt tài khoản"
	activationLinkLife = "Liên kết kích hoạt dùng được trong 72 giờ."
)

var activationSteps = []string{
	"Bấm " + activateButton,
	"Đặt tên đăng nhập và mật khẩu",
	"Đăng nhập trên ứng dụng Budgest",
}

func activationEmail(link string) emailContent {
	return emailContent{
		Subject:     activationSubject,
		Preheader:   activationLinkLife,
		Eyebrow:     "Lời mời",
		Heading:     "Bạn được mời dùng Budgest",
		Paragraphs:  []string{activationLinkLife},
		ButtonLabel: activateButton,
		ButtonURL:   link,
		StepsTitle:  "Cách kích hoạt",
		Steps:       activationSteps,
		Footnotes:   []string{"Không nhận ra lời mời này thì bỏ qua email."},
	}
}

func accessApprovedEmail(link string) emailContent {
	return emailContent{
		Subject:     "Yêu cầu tạo tài khoản Budgest đã được duyệt",
		Preheader:   activationLinkLife,
		Eyebrow:     "Đã duyệt",
		Heading:     "Yêu cầu tạo tài khoản đã được duyệt",
		Paragraphs:  []string{activationLinkLife},
		ButtonLabel: activateButton,
		ButtonURL:   link,
		StepsTitle:  "Cách kích hoạt",
		Steps:       activationSteps,
		Footnotes:   []string{"Không gửi yêu cầu này thì bỏ qua email."},
	}
}

// accessRequestEmail goes to the admin. The link opens a page with the
// approve button, never approves by itself: mail scanners open links.
func accessRequestEmail(requesterEmail, link string) emailContent {
	return emailContent{
		Subject:     "Yêu cầu tạo tài khoản từ " + requesterEmail,
		Preheader:   "Một yêu cầu tạo tài khoản đang chờ duyệt.",
		Eyebrow:     "Chờ duyệt",
		Heading:     "Yêu cầu tạo tài khoản mới",
		Detail:      &emailDetail{Label: "Email người gửi", Value: requesterEmail},
		Paragraphs:  []string{"Sau khi duyệt, người gửi nhận email kích hoạt."},
		ButtonLabel: "Xem yêu cầu",
		ButtonURL:   link,
		Footnotes: []string{
			"Yêu cầu cũng có trong mục Thông báo của ứng dụng.",
			"Không nhận ra người gửi thì bỏ qua email.",
		},
	}
}

// buildEmailMessage renders headers + HTML. The subject goes through MIME
// B-encoding: it is Vietnamese (non-ASCII), and the encoding also keeps any
// user-supplied part of it from breaking out of the header line.
func buildEmailMessage(fromEmail, fromName, toEmail string, email emailContent) ([]byte, error) {
	var msg bytes.Buffer
	fmt.Fprintf(&msg,
		"From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\n"+
			"Content-Type: text/html; charset=\"UTF-8\"\r\nContent-Transfer-Encoding: 8bit\r\n\r\n",
		mime.BEncoding.Encode("UTF-8", fromName), fromEmail, toEmail, mime.BEncoding.Encode("UTF-8", email.Subject),
	)
	if err := emailLayout.Execute(&msg, email); err != nil {
		return nil, fmt.Errorf("service.buildEmailMessage: %w", err)
	}
	return msg.Bytes(), nil
}
