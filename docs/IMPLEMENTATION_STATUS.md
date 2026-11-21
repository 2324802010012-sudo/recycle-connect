# Trạng thái triển khai — Baseline v1.4 theo prompt

Nhánh `audit/baseline-v1.4`; chưa merge/push main. Không có bản Baseline/rubric gốc, vì vậy bảng dưới chỉ đối chiếu yêu cầu đã cung cấp. PASS local không đồng nghĩa nghiệm thu cloud.

| Mã | Màn hình / chức năng | Kết quả local | Hosted |
| --- | --- | --- | --- |
| F01 / M01 | Đăng nhập/logout, phiên tám giờ, quyền | PASS API + browser | BLOCKED; cần xác nhận PBKDF2/CPU |
| F02 / M03 | Form ba bước, giữ dữ liệu, chống bấm gửi liên tiếp | PASS browser + D1 | BLOCKED |
| F03 / M02 | Đơn cá nhân, KPI, status, pagination | PASS | BLOCKED |
| F04 / M04 | Đơn chờ, waste/area, che thông tin riêng | PASS | BLOCKED |
| F05 / M04 | Tự nhận đơn | PASS | BLOCKED |
| F06 / M04 | Đúng người nhận hoàn thành | PASS | BLOCKED |
| F07 / M06 | Chi tiết + ba mốc thực, Escape/focus | PASS | BLOCKED |
| F08 / M05 | Dashboard KPI và ba biểu đồ thực | PASS browser và SQL aggregate | BLOCKED |
| F09 / M05 | Toàn bộ đơn và filters/page | PASS | BLOCKED |
| F10 | Polling mặc định 5s, offline/401/409/logout | PASS hai context; hidden branch dùng visibilitychange điều khiển | BLOCKED trên hai thiết bị |
| F11 | Chống nhận trùng, transaction log | PASS 10 cuộc tranh nhận + SQL + rollback | BLOCKED |
| F12 (P1) | Gợi ý ưu tiên, mặc định tắt | PARTIAL: code hiện có test PASS, thiếu Baseline để xác nhận hàm điểm | BLOCKED |

Đã sửa: lỗi mất thông báo tạo thành công do lifecycle ProtectedRoute; logout hết phiên; input auth sai kiểu; auth response code/data; ID nhận không tồn tại; expiry lệch vài mili giây. Đã bổ sung limiter, shared policy, migration guard, test/evidence, tài liệu/sơ đồ và script thực nghiệm.

Giới hạn: chưa có idempotency key ở API create. Ref/disabled ngăn thao tác nhấp lặp trong cùng form; nếu mất phản hồi POST, UI cảnh báo kiểm tra danh sách trước gửi lại, không tự retry. Không hứa exactly-once khi client tự gửi nhiều HTTP POST độc lập. F11 conditional UPDATE bảo đảm duy nhất người nhận trong các cuộc tranh nhận đã thử.

P0 còn lại cho nghiệm thu cloud: CLI hiện chưa đăng nhập Cloudflare (`whoami` read-only); cần tài khoản/database và quyền deploy, sau đó xác minh đăng nhập hosted, cookie Secure/HTTPS, dữ liệu hai thiết bị, Usage/CPU và TC/TN remote được duyệt. P1 còn lại: đối chiếu F12 với Baseline gốc, đánh giá query/index với dữ liệu lớn nếu phạm vi cho phép. Không bổ sung AI/GPS/map/chat/thanh toán/hủy/sửa/xóa đơn.

## Câu hỏi bảo vệ và bằng chứng

| Câu hỏi | Cách trả lời bằng bằng chứng |
| --- | --- |
| Vì sao là Cloud/Serverless? | Worker + static assets + managed D1; không quản lý server; ARCHITECTURE; cần dashboard cloud thật sau deploy |
| Hai người bấm nhận thì sao? | SQL UPDATE điều kiện + batch + changes(); TN01 200/409, một collector/log |
| Log ghi lỗi có lệch trạng thái? | Integration chủ động RAISE lỗi log, cả batch rollback cho ba action |
| UI có thể tự đổi role để vượt quyền? | Backend đọc role/UserId từ session D1; TC18 ma trận HTTP trực tiếp |
| Vì sao thu gom chưa thấy địa chỉ? | publicRequest bỏ address/note của CHO_NHAN; TC17 thử cả detail/list |
| Polling 5 giây có luôn dưới 5 giây? | Không; còn thời gian GET/render/mạng và chu kỳ bắt đầu sau lượt tải; TN02 là mẫu quan sát |
| Số đo local có chứng minh cloud scale? | Không; metadata ghi loopback/workerd, chưa suy diễn tải lớn hay global latency |
| Vì sao login local PASS nhưng cloud còn chặn? | Limit-enforcer/runtime và quota CPU có thể khác; cần hosted smoke test, không hạ policy để che lỗi |
| Logout thực sự thu hồi chưa? | D1 RevokedAt, cookie cũ replay 401 và browser về login |
| Khi deploy lỗi thì sao? | Version Worker rollback độc lập D1; backup/Time Travel theo quyền và giới hạn, DEPLOYMENT |
