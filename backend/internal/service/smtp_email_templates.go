package service

import (
	"fmt"
	"html"
	"mime"
	"strings"
)

// emailContent is one rendered email: the subject line, a heading, the body
// paragraphs, one button, and a small footnote. Pure data, so every template
// is unit-testable without an SMTP connection.
type emailContent struct {
	Subject     string
	Heading     string
	Paragraphs  []string
	ButtonLabel string
	ButtonURL   string
	Footnote    string
}

const activationSubject = "Kích hoạt tài khoản Budgest"

func activationEmail(link string) emailContent {
	return emailContent{
		Subject:     activationSubject,
		Heading:     "Lời mời dùng Budgest",
		Paragraphs:  []string{"Admin đã mời bạn dùng Budgest.", "Đặt tên đăng nhập và mật khẩu để bắt đầu."},
		ButtonLabel: "Kích hoạt tài khoản",
		ButtonURL:   link,
		Footnote:    "Liên kết hết hạn sau 72 giờ. Không biết lời mời này thì bỏ qua email.",
	}
}

func accessApprovedEmail(link string) emailContent {
	return emailContent{
		Subject:     "Yêu cầu tạo tài khoản Budgest đã được duyệt",
		Heading:     "Yêu cầu đã được duyệt",
		Paragraphs:  []string{"Admin đã duyệt yêu cầu tạo tài khoản Budgest.", "Đặt tên đăng nhập và mật khẩu để bắt đầu."},
		ButtonLabel: "Kích hoạt tài khoản",
		ButtonURL:   link,
		Footnote:    "Liên kết hết hạn sau 72 giờ.",
	}
}

// accessRequestEmail goes to the admin. The link opens a page with the
// approve button, never approves by itself: mail scanners open links.
func accessRequestEmail(requesterEmail, link string) emailContent {
	return emailContent{
		Subject:     "Yêu cầu tạo tài khoản từ " + requesterEmail,
		Heading:     "Yêu cầu tạo tài khoản",
		Paragraphs:  []string{requesterEmail + " muốn có tài khoản Budgest.", "Duyệt thì người này nhận email kích hoạt."},
		ButtonLabel: "Xem và duyệt",
		ButtonURL:   link,
		Footnote:    "Không quen người này thì bỏ qua email. Yêu cầu cũng có trong mục Thông báo của app.",
	}
}

// buildEmailMessage renders headers + HTML. The subject goes through MIME
// B-encoding: it is Vietnamese (non-ASCII), and the encoding also keeps any
// user-supplied part of it from breaking out of the header line.
func buildEmailMessage(fromEmail, fromName, toEmail string, email emailContent) []byte {
	headers := fmt.Sprintf(
		"From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=\"UTF-8\"\r\n\r\n",
		mime.BEncoding.Encode("UTF-8", fromName), fromEmail, toEmail, mime.BEncoding.Encode("UTF-8", email.Subject),
	)

	var paragraphs strings.Builder
	for _, p := range email.Paragraphs {
		fmt.Fprintf(&paragraphs, "<p>%s</p>\n", html.EscapeString(p))
	}
	link := html.EscapeString(email.ButtonURL)

	body := fmt.Sprintf(`<html><body style="font-family:sans-serif">
<h2>%s</h2>
%s<p><a href="%s" style="display:inline-block;padding:10px 20px;background:#85FF33;color:#06130A;text-decoration:none;border-radius:999px;font-weight:700">%s</a></p>
<p>Hoặc mở liên kết này:<br><a href="%s">%s</a></p>
<p style="color:#666;font-size:12px">%s</p>
</body></html>`,
		html.EscapeString(email.Heading), paragraphs.String(), link, html.EscapeString(email.ButtonLabel),
		link, link, html.EscapeString(email.Footnote))

	return []byte(headers + body)
}
