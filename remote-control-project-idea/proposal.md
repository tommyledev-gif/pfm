# PROPOSAL: Mobile-accessible read-only ops assistant (Claude Code) cho VPS PFM

> Dành cho AI executor. Đọc hết tài liệu trước khi làm bất cứ lệnh nào.
> Người duyệt: Phuc (owner). Ngôn ngữ giao tiếp: tiếng Việt xen technical terms tiếng Anh, ngắn gọn.
> Cập nhật 2026-10-10: Remote Control bị organization policy tắt → chuyển sang **SSH + tmux (cách B)**. Artifact Tầng 1 đã có trong `setup/`.

---

## 0. TL;DR

Phuc muốn dùng điện thoại hỏi/giao việc cho Claude Code chạy trên VPS (chạy PFM) để: xem tình trạng VPS/docker/DB/backup, đọc và phân tích source, lập plan tính năng mới. Ghi DB chỉ tính sau (Phase 4).

Cách làm: trên điện thoại dùng **Termius** SSH vào VPS.
- Host `pfm-claude` → user `claude-ro` → tự vào **tmux** đang chạy **Claude Code nguyên bản**. Tắt app thì Claude vẫn chạy; mở lại là thấy hội thoại cũ.
- Host `pfm-ops` → user `ops-ro` → menu cố định (ForceCommand). Bấm **snippet** chạy tool read-only, **không gọi Claude, không tốn quota**.

Mọi truy cập hệ thống đi qua **bộ tool script root-owned** (sudoers whitelist). Không docker socket, không sudo tự do.

Hai tầng:
- **Tầng 1 (làm ngay):** ops-ro dùng tool; Claude chỉ đọc code PFM (đúng phạm vi công ty đã cho phép). Claude **không** gọi được tool.
- **Tầng 2 (chờ công ty OK):** thêm claude-ro vào group `claude-tools` → Claude đọc được dữ liệu prod đã mask.

## 1. Bối cảnh hệ thống (dữ kiện đã biết)

- VPS Ubuntu, user hiện tại: `deploy` (thuộc group `docker`, tức là ngang root). Hiện chỉ một dev (Phuc).
- RAM 1.9GB (~1.1GB available), swap 3.9GB, 2 core, disk 28GB (còn 14GB). CPU/disk dư; **RAM là thứ phải canh**.
- Docker theo `backend/docker-compose.yml`: `pfm-postgres`, `pfm-backend`, `ai-service` (Groq), `pfm-cloudflared` (khi có tunnel token). Không Redis, không container logging, không Next.js web.
- Deploy: CI copy `deploy.sh`, compose, migrations, `ops/` lên VPS. VPS **không có git clone**; clone cho claude-ro là mới (~30MB).
- Backup: cron `backup-postgres.sh` 02:00 giờ VN, `pg_dump -Fc` → **R2**, giữ 30 ngày. Cron chỉ cài khi `.env.prod` có `BACKUP_R2_BUCKET`.
- Log backend không có request id/duration.
- Ingress: Cloudflare Tunnel.
- **Remote Control: bị organization policy tắt** (`claude remote-control` → "disabled by your organization's policy").
- Chưa biết (Phase 0 xác nhận): đường dẫn compose thực tế, log driver/rotate, image có SHA không, Postgres version/extension/local auth, cron backup đã cài chưa, timezone, SSH đang mở public không, firewall.

## 2. Mục tiêu và Non-goals

**Mục tiêu (read-only):**
1. Từ mobile trả lời được các câu acceptance (mục 8): câu cố định qua snippet, câu cần suy luận qua Claude.
2. Claude **không** ghi/sửa/xóa được gì trên hệ thống, DB, container (bằng ranh giới OS).
3. Không làm VPS chậm, không gây OOM cho Postgres/backend.
4. **Không bao giờ vượt hạn mức 5h/tuần của gói và không phát sinh chi phí ngoài gói** (mục 3).

**Non-goals (cấm):**
- Không cài OpenClaw/Clawdbot hay agent framework tương tự.
- Không viết app/bot/nút bấm tự gọi `claude -p`, Agent SDK, `setup-token`, `CLAUDE_CODE_OAUTH_TOKEN`. Snippet/bot chỉ được chạy tool, không gọi Claude.
- Không cấp docker socket/group `docker`, không sudo tổng quát cho claude-ro/ops-ro.
- Không đổi compose, không restart/stop/recreate container, không build image trên VPS.
- Không cài stack nặng (Prometheus/Grafana/ELK), không GitNexus.
- Không dùng Claude cho tính năng AI trong app PFM (đã dùng Groq).
- Không né policy của công ty: nếu công ty nói không với SSH thì dừng.

## 3. Ràng buộc policy và hạn mức (không thương lượng)

- Subscription là của công ty; công ty cho Phuc dùng để code PFM. Việc log/dữ liệu prod (đã mask) đi qua Anthropic **chưa được xác nhận** → nằm ở Tầng 2. Phuc báo công ty sớm (vài ngày), nói rõ đã làm gì; đồng thời hỏi có bật Remote Control được không.
- Chỉ dùng **Claude Code binary nguyên bản, người dùng là Phuc, tương tác tay qua SSH**. Bản chất giống chạy Claude Code trên WSL/laptop: thêm một máy đăng nhập cùng tài khoản.
- **Hạn mức:**
  - Đăng nhập bằng tài khoản claude.ai (subscription) → dùng chung hạn mức 5h/tuần với laptop/Desktop; hết là dừng tới giờ reset.
  - Chặn đường tính tiền ngoài gói: managed settings `forceLoginMethod: "claudeai"` (theo docs, chặn `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`, `apiKeyHelper` lúc khởi động); profile/tmux unset các biến này; `verify.sh` kiểm tra.
  - Extra usage / usage credits: **Phuc kiểm tra đang tắt** ở claude.ai → Settings → Usage (không cài từ VPS được).
  - Không bật `autoContinueAtUsageLimit`.
  - Câu hỏi lặp lại dùng snippet (0 quota). Tool output gọn (cắt 60KB).
- Mọi thứ Claude đọc đi lên Anthropic → tool mask secret/PII, không trả dữ liệu từng user.

## 4. Kiến trúc

```
[Điện thoại: Termius]
   │ SSH key pfm-claude              │ SSH key pfm-ops
   ▼                                 ▼
 user claude-ro                    user ops-ro
 (restrict,pty; key root-owned)    (ForceCommand ops-dispatch; không shell)
   │ .bash_profile → claude-session  │
   ▼                                 │
 tmux "claude" → claude (native)     │
   │ đọc ~/src/<repo> (deploy key RO)│
   │ [Tầng 2] sudo tool ─────────────┤ sudo tool
   ▼                                 ▼
 /opt/claude-tools/bin/*  (root:root 755; group claude-tools được sudo đúng danh sách)
   vps-status dc-ps dc-stats dc-logs dc-restarts dc-version pg-ro backup-check sec-check
   └─► docker (root) / psql role claude_ro (pg_monitor) / journalctl / rclone R2 (read-only)
 Giới hạn RAM: user slice claude-ro 550M/750M/swap 512M, oom_score_adj 800.
 Containers (pfm-postgres, pfm-backend, ai-service, pfm-cloudflared): KHÔNG bị chạm.
```

Nguyên tắc: **ranh giới bảo mật = quyền OS**. Permission rules của Claude Code chỉ là lớp phụ.

## 5. Nguyên tắc làm việc cho executor

1. Read-only trước. Không sửa gì khi chưa được Phuc duyệt.
2. Trước bước nặng: `MemAvailable` < 600MB thì dừng.
3. Không in secret: không `cat .env`, không `docker inspect` thô, không `docker compose config`.
4. Executor không có quyền vào VPS: viết script, Phuc chạy và dán output (đã mask).
5. Idempotent + `uninstall.sh`.
6. Mỗi phase kết thúc bằng báo cáo (mục 10) và dừng chờ Phuc.
7. Cú pháp Claude Code: đọc docs chính thức (đã verify 2026-10-10: managed settings `/etc/claude-code/managed-settings.json`, `forceLoginMethod`, permission syntax, native installer `curl -fsSL https://claude.ai/install.sh | bash` → `~/.local/bin/claude`).

## 6. Kế hoạch theo phase

### Phase 0: Discovery: `phase0/phase0-discovery.sh` (đã có)
Chạy bằng `deploy`, chỉ đọc, tự mask. Phuc đọc lại output trước khi gửi. Output là cấu hình VPS (không phải dữ liệu user); Phuc tự quyết gửi trước hay sau khi công ty OK. Tool Tầng 1 đã tự phát hiện container/DB nên không bị chặn bởi Phase 0.

### Phase 1: Artifact (ĐÃ CÓ trong `setup/`, chờ Phuc review)
```
setup/
  install.sh  uninstall.sh  verify.sh
  lib/common.sh                  mask + timeout + cắt output
  bin/                           9 tool + ops-dispatch (ForceCommand) + claude-session (tmux)
  sudoers/claude-tools           group claude-tools, từng đường dẫn, tool không tham số khai báo ""
  ssh/50-claude-ro.conf          Match claude-ro/ops-ro: key-only, no forwarding, key file root-owned
  claude/managed-settings.json   forceLoginMethod claudeai, deny Edit/Write/.env/.ssh, allow tool
  sql/claude_ro.sql              role claude_ro (pg_monitor, read-only, không mật khẩu) + ro_counts()
  home/                          .bash_profile, .tmux.conf
  config/config.example          /etc/claude-tools/config
  keys/                          Phuc đặt claude-ro.pub, ops-ro.pub
  docs/RUNBOOK.md  THREAT_MODEL.md
```
Đã test local: cú pháp, validate tham số (injection, traversal, ký tự lạ, N quá lớn), ops-dispatch chặn lệnh ngoài danh sách, mask. **Chưa chạy trên Ubuntu thật.**

### Phase 2: Cài đặt (Phuc chạy)
`sudo ./install.sh [--with-rclone]` theo `docs/RUNBOOK.md`. Giữ một SSH session `deploy` dự phòng. Script tự rollback file sudoers/sshd nếu `visudo -c`/`sshd -t` lỗi, và kiểm tra user `deploy` không bị ảnh hưởng.

### Phase 3: Verify và acceptance
`sudo ./verify.sh` (0 FAIL) → thử snippet và Claude từ điện thoại → ghi PASS/PARTIAL/FAIL mục 8. Theo dõi RAM 3 ngày: `systemctl status user-<uid>.slice` (peak), `vmstat` si/so; swap in/out liên tục ≠ 0 → cân nhắc 4GB.

### Phase 3b: Tầng 2 (khi công ty OK)
`sudo ./install.sh --enable-claude-tools` → Claude gọi được tool. Chạy lại `verify.sh`.

### Phase 4 (tùy chọn): write tier, mục 7. Chưa làm.

### Phase 5 (tùy chọn): alert deterministic
Cron + Telegram/email cho RAM/disk/container down/backup tuổi. Không LLM. Snippet `summary` đã phủ nhu cầu xem tay.

### 6.3 Đặc tả tool

Chung: `set -euo pipefail`, không `eval`, validate allowlist/regex, timeout mọi lệnh con, cắt output 60KB, mask (JWT, API key `gsk_`/`sk-`/`ghp_`, Bearer, URL có mật khẩu, `*password|secret|token|key*=...`, email, sđt VN, chuỗi dài, IP public).

| Tool | Chức năng | Tham số |
|---|---|---|
| `vps-status` | uptime, free, swap, df, vmstat 1 5, top 10 RSS, PSI | không |
| `dc-ps` | status, health, uptime, image, port | không |
| `dc-stats` | `docker stats --no-stream` | không |
| `dc-logs` | log đã mask, lọc level | `<container>` (phải tồn tại, khớp chính xác) `[N≤500] [since ^\d{1,4}[smhd]$] [all\|error\|warn]` |
| `dc-restarts` | RestartCount, OOMKilled, ExitCode, Started/Finished + OOM kernel 7 ngày | không |
| `dc-version` | image, id, label revision/version, created | không |
| `pg-ro` | `activity connections locks db-size table-sizes slow counts settings` (SQL cố định) | 1 subcommand |
| `backup-check` | cron + log backup + list R2 (tuổi bản mới nhất, cảnh báo >26h); `verify`: tải dump mới nhất vào tmp root-only, `pg_restore -l`, xóa | `[verify]` |
| `sec-check` | port, ufw, sshd -T, fail2ban, SSH fail 24h, last, bản vá, reboot, hạn SSL (`SSL_DOMAINS`) | không |

### 6.4 Security verify (`verify.sh`)
user/group (không docker/sudo/adm), docker bị từ chối, sudo chỉ đúng tool, Tầng 1 claude-ro không gọi được tool, không ai ngoài root ghi được tool/sudoers/key/managed settings, `.env` không đọc được, injection bị chặn, claude_ro không SELECT/DELETE/CREATE (trong transaction + ROLLBACK), mask, sshd hiệu lực đúng cho claude-ro/ops-ro/deploy, không có API key/apiKeyHelper/autoContinue, giới hạn RAM.

## 7. Phase 4: Write tier (chỉ khi Phuc yêu cầu)

Giữ nguyên thiết kế cũ: runbook có tên, root-owned trong `/opt/claude-tools/runbooks/`, `plan` (transaction + ROLLBACK + plan-hash) → `apply --plan-hash` (snapshot trước, role `claude_rw` không DDL/TRUNCATE, audit append-only). Claude chỉ viết đề xuất vào `~/proposals/`, Phuc review và promote thủ công.

Điều kiện tiên quyết: đã restore thử backup R2; có bản sao DB để thử (hoặc Phuc chấp nhận rủi ro bằng văn bản); 3-5 việc ghi cụ thể; công ty OK Tầng 2.

## 8. Acceptance

| # | Câu hỏi | Kênh | Kỳ vọng |
|---|---|---|---|
| 1 | VPS ổn không (RAM/disk/load)? | snippet `vps-status` | PASS |
| 2 | Container nào up/down/unhealthy? | `dc-ps` | PASS |
| 3 | Container nào ăn RAM/CPU nhất? | `dc-stats` | PASS |
| 4 | Swap có thrash không? | `vps-status` | PASS |
| 5 | Disk còn bao lâu thì đầy? | `vps-status` | PARTIAL (không có lịch sử) |
| 6 | Backend lỗi gì 1h qua? | `dc-logs pfm-backend-container 100 1h error` | PASS nếu log có level |
| 7 | Vì sao container X restart? | `dc-restarts` + `dc-logs` | PASS |
| 8 | Có OOM kill? | `dc-restarts` | PASS |
| 9 | Connection, query chạy lâu? | `pg-ro connections/activity/slow` | PASS; lịch sử cần `pg_stat_statements` |
| 10 | ~~Redis~~ | | N/A |
| 11 | API chậm từ lúc nào? | | FAIL: log không có duration (cần middleware ở backend) |
| 12 | Bản đang chạy là commit nào? | `dc-version` + git | PASS nếu image gắn SHA |
| 13 | 5 commit gần nhất đổi gì? | Claude + git | PASS |
| 14 | Backup gần nhất, dump đọc được? | `backup-check [verify]` | PASS khi có R2 read-only |
| 15 | Bản vá, cần reboot? | `sec-check` | PASS |
| 16 | SSH sai nhiều lần? | `sec-check` | PASS |
| 17 | Port mở? | `sec-check` | PASS |
| 18 | SSL còn hạn? | `sec-check` | PASS nếu cấu hình `SSL_DOMAINS` |
| 19 | Bao nhiêu user/transaction, hôm nay thêm? | `pg-ro counts` | PASS (số đếm) |
| 20 | DB to bao nhiêu, bảng nào lớn? | `pg-ro table-sizes` | PASS |
| 21 | Tính năng X ở file nào? | Claude | PASS |
| 22 | Plan tính năng mới | Claude | PASS (plan trong chat) |
| 23 | TODO/FIXME/endpoint thiếu test | Claude | PASS |
| 24 | Dependency cũ/lỗ hổng | Claude | PARTIAL |
| 25 | Phân tích lỗi (1-20) bằng Claude | Claude + tool | Tầng 2 |

Negative: Claude restart container, đọc `.env`, xóa file, `docker exec`, ghi DB, sửa `/opt/claude-tools`, thêm SSH key → đều phải bị từ chối.

## 9. Việc CHỈ Phuc làm

1. Kiểm tra extra usage đang tắt (claude.ai → Settings → Usage).
2. Tạo 2 SSH key trên Termius, đặt public key vào `setup/keys/`.
3. Review và chạy `install.sh` / `verify.sh` (giữ session dự phòng).
4. Tạo deploy key read-only trên GitHub, clone repo.
5. `/login` Claude bằng tài khoản công ty.
6. (Tùy chọn) tạo R2 token read-only + `rclone.conf`.
7. Báo công ty trong vài ngày; quyết định bật Tầng 2.
8. Restore thử backup (trước Phase 4).

## 10. Mẫu báo cáo cuối mỗi phase

```
Phase: <n>  | Trạng thái: DONE / BLOCKED
Đã làm: <ngắn>
Phát hiện (kèm bằng chứng, không secret): <...>
Thay đổi hệ thống: <không / liệt kê>
Tài nguyên: MemAvailable trước/sau, swap in/out, load
Rủi ro còn lại / Open Questions: <...>
Cần Phuc làm: <...>
Đề xuất bước tiếp: <...>
```

## 11. Quyết định đã chốt

- Remote Control bị org tắt → **SSH + tmux + Termius**. Nếu công ty bật lại Remote Control, có thể thêm sau; phần tool/sudoers giữ nguyên.
- Snippet cho câu cố định (0 quota), Claude cho câu cần suy luận.
- Hai tầng: Tầng 1 ngay, Tầng 2 chờ công ty.
- Chỉ đọc trước, ghi sau qua runbook.
- Tool + sudoers whitelist thay vì docker group.
- Không tự build GUI/bot gọi Claude.
- GitNexus hoãn. Groq vẫn là provider AI của app.

## 12. Open Questions

1. SSH port 22 đang mở public hay chỉ qua Cloudflare/Tailscale? (Phase 0 trả lời.) Nếu public: giữ key-only + fail2ban, hoặc cân nhắc Tailscale (~40MB RAM) để đóng port.
2. Q8: Claude có được sửa code trong clone của nó không? Hiện deny Edit/Write (chỉ plan).
3. Đã restore thử backup R2 chưa? Tạo được R2 token read-only không?
4. Câu 11: có thêm middleware access log (duration) vào backend không?
5. Có bật `pg_stat_statements` không (cần restart Postgres)?

## 13. Rủi ro tổng hợp

| Rủi ro | Giảm thiểu |
|---|---|
| OOM trên máy 1.9GB | user slice 550M/750M/swap 512M, oom_score_adj 800, một session |
| Vượt hạn mức / tốn tiền ngoài gói | Chỉ subscription (`forceLoginMethod`), chặn API key, extra usage tắt, snippet cho câu lặp |
| Công ty không đồng ý | Tầng 1 không gửi dữ liệu prod; báo sớm; có `uninstall.sh` |
| Leo quyền qua tool/sudoers | Root-owned, validate tham số, verify.sh |
| Backdoor SSH qua claude-ro | Key file root-owned, restrict, ForceCommand cho ops-ro |
| Lộ secret/PII | Mask, quyền file, DB role không SELECT bảng app |
| Prompt injection | Quyền ghi bị cắt từ OS |
| Mất kết nối di động | tmux giữ session, Mosh tùy chọn |
