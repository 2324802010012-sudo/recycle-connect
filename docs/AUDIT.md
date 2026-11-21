# Audit Baseline v1.4 — 21/11/2026

Nguồn: yêu cầu người dùng, mã nguồn tại `a049d66`, lịch sử ba commit. Workspace sạch khi bắt đầu; làm trên `audit/baseline-v1.4`. Không có Baseline v1.4 đầy đủ hoặc rubric gốc trong workspace. F12 hiện có công thức 50/30/20 nhưng chưa thể xác nhận các hàm thành phần khớp tài liệu gốc.

Đã đọc backend, frontend, shared, schema, seed, Wrangler, README và cấu hình package/lint. Lint/build ban đầu PASS. Đăng nhập PBKDF2 310000 và tạo đơn + CREATE đã chạy thành công trên workerd local/D1 cô lập. Không suy ra production từ kết quả local.

| Ưu tiên | Tệp | Vấn đề | Nguyên nhân | Tác động | Cách sửa | Tiêu chí kiểm chứng |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | backend/tests (chưa có) | Không có test và bằng chứng tái lập | README chỉ mô tả lượt thử trước | Khó phát hiện hồi quy/kiểm chứng F11 | HTTP client độc lập, D1 local cô lập, SQL trước/sau, chèn lỗi để thử rollback | TC API, 10 cuộc tranh nhận, một ACCEPT/đơn, rollback batch |
| P0 | backend/src/index.js | Không giới hạn đăng nhập | Chưa có limiter | Brute force tiêu tốn CPU/hash | Rate limit binding trước bước hash, không thêm bảng | HTTP 429 + Retry-After trên local; ghi rõ giới hạn theo location |
| P0 | backend/src/index.js | Nhận giá trị JSON sai kiểu khi login | Ép String tùy ý | Hợp đồng đầu vào thiếu chặt chẽ | Chỉ nhận object và username/password string | Array, null, object/number bị 400 |
| P0 | backend/src/index.js | Auth thiếu error.code/data | Response auth khác nhóm requests | Client khó xử lý nhất quán | Bổ sung code/data, giữ user tương thích | Cả authService cũ và response contract đều chạy |
| P0 | authService.js, index.js | Logout phiên hết hạn báo lỗi, giữ cookie | 401 bị coi là logout thất bại | UI mắc ở trang đã hết phiên | Xóa cookie khi logout 401; client coi 401 là đã hết phiên | Logout rồi dùng lại cookie 401; UI về login |
| P0 | ProtectedRoute.jsx | Thông báo tạo đơn biến mất khi chuyển từ form về trang dân | Trang con mount trước khi effect kiểm tra route mới, rồi bị unmount; state thành công đã được xóa khỏi history | Người dùng không nhận xác nhận dù D1 đã lưu | Chỉ mount trang khi pathname hiện tại đã được kiểm tra phiên | Browser gửi form chỉ một POST, thấy thông báo thành công |
| P0 | index.js | Phiên có thể dài hơn tám giờ vài mili giây | CreatedAt và ExpiresAt dùng hai lần đọc đồng hồ | Sai giới hạn phiên | Tính expiry từ CreatedAt | So SQL ExpiresAt - CreatedAt đúng 28800000ms |
| P0 | backend/src/requests.js | Nhận ID không tồn tại trả 409 | Không phân biệt không tồn tại khi UPDATE không có hàng | HTTP contract sai | Kiểm tra tồn tại sau UPDATE thất bại | ID chưa có trả 404; tranh nhận vẫn 200/409 |
| P0 | index.js, seed-users.mjs | Tham số hash lặp lại ở hai nơi; hosted runtime chưa được kiểm chứng | Chính sách hash không dùng chung | Rủi ro đăng nhập khi deploy | Dùng chung policy, giữ 310000; lỗi runtime trả 503 rõ code, không hạ vòng lặp | Hash do Node seed tạo xác minh bằng Worker; hosted smoke test còn BLOCKED |
| P0 | frontend/services, tests | Polling/offline/mobile chưa có bằng chứng hiện tại | Không có browser test | Có thể sai F10 dù API đúng | Kiểm tra hai context, tab ẩn, offline/401/409, mobile/desktop | Browser thật + ảnh + report có timestamp |
| P1 | schema.sql | Chưa ràng buộc chronology, khu vực cố định, vai trò liên quan ở DB | Chủ yếu kiểm tra ở API | Dữ liệu nhập SQL ngoài API có thể không hợp lệ | Migration trigger chỉ chặn ghi mới sai, không sửa/xóa dữ liệu hiện hữu | SQL vi phạm bị từ chối, luồng API vẫn PASS |
| P1 | requests.js F12 | Chưa có Baseline gốc để đối chiếu hàm điểm | Thiếu tài liệu | Không thể kết luận F12 hoàn tất | Giữ mặc định tắt; test điểm/phân trang/thứ tự hiện có | Test hiện thực PASS; đối chiếu Baseline BLOCKED |
| P0 | docs, README | Thiếu báo cáo TC/TN/deploy, README v1.3 | Chưa lưu chứng cứ | Báo cáo không đủ truy vết | Tài liệu khớp code, JSON kết quả thật, sơ đồ Mermaid | Phân biệt PASS local / BLOCKED remote |

Thứ tự: test nền → xác thực/API → test D1 hồi quy → browser/experiment → tài liệu/dry-run. Giữ React/Vite/Tailwind, Worker/D1, 12 endpoint, enum và mã khu vực hiện có. Không deploy, ghi remote, push hoặc merge main trong lượt này.
