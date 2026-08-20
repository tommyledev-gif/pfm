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
func ActivatePageHandler(c *fiber.Ctx) error {
	c.Set("Content-Type", "text/html; charset=utf-8")
	return c.SendString(activatePageHTML)
}

const activatePageHTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Activate your PFM account</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: #050B14;
    color: #F5F6F8;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .card {
    width: 100%;
    max-width: 380px;
    background: #12161F;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    padding: 28px 24px;
  }
  h1 { font-size: 20px; margin: 0 0 6px; }
  p.sub { margin: 0 0 20px; font-size: 13px; color: rgba(255,255,255,0.55); }
  label { display: block; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.55); margin: 14px 0 6px; }
  input {
    width: 100%;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 12px 14px;
    color: #F5F6F8;
    font-size: 15px;
  }
  input:focus { outline: 2px solid #85FF33; outline-offset: -1px; }
  button {
    width: 100%;
    margin-top: 20px;
    padding: 13px 14px;
    border: none;
    border-radius: 999px;
    background: #85FF33;
    color: #06130A;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
  }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .msg { margin-top: 16px; padding: 12px 14px; border-radius: 12px; font-size: 13px; display: none; }
  .msg.error { display: block; background: rgba(255,158,150,0.12); border: 1px solid rgba(255,158,150,0.35); color: #FF9E96; }
  .msg.success { display: block; background: rgba(126,235,192,0.12); border: 1px solid rgba(126,235,192,0.35); color: #7EEBC0; }
  form.done input, form.done button, form.done label { display: none; }
</style>
</head>
<body>
  <div class="card">
    <h1>Activate your PFM account</h1>
    <p class="sub">Set your name and password to finish setting up your account.</p>
    <form id="activate-form">
      <label for="full_name">Full name</label>
      <input id="full_name" name="full_name" type="text" autocomplete="name">

      <label for="password">Password</label>
      <input id="password" name="password" type="password" autocomplete="new-password" required>

      <label for="password_confirm">Confirm password</label>
      <input id="password_confirm" name="password_confirm" type="password" autocomplete="new-password" required>

      <button id="submit-btn" type="submit">Activate account</button>
      <div id="msg" class="msg"></div>
    </form>
  </div>

<script>
(function () {
  var form = document.getElementById("activate-form");
  var msg = document.getElementById("msg");
  var submitBtn = document.getElementById("submit-btn");
  var token = new URLSearchParams(window.location.search).get("token") || "";

  function showMessage(text, kind) {
    msg.textContent = text;
    msg.className = "msg " + kind;
  }

  if (!token) {
    showMessage("This activation link is missing its token. Use the link from your invite email.", "error");
    submitBtn.disabled = true;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!token) return;

    var password = document.getElementById("password").value;
    var passwordConfirm = document.getElementById("password_confirm").value;
    if (password !== passwordConfirm) {
      showMessage("Passwords do not match.", "error");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Activating…";

    fetch("/api/v1/auth/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: token,
        full_name: document.getElementById("full_name").value || undefined,
        password: password,
        password_confirm: passwordConfirm,
      }),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body }; });
      })
      .then(function (result) {
        if (!result.ok) {
          throw new Error((result.body && result.body.message) || "Could not activate this account.");
        }
        showMessage("Account activated! Open the PFM app and log in with your new password.", "success");
        form.classList.add("done");
        msg.style.display = "block";
      })
      .catch(function (err) {
        showMessage(err.message || "Could not activate this account. The link may have expired.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Activate account";
      });
  });
})();
</script>
</body>
</html>`
