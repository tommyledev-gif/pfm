# Lark Planner × Claude Code — Setup trên máy mới

Mục tiêu: trên máy mới, Claude Code đọc/ghi được Lark Base **"Daily Tasks & PFM Roadmap"** qua MCP, y như máy công ty.

Base, app Lark và quyền đều nằm trên cloud, **không cần tạo lại**. Chỉ cần setup lại máy: (1) credentials, (2) MCP server, (3) trí nhớ của Claude.

---

## 0. Chuẩn bị

- Node.js ≥ 18 (`node -v`). `npx` đi kèm Node.
- Claude Code đã cài và đã đăng nhập (`claude --version`).
- Repo PFM đã pull bản mới nhất, có các file `docs/lark-planner-guide.md` và `scripts/setup-lark-mcp.mjs`.

## 1. Tạo `lark-credentials.json`

File này **không có trong git** (đã gitignore vì chứa App Secret), nên phải tạo lại bằng tay.

1. Mở https://open.larksuite.com/app → chọn app **example** → **Credentials & Basic Info**.
2. Copy **App ID** và **App Secret**.
3. Tạo file `lark-credentials.json` ở **root repo** (ngang hàng với `CLAUDE.md`):

```json
{
    "lark_app_id": "cli_xxxxxxxxxxxxxxxx",
    "lark_app_secret": "<App Secret>"
}
```

> ⚠️ Không bao giờ commit file này. Kiểm tra: `git check-ignore lark-credentials.json` phải in ra tên file.

## 2. Đăng ký MCP server

Ở root repo, chạy **1 lệnh** (PowerShell, cmd, Git Bash hay terminal Mac đều được):

```bash
node scripts/setup-lark-mcp.mjs
```

Kiểm tra:

```bash
claude mcp list
```

Phải thấy dòng: `lark: ... - ✔ Connected`.

> Không dùng `claude mcp get lark` để kiểm tra vì lệnh đó in App Secret ra màn hình.

## 3. Mở session Claude Code mới

Tool MCP chỉ được nạp khi mở session mới: mở chat mới, hoặc trong VS Code chạy `Developer: Reload Window`.

## 4. Nạp trí nhớ cho Claude

Memory của Claude lưu riêng trên từng máy, nên máy mới chưa biết ID của Base. Trong Claude Code (mở ở repo PFM), gõ:

```
Đọc docs/lark-planner-guide.md, lưu phần "Reference cho Claude" vào memory của bạn.
```

## 5. Test

```
Hôm nay tôi có task gì trên Lark?
```

Claude gọi tool `bitable_v1_appTableRecord_search` và trả về danh sách task (có thể rỗng). Vậy là xong.

---

## Troubleshooting

| Triệu chứng | Cách xử lý |
|---|---|
| `lark ... ✘ Failed to connect` | Chạy `npx -y @larksuiteoapi/lark-mcp@0.5.1 mcp --help`. Nếu lỗi thì do Node/npx hoặc mạng. Sửa xong chạy lại bước 2. |
| Claude không thấy tool Lark | Chưa mở session mới (bước 3). |
| Lỗi `invalid app_secret` / `99991663` | App Secret sai hoặc đã bị reset trên console. Sửa `lark-credentials.json` rồi chạy lại bước 2. |
| Lỗi quyền (`99991672`, `Forbidden`) trên Base | App mất quyền vào Base. Mở Base → `...` → **More** → **Add Document App** → thêm app **example** quyền edit. |
| Tự gõ `claude mcp add ... cmd /c ...` trong Git Bash bị lỗi | Git Bash tự đổi `/c` thành `C:/`. Dùng script ở bước 2 (đã xử lý), hoặc thêm `MSYS_NO_PATHCONV=1` trước lệnh. |

Nếu **reset App Secret** trên Lark console thì phải sửa `lark-credentials.json` và chạy lại bước 2 trên **mọi máy**.

---

## Reference cho Claude

> Phần này để Claude lưu vào memory (bước 4). Không chứa secret.

**Lark Base "Daily Tasks & PFM Roadmap"**: planner hàng ngày của user, Claude là giao diện chính để đọc/ghi.

- Lark international. API base `https://open.larksuite.com/open-apis`. Web: https://yjpf58z7pret.jp.larksuite.com/base/BASE_APP_TOKEN
- Owner: tài khoản Lark của user. App Lark `cli_xxxxxxxxxxxxxxxx` có full_access (tenant token, scope `bitable:app`). User tự kéo Base vào Drive › My folders › personal. App không có quyền vào folder đó, nên đừng thử move Base bằng API.
- Credentials: `lark-credentials.json` ở root repo (gitignored), gồm `lark_app_id` và `lark_app_secret`.
- MCP server `lark` (user scope, `@larksuiteoapi/lark-mcp@0.5.1`, tenant token), cài bằng `scripts/setup-lark-mcp.mjs`. Tools: `bitable_v1_appTable_list`, `bitable_v1_appTableField_{list,create,update}`, `bitable_v1_appTableRecord_{search,create,batchCreate,update,batchUpdate,delete}`. Dùng MCP thay cho script tự viết.

**IDs**

- app_token `BASE_APP_TOKEN`, timezone `Asia/Bangkok` (UTC+7; Lark không nhận `Asia/Ho_Chi_Minh`)
- Bảng **Daily Tasks** `tblDAILYTASKS`
  - Task Name `fldK5vDHGu` (primary, text)
  - Date `fldL1q45Ln` (date, auto_fill = ngày tạo)
  - Status `fldAIEE7xE` (select: To Do / In Progress / Done / Overdue)
  - Category `fldclCe9qD` (select: PFM App / Học tập / Sức khỏe / Cá nhân)
  - AI Note/Feedback `fld8FeSZiu` (text)
  - Link to PFM Worklog `fldVJXyo0V` (duplex link → Roadmap)
- Bảng **PFM App Worklog & Roadmap** `tblROADMAP`
  - Feature/Module `fldU4OWOp5` (primary, text)
  - Target Version `fldHDdN4HN` (select: v0.1-MVP / v0.2-Beta / v1.0-Release)
  - Due Date `fldL8QytGe` (date)
  - Daily Tasks `fldmJGQ9xO` (back-link từ Daily Tasks)
  - Progress (formula, `0.00%`): % task đã link có Status = Done

**Cách gọi API (đã test)**

- Task hôm nay: record search, `filter = {"conjunction":"and","conditions":[{"field_name":"Date","operator":"is","value":["Today"]}]}`. Dùng `"Tomorrow"` cho ngày mai.
- Date là ms epoch. Muốn ghi một ngày cụ thể thì dùng 00:00 giờ UTC+7 của ngày đó.
- Field select nhận tên option dạng string. Field link nhận mảng `record_id`.

**Lưu ý về formula**

- Tham chiếu field dạng `bitable::$table[T].$field[F]`. Muốn đọc một cột của bảng được link thì dùng `.$column[F]`: chỉ `$column` tự tính lại khi record được link thay đổi. `.FILTER(CurrentValue.$field[F]...)` chỉ tính 1 lần lúc link, sau đó không cập nhật nữa.
- Progress = `IF(link.COUNTA()=0,0,COUNTIF(link.$column[Status],CurrentValue="Done")/link.COUNTA())`
- Formatter `0%` bị từ chối, dùng `0.00%`.
