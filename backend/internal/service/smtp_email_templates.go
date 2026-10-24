package service

import (
	"bytes"
	_ "embed"
	"encoding/base64"
	"fmt"
	"html/template"
	"io"
	"mime"
	"mime/multipart"
	"net/textproto"

	"github.com/example/pfm/backend/internal/common"
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

// The app's logo (mobile/assets/icon.png, cropped to the wallet and scaled
// to 96px for a 40px slot at 2x), sent inside every email as an inline part
// the layout points at with cid:. Nothing to host, and it shows without the
// reader allowing remote images. A data: URI would be smaller still, but
// Gmail drops those.
//
//go:embed email_logo.png
var emailLogoPNG []byte

const emailLogoCID = "budgest-logo"

// RFC 2045's limit for a base64 body line.
const base64LineLength = 76

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

// passwordResetEmail carries the forgot-password code (specs/forgot-password).
// No button: the app asks for the code, and a link would invite phishing
// copies.
func passwordResetEmail(code string) emailContent {
	life := fmt.Sprintf("Mã dùng được trong %d phút.", int(common.ResetCodeTTL.Minutes()))
	return emailContent{
		Subject:    "Mã đặt lại mật khẩu Budgest",
		Preheader:  life,
		Eyebrow:    "Quên mật khẩu",
		Heading:    "Đặt lại mật khẩu",
		Detail:     &emailDetail{Label: "Mã đặt lại", Value: code},
		Paragraphs: []string{life},
		Footnotes:  []string{"Không phải bạn yêu cầu thì bỏ qua email này. Mật khẩu chưa thay đổi."},
	}
}

// buildEmailMessage renders headers + a multipart/related body: the HTML,
// then the logo it shows. The subject goes through MIME B-encoding: it is
// Vietnamese (non-ASCII), and the encoding also keeps any user-supplied part
// of it from breaking out of the header line.
func buildEmailMessage(fromEmail, fromName, toEmail string, email emailContent) ([]byte, error) {
	var body bytes.Buffer
	parts := multipart.NewWriter(&body)
	htmlPart, err := parts.CreatePart(textproto.MIMEHeader{
		"Content-Type":              {`text/html; charset="UTF-8"`},
		"Content-Transfer-Encoding": {"8bit"},
	})
	if err != nil {
		return nil, fmt.Errorf("service.buildEmailMessage: %w", err)
	}
	if err := emailLayout.Execute(htmlPart, email); err != nil {
		return nil, fmt.Errorf("service.buildEmailMessage: %w", err)
	}
	logoPart, err := parts.CreatePart(textproto.MIMEHeader{
		"Content-Type":              {"image/png"},
		"Content-Transfer-Encoding": {"base64"},
		"Content-ID":                {"<" + emailLogoCID + ">"},
		"Content-Disposition":       {`inline; filename="budgest.png"`},
	})
	if err != nil {
		return nil, fmt.Errorf("service.buildEmailMessage: %w", err)
	}
	if err := writeBase64Lines(logoPart, emailLogoPNG); err != nil {
		return nil, fmt.Errorf("service.buildEmailMessage: %w", err)
	}
	if err := parts.Close(); err != nil {
		return nil, fmt.Errorf("service.buildEmailMessage: %w", err)
	}

	var msg bytes.Buffer
	fmt.Fprintf(&msg,
		"From: %s <%s>\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\n"+
			"Content-Type: multipart/related; boundary=\"%s\"; type=\"text/html\"\r\n\r\n",
		mime.BEncoding.Encode("UTF-8", fromName), fromEmail, toEmail, mime.BEncoding.Encode("UTF-8", email.Subject),
		parts.Boundary(),
	)
	msg.Write(body.Bytes())
	return msg.Bytes(), nil
}

// writeBase64Lines writes data base64-encoded in CRLF-ended lines, as a mail
// body part has to be.
func writeBase64Lines(w io.Writer, data []byte) error {
	encoded := base64.StdEncoding.EncodeToString(data)
	for start := 0; start < len(encoded); start += base64LineLength {
		end := min(start+base64LineLength, len(encoded))
		if _, err := io.WriteString(w, encoded[start:end]+"\r\n"); err != nil {
			return err
		}
	}
	return nil
}
