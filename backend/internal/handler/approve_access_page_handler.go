package handler

import "github.com/gofiber/fiber/v2"

// ApproveAccessPageHandler serves GET /approve-access — the page an admin's
// "Xem và duyệt" email link opens (mig 031). Opening it changes nothing:
// mail scanners and link previews fetch URLs on their own, so approval only
// happens when the admin presses the button, which POSTs the token to
// /api/v1/auth/access-requests/approve. Same self-contained approach as
// ActivatePageHandler.
func ApproveAccessPageHandler(c *fiber.Ctx) error {
	return approveAccessPage.send(c)
}

var approveAccessPage = newHTMLPage(approveAccessPageHTML)

const approveAccessPageHTML = pageHead + `<title>Duyệt yêu cầu tạo tài khoản</title>
</head>
<body>
  <div class="card" id="card">
    <h1>Duyệt yêu cầu tạo tài khoản</h1>
    <p class="sub hide-when-done">Sau khi duyệt, người gửi sẽ nhận email kích hoạt để tự đặt tên đăng nhập và mật khẩu.</p>
    <button id="approve" class="hide-when-done" type="button">Duyệt yêu cầu</button>
    <div id="msg" class="msg"></div>
  </div>

<script>
(function () {
  var token = new URLSearchParams(window.location.search).get("token") || "";
  var button = document.getElementById("approve");
  var msg = document.getElementById("msg");

  function showMessage(text, kind) {
    msg.textContent = text;
    msg.className = "msg " + kind;
  }

  if (!token) {
    showMessage("Liên kết thiếu mã duyệt. Mở lại liên kết trong email.", "error");
    button.disabled = true;
  }

  var COPY = {
    ACCESS_REQUEST_HANDLED: "Yêu cầu này không còn chờ duyệt.",
    RATE_LIMITED: "Thử quá nhiều lần. Đợi vài phút rồi thử lại."
  };

  button.addEventListener("click", function () {
    if (!token) return;
    button.disabled = true;
    button.textContent = "Đang duyệt…";

    fetch("/api/v1/auth/access-requests/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (result) {
        var code = (result.body && result.body.error_code) || "";
        if (result.ok || code === "ACCESS_REQUEST_HANDLED") {
          document.getElementById("card").classList.add("done");
          var email = result.ok && result.body.data ? result.body.data.email : "";
          showMessage(result.ok ? "Đã duyệt. Email kích hoạt đã gửi tới " + email + "." : COPY[code], "success");
          return;
        }
        showMessage(COPY[code] || "Chưa duyệt được. Thử lại.", "error");
        button.disabled = false;
        button.textContent = "Duyệt yêu cầu";
      })
      .catch(function () {
        showMessage("Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.", "error");
        button.disabled = false;
        button.textContent = "Duyệt yêu cầu";
      });
  });
})();
</script>
</body>
</html>`
