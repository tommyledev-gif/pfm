# Câu hỏi để chốt context cho remote-agent

Cách trả lời: đánh `x` vào ô chọn (`- [x]`). Nếu không có option nào đúng thì điền vào dòng `Other:`. Dòng `Ghi chú:` không bắt buộc.
Câu nào chưa biết thì chọn "Chưa biết", mình sẽ đưa nó vào Phase 0 discovery.

---

## A. Executor và môi trường làm việc

### Q1. AI executor (mình) sẽ làm việc theo kiểu nào?
- [ ] Mình chỉ sinh file ở repo local này (`d:\personal-projects\remote-agent`), Phuc tự copy (scp/git) lên VPS
- [ ] Claude Code trên laptop/WSL SSH vào VPS bằng user `deploy`, chạy Phase 0 trực tiếp
- [ ] Claude Code cài thẳng trên VPS, chạy bằng user `deploy`
- [ ] Other: ___
- Ghi chú:

### Q2. User `deploy` trên VPS đang thuộc group nào?
- [ ] `docker` (tức là đã ngang quyền root)
- [ ] `sudo`
- [ ] Cả `docker` và `sudo`
- [ ] Không thuộc group nào đặc biệt
- [ ] Chưa biết
- [ ] Other: ___

### Q3. VPS ở provider nào, có snapshot/backup cấp VPS không?
- [ ] Có snapshot tự động (provider)
- [ ] Có thể chụp snapshot thủ công trước khi chạy `install.sh`
- [ ] Không có snapshot
- [ ] Other (tên provider, gói): ___

### Q4. Lúc chạy `sudo ./install.sh`, Phuc có giữ được session root dự phòng không (console provider hoặc SSH thứ hai)?
- [ ] Có web console của provider
- [ ] Chỉ có SSH, sẽ mở 2 session
- [ ] Other: ___

---

## B. Phạm vi và lộ trình

### Q5. Phạm vi lần này?
- [ ] Chỉ Phase 0 đến 3 (read-only), chạy vài tuần rồi mới tính Phase 4
- [ ] Đã chắc chắn làm Phase 4 (write tier), thiết kế luôn từ đầu
- [ ] Chỉ Phase 0 trước, xem kết quả rồi tính
- [ ] Other: ___

### Q6. Có mốc thời gian không?
- [ ] Không gấp, làm kỹ
- [ ] Muốn dùng được trong 1 đến 2 tuần
- [ ] Gấp, trong vài ngày
- [ ] Other: ___

### Q7. Phase 5 (alert deterministic, không LLM) gửi qua kênh nào?
- [ ] Telegram bot
- [ ] Email
- [ ] Lark
- [ ] Chưa cần Phase 5
- [ ] Other: ___

### Q8. Claude trên VPS có được viết code không?
- [ ] Không, chỉ đọc code và trả plan trong chat (như proposal)
- [ ] Được sửa code trong clone local của `claude-ro`, nhưng không push
- [ ] Được push branch riêng / mở PR (cần deploy key có quyền ghi)
- [ ] Other: ___

---

## C. Policy và tài khoản

### Q9. Công ty đã xác nhận việc code + log (đã mask) đi qua Anthropic chưa?
- [ ] Đã xác nhận bằng văn bản
- [ ] Đã hỏi miệng, OK
- [ ] Chưa hỏi
- [ ] Other: ___

### Q10. Subscription Claude của công ty là gói nào?
- [ ] Pro
- [ ] Max
- [ ] Team
- [ ] Enterprise
- [ ] Chưa biết
- [ ] Other: ___
- Ghi chú (admin có tắt Remote Control hay áp managed policy gì không):

### Q11. Sau này có người khác (dev khác) dùng chung setup này không?
- [ ] Không, chỉ Phuc
- [ ] Có thể có 1 đến 2 người trong vài tháng tới
- [ ] Other: ___

---

## D. App và repo

### Q12. Backend viết bằng gì?
- [ ] Node.js / TypeScript (NestJS, Express...)
- [ ] Python (FastAPI, Django...)
- [ ] Go
- [ ] Java / Kotlin
- [ ] Other: ___

### Q13. Repo tổ chức thế nào?
- [ ] Monorepo (mobile + backend + ai-service chung một repo)
- [ ] Nhiều repo riêng
- [ ] Other: ___
- Ghi chú (GitHub URL hoặc tên repo, branch chính, repo nào cần clone lên VPS):

### Q14. Kích thước repo cỡ nào (ảnh hưởng RAM/disk khi clone trên VPS 1.9GB)?
- [ ] Nhỏ (< 200MB)
- [ ] Trung bình (200MB đến 1GB)
- [ ] Lớn (> 1GB, có asset/history nặng)
- [ ] Chưa biết
- [ ] Other: ___

### Q15. Deploy hiện tại làm thế nào?
- [ ] SSH vào VPS, `git pull` + `docker compose up -d --build`
- [ ] CI (GitHub Actions) build image, push registry, VPS pull về
- [ ] CI SSH vào VPS chạy script
- [ ] Other: ___

### Q16. Image đang chạy có gắn commit SHA không?
- [ ] Có (tag hoặc label)
- [ ] Không, dùng `latest` hoặc build local
- [ ] Chưa biết
- [ ] Other: ___

### Q17. Compose file nằm ở đâu, có mấy compose project?
- [ ] Một file, trong thư mục repo trên VPS
- [ ] Một file, nằm riêng ngoài repo
- [ ] Nhiều project/file
- [ ] Chưa biết
- [ ] Other (đường dẫn): ___

---

## E. Database, Redis, backup, log

### Q18. Postgres có expose port ra host không? (quyết định tool `pg-ro` kết nối thế nào)
- [ ] Chỉ trong docker network, không publish port
- [ ] Bind `127.0.0.1:5432`
- [ ] Bind `0.0.0.0` (public)
- [ ] Chưa biết
- [ ] Other: ___

### Q19. `pg_stat_statements` đã bật chưa? Nếu chưa, có chấp nhận restart Postgres để bật không?
- [ ] Đã bật
- [ ] Chưa bật, OK restart vào giờ thấp điểm
- [ ] Chưa bật, không muốn restart, chấp nhận PARTIAL
- [ ] Chưa biết
- [ ] Other: ___

### Q20. Backup Postgres hiện tại làm thế nào và lưu ở đâu?
- [ ] Cron/script `pg_dump` lưu trên cùng VPS
- [ ] Có copy ra ngoài (S3/R2/Drive/máy khác)
- [ ] Provider tự backup (managed)
- [ ] Chưa biết, nhờ discovery
- [ ] Other: ___
- Ghi chú (format, retention nếu biết):

### Q21. Đã từng restore thử backup chưa?
- [ ] Đã restore thử thành công
- [ ] Chưa, nhưng sẵn sàng làm (cần hướng dẫn)
- [ ] Chưa, và chưa muốn làm lúc này
- [ ] Other: ___

### Q22. Có DB/instance nào khác để thử nghiệm không?
- [ ] Chỉ có prod trên VPS này
- [ ] Có DB local trên laptop với data giả
- [ ] Có thể dựng bản copy từ backup trên laptop
- [ ] Other: ___

### Q23. Log backend có những gì?
- [ ] JSON có level + request id + duration
- [ ] JSON có level, không có duration
- [ ] Text thường (console.log/print)
- [ ] Chưa biết
- [ ] Other: ___
- Ghi chú (log có chứa email, số điện thoại, token, số tiền theo user không):

### Q24. Redis có đặt password không?
- [ ] Có, qua env trong compose/.env
- [ ] Có, qua `redis.conf`
- [ ] Không có auth (chỉ trong docker network)
- [ ] Chưa biết
- [ ] Other: ___

---

## F. Network và bảo mật

### Q25. Có domain / SSL / reverse proxy không?
- [ ] Có, Nginx trên host + Let's Encrypt
- [ ] Có, Caddy/Traefik/Nginx trong container
- [ ] Có, qua Cloudflare (proxy/tunnel)
- [ ] Không có domain, gọi thẳng IP:port
- [ ] Other: ___

### Q26. SSH đang cấu hình thế nào?
- [ ] Key-only, tắt password, tắt root login
- [ ] Key + password vẫn bật
- [ ] Có fail2ban
- [ ] Chưa biết
- [ ] Other: ___

### Q27. Firewall?
- [ ] `ufw` đang bật
- [ ] Firewall của provider (cloud firewall)
- [ ] Không có firewall
- [ ] Chưa biết
- [ ] Other: ___

---

## G. Cách dùng thực tế

### Q28. Dùng app Claude trên thiết bị nào, đã thử Remote Control chưa?
- [ ] iOS, chưa thử Remote Control
- [ ] Android, chưa thử Remote Control
- [ ] Đã thử Remote Control (trên laptop) và chạy ổn
- [ ] Other: ___

### Q29. 4 câu acceptance PARTIAL (5 disk forecast, 11 API chậm từ lúc nào, 24 dependency audit, query chậm lịch sử của 9) xử lý thế nào?
- [ ] Chấp nhận PARTIAL
- [ ] Thêm thu thập lịch sử nhẹ (cron ghi metric ra file/SQLite, vài MB RAM)
- [ ] Cho phép `npm audit`/`pip-audit` chạy có mạng trên VPS
- [ ] Other: ___

### Q30. Nếu làm Phase 4, 3 đến 5 việc ghi DB cụ thể muốn nhờ AI làm là gì?
- [ ] Chưa làm Phase 4, bỏ qua
- [ ] Sửa data user theo ticket (vd sửa category, gộp transaction trùng)
- [ ] Seed/cập nhật bảng cấu hình (category mặc định, feature flag)
- [ ] Dọn data rác/test
- [ ] Other (liệt kê cụ thể): ___
