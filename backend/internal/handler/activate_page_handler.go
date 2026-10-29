package handler

import "github.com/gofiber/fiber/v2"

// ActivatePageHandler serves GET /activate — a self-contained HTML page,
// not a JSON API response. It exists because APP_BASE_URL (see
// service.SMTPConfig) currently points at this backend's own domain: the
// only thing deployed to production is backend/docker-compose.yml (backend +
// ai-service + postgres), frontend/ has no production deployment yet, so the
// invite email's activation link has nowhere else to land. The page itself
// just POSTs to the existing /api/v1/auth/activate JSON endpoint client-side
// — no template engine or new dependency needed for one static page.
//
// It is also where the tên đăng nhập is chosen, the one time it can be
// (mig 030). Each field checks itself on blur and on submit with the same
// rules the server applies (common.UsernameProblem, MinPasswordLength), and
// a server rejection is shown under the field it is about.
func ActivatePageHandler(c *fiber.Ctx) error {
	return activatePage.send(c)
}

var activatePage = newHTMLPage(activatePageHTML)

const activatePageHTML = pageHead + `<title>Kích hoạt tài khoản Budgest</title>
</head>
<body>
  <div class="card" id="card">
    <h1>Kích hoạt tài khoản</h1>
    <p class="sub hide-when-done">Đặt tên đăng nhập và mật khẩu cho tài khoản Budgest.</p>
    <form id="form" class="hide-when-done" novalidate>
      <div class="field" id="field-username">
        <label for="username">Tên đăng nhập</label>
        <input id="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="30">
        <div class="hint">3 đến 30 ký tự: chữ không dấu, số, dấu chấm, gạch dưới. Không đổi được sau này.</div>
        <div class="error" id="error-username"></div>
      </div>

      <div class="field" id="field-full_name">
        <label for="full_name">Tên hiển thị <span class="optional">(không bắt buộc)</span></label>
        <input id="full_name" type="text" autocomplete="name" maxlength="60">
        <div class="hint">Đổi được trong app.</div>
        <div class="error" id="error-full_name"></div>
      </div>

      <div class="field" id="field-password">
        <label for="password">Mật khẩu</label>
        <input id="password" type="password" autocomplete="new-password">
        <div class="hint">Ít nhất 8 ký tự.</div>
        <div class="error" id="error-password"></div>
      </div>

      <div class="field" id="field-password_confirm">
        <label for="password_confirm">Nhập lại mật khẩu</label>
        <input id="password_confirm" type="password" autocomplete="new-password">
        <div class="error" id="error-password_confirm"></div>
      </div>

      <button id="submit" type="submit">Kích hoạt tài khoản</button>
    </form>
    <div id="msg" class="msg"></div>
  </div>

<script>
(function () {
  var MIN_PASSWORD = 8;
  // bcrypt reads at most 72 bytes (common.MaxPasswordBytes); a letter with
  // diacritics takes 2-3 of them, so the count is in UTF-8 bytes.
  var MAX_PASSWORD_BYTES = 72;
  var MAX_NAME = 60;
  var token = new URLSearchParams(window.location.search).get("token") || "";
  var form = document.getElementById("form");
  var submit = document.getElementById("submit");
  var msg = document.getElementById("msg");
  var touched = {};

  function value(id) { return document.getElementById(id).value; }

  // Same rules, same order, as common.UsernameProblem.
  function usernameProblem(u) {
    if (!u) return "Nhập tên đăng nhập.";
    if (u.length < 3 || u.length > 30) return "Tên đăng nhập dài 3 đến 30 ký tự.";
    if (!/^[a-z0-9._]+$/.test(u)) return "Chỉ dùng chữ không dấu, số, dấu chấm hoặc gạch dưới.";
    if (!/^[a-z]/.test(u)) return "Tên đăng nhập bắt đầu bằng chữ cái.";
    if (/[._]$/.test(u)) return "Tên đăng nhập kết thúc bằng chữ hoặc số.";
    if (/[._]{2}/.test(u)) return "Không đặt hai dấu chấm hoặc gạch dưới liền nhau.";
    return "";
  }

  // Same rules as the server's normalizeFullName (optional here).
  function fullNameProblem(raw) {
    var name = raw.trim().split(/\s+/).join(" ");
    if (!name) return "";
    if (Array.from(name).length > MAX_NAME) return "Tên tối đa 60 ký tự.";
    if (!/^[\p{L}\p{M}\p{N} .,'’-]+$/u.test(name)) return "Tên chỉ gồm chữ, số, dấu cách và . , ' -";
    return "";
  }

  var checks = {
    username: function () { return usernameProblem(value("username")); },
    full_name: function () { return fullNameProblem(value("full_name")); },
    password: function () {
      var p = value("password");
      if (p.length < MIN_PASSWORD) return "Mật khẩu cần ít nhất 8 ký tự.";
      if (new TextEncoder().encode(p).length > MAX_PASSWORD_BYTES) return "Mật khẩu tối đa 72 ký tự không dấu.";
      return "";
    },
    password_confirm: function () {
      if (!value("password_confirm")) return "Nhập lại mật khẩu.";
      return value("password_confirm") !== value("password") ? "Hai mật khẩu chưa khớp." : "";
    }
  };

  function setFieldError(name, text) {
    var field = document.getElementById("field-" + name);
    document.getElementById("error-" + name).textContent = text;
    field.classList.toggle("invalid", Boolean(text));
    document.getElementById(name).setAttribute("aria-invalid", text ? "true" : "false");
  }

  function check(name) { var p = checks[name](); setFieldError(name, p); return p; }

  function showMessage(text, kind) {
    msg.textContent = text;
    msg.className = "msg " + kind;
  }

  // Usernames are stored lowercase, so the field shows what will be kept.
  document.getElementById("username").addEventListener("input", function (e) {
    var lowered = e.target.value.toLowerCase().replace(/\s/g, "");
    if (lowered !== e.target.value) e.target.value = lowered;
    if (touched.username) check("username");
  });

  Object.keys(checks).forEach(function (name) {
    var input = document.getElementById(name);
    input.addEventListener("blur", function () {
      // Leaving a field empty is not an error yet; submitting is.
      if (!input.value) return;
      touched[name] = true;
      check(name);
    });
    if (name !== "username") {
      input.addEventListener("input", function () {
        if (touched[name]) check(name);
        if (name === "password" && touched.password_confirm) check("password_confirm");
      });
    }
  });

  if (!token) {
    showMessage("Liên kết thiếu mã kích hoạt. Mở lại liên kết trong email.", "error");
    submit.disabled = true;
  }

  // Server error code -> the field it is about. Anything else is shown for the form.
  var FIELD_BY_CODE = {
    INVALID_USERNAME: "username",
    USERNAME_TAKEN: "username",
    INVALID_FULL_NAME: "full_name",
    WEAK_PASSWORD: "password",
    PASSWORD_MISMATCH: "password_confirm"
  };
  var FORM_COPY = {
    NOT_FOUND: "Liên kết này không còn dùng được. Nhờ người mời bạn gửi lại lời mời.",
    TOKEN_EXPIRED: "Liên kết đã hết hạn. Nhờ người mời bạn gửi lại lời mời.",
    RATE_LIMITED: "Thử quá nhiều lần. Đợi vài phút rồi thử lại."
  };
  var FIELD_COPY = { PASSWORD_MISMATCH: "Hai mật khẩu chưa khớp." };

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!token) return;

    var firstInvalid = null;
    Object.keys(checks).forEach(function (name) {
      touched[name] = true;
      if (check(name) && !firstInvalid) firstInvalid = name;
    });
    if (firstInvalid) {
      document.getElementById(firstInvalid).focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = "Đang kích hoạt…";
    msg.className = "msg";

    fetch("/api/v1/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: token,
        username: value("username"),
        full_name: value("full_name").trim() || undefined,
        password: value("password"),
        password_confirm: value("password_confirm")
      })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (result) {
        if (result.ok) {
          document.getElementById("card").classList.add("done");
          showMessage("Đã kích hoạt tài khoản. Mở app Budgest và đăng nhập bằng tên đăng nhập " + value("username") + " hoặc email.", "success");
          return;
        }
        var code = (result.body && result.body.error_code) || "";
        var field = FIELD_BY_CODE[code];
        if (field) {
          setFieldError(field, FIELD_COPY[code] || result.body.message);
          document.getElementById(field).focus();
        } else {
          showMessage(FORM_COPY[code] || "Chưa kích hoạt được. Thử lại.", "error");
        }
        submit.disabled = false;
        submit.textContent = "Kích hoạt tài khoản";
      })
      .catch(function () {
        showMessage("Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.", "error");
        submit.disabled = false;
        submit.textContent = "Kích hoạt tài khoản";
      });
  });
})();
</script>
</body>
</html>`
