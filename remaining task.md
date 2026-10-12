Còn phải làm (xếp theo độ ưu tiên)
Deploy backend. Đây là việc quan trọng nhất vì 2 việc khác đang chờ nó.
Chạy lại workflow trên develop. Lần trước deploy nhầm commit f57a579.
/users/me đang trả 404.
Chạy migration 030 và 031 trước khi deploy backend.
Deploy xong thì 2 việc sau mới chạy được: sửa ghim vị trí (server cũ báo lỗi khi lưu pin đã dời) và yêu cầu tạo tài khoản.
Dọn VPS
Trong deploy.sh, thêm lệnh chmod 600 cho .env.prod sau khi ghi file.
Báo công ty, nếu OK thì bật Tầng 2.
Reboot VPS để lên kernel mới, chọn giờ ít người dùng.
Vài ngày nữa đo lại RAM.
AI service: bỏ "—" và "nhé" khỏi câu trả lời.
Seed giao dịch từ file xlsx: xem lại số dư mở ví VCB (ghi là "28,997 tỷ"), đúng rồi mới chạy ghi thật lên prod.
Cần bạn quyết định
PIN: có cần khóa app khi mở không? Nếu không thì đóng task.
Avatar mặc định lấy từ Gravatar/Google: làm tiếp hay bỏ?
Push notification: chưa bắt đầu.
Việc nhỏ còn sót
Yêu cầu tạo tài khoản chưa có nút Từ chối.
Thẻ đề xuất trong AI chat chưa hiện thuế, phí, giảm giá.
Tài khoản cũ chưa có tên đăng nhập, nên tạm thời chỉ đăng nhập được bằng email.
Test trên máy thật: nhiều task ghi "chưa test trên máy", nhất là phần yêu cầu tạo tài khoản (cần test với Postgres thật).
Trên bảng Roadmap, cả 6 module chưa xong đều đã quá hạn (hạn từ 6/10 đến 9/10):

Module	Tiến độ
Giao dịch	80%
Account	78%
AI Chat	75%
Bảo mật	50%
Seed data	0%
Push notification	0%
