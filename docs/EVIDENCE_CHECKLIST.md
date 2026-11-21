# Checklist bằng chứng

Ngày chạy local: 21/11/2026, chi tiết thời điểm/commit trong JSON. Ảnh đều lấy từ browser chạy ứng dụng thật với D1 fixture cô lập; dữ liệu này là dữ liệu nghiệp vụ thử nghiệm, không phải số liệu hiệu năng giả.

| Minh chứng | Trạng thái | Vị trí / việc còn làm |
| --- | --- | --- |
| Login, người dân, thu gom, admin | Có local | docs/evidence/screenshots/mobile-*.png; desktop-admin.png |
| Form ba bước và xác nhận | Có local | desktop-form-confirm.png, mobile-form.png |
| Timeline đủ ba mốc | Có local | desktop-detail-timeline.png; SQL integration |
| Offline giữ dữ liệu | Có local | desktop-offline.png; browser.json |
| HTTP 200/409 tranh nhận + CollectorId + một ACCEPT | Có local | integration.json → tn01.races |
| Rollback log lỗi | Có local | integration.json → Atomicity |
| TN02/TN03 số đo thật | Có local sau chạy script | tn02.json, tn03.json; không coi là hosted benchmark |
| Worker đã deploy/version | BLOCKED | Chờ phê duyệt deploy, chụp dashboard thực tế |
| URL HTTPS, chứng chỉ/cookie Secure | BLOCKED | Chụp URL và thuộc tính cookie, che giá trị cookie |
| D1 cloud và bốn bảng | BLOCKED | Chụp schema/tables, tránh dữ liệu riêng tư |
| Chia sẻ dữ liệu hai thiết bị | BLOCKED | Ghi hai thiết bị, hai session, thời điểm |
| Usage Free/CPU/request/rows | BLOCKED | Chụp dashboard và thời gian đo thực |

Không đưa mật khẩu, token, cookie, hash mật khẩu hoặc địa chỉ người dùng thật vào ảnh/log. Khi nghiệm thu hosted, ghi URL, version/commit, ngày giờ, thiết bị/mạng, TC, HTTP status và câu SQL xác minh. Test artifacts không chứa password/cookie fixture.

Trước khi nộp: mở trực tiếp ảnh để kiểm tra chữ, modal và bố cục; đối chiếu JSON mới nhất với báo cáo. Không tái sử dụng số đo cũ nếu mã/tài nguyên/môi trường đã thay đổi mà không ghi rõ.
