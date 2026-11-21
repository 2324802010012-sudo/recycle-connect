# Báo cáo kiểm thử local — 21/11/2026

Phạm vi: quy tắc trong prompt Baseline v1.4, không phải xác nhận rubric chưa được cung cấp. Bằng chứng máy đọc được: [integration.json](evidence/integration.json), [browser.json](evidence/browser.json). Các báo cáo chứa thời điểm UTC, ngày Việt Nam, commit nền/trạng thái working tree, Node, OS và môi trường. Nếu workingTree=modified, kết quả thuộc mã tại lần chạy có thay đổi, không phải chỉ commit nền.

Chạy lại từ repo root:

```powershell
npm --prefix backend test
npm --prefix frontend run build
npm --prefix backend run test:browser
npm --prefix frontend run lint
npm --prefix backend run deploy:check
```

Tests tạo D1 cô lập không dùng `backend/.wrangler/state` của người dùng hoặc D1 remote. Password fixture ngẫu nhiên trong RAM; không lưu password/token/cookie vào evidence. Browser dùng Edge/Chromium thật headless, context cookie riêng; `BROWSER_PATH` cho máy không có Edge ở vị trí chuẩn.

| TC | Nội dung | Kết quả local | Bằng chứng / giới hạn |
| --- | --- | --- | --- |
| TC01 | Ba vai trò đăng nhập | PASS | Node PBKDF2 hash → Worker verify; browser D01/TG01/TG02/AD01 |
| TC02 | Sai login/quyền | PASS | Mật khẩu sai/tài khoản lạ cùng response; sai kiểu/JSON/Origin; route sai quyền |
| TC03 | Tạo đơn hợp lệ | PASS | HTTP 201; D1 CHO_NHAN, CollectorId NULL, CREATE đúng actor |
| TC04 | Dữ liệu thiếu/sai | PASS | Boundary kg/address/note/date/area/enum; số hàng trước/sau không đổi |
| TC05 | Dân xem đơn người khác | PASS | D02 không đọc được D01; trả 404 |
| TC06 | Thu gom nhận | PASS | Conditional UPDATE; actor/time đúng |
| TC07 | Hai người cùng nhận | PASS | 10 lượt, mỗi lượt 200/409; SQL đúng một ACCEPT |
| TC08 | Người khác hoàn thành | PASS | 403; state/log không đổi |
| TC09 | Đúng người hoàn thành | PASS | 200; gọi lại 409 |
| TC10 | Timeline ba mốc | PASS | Ba timestamp khớp SQL/log; browser hiển thị ba time khi đã hoàn thành |
| TC11 | Hai phiên đồng bộ | PASS | Hai browser context độc lập; CREATE/ACCEPT hiện qua polling |
| TC12 | KPI/biểu đồ khớp SQL | PASS | byStatus, byWasteType, cả 14 ngày so SQL độc lập; browser render chart |
| TC13 | Gợi ý ưu tiên | PARTIAL | Test công thức hiện có, điểm 90, tie-break và pagination PASS; thiếu Baseline gốc để xác nhận toàn bộ F12 |
| TC14 | Mất mạng/API lỗi | PASS | Offline giữ data và thời điểm cuối, retry; HTTP 409 báo lỗi và refresh |
| TC15 | Logout thu hồi | PASS | D1 RevokedAt; replay 401; browser logout hết phiên vẫn về login; không GET sau logout |
| TC16 | Refresh giữ phiên | PASS | Cookie còn hiệu lực; browser reload; token sai/expired bị 401 |
| TC17 | Chi tiết theo quyền | PASS | DAN/TG/ADMIN; che address/note đơn chờ; đơn ngoài quyền 404 |
| TC18 | API trái vai trò | PASS | Ma trận direct HTTP cho 8 route có role; thiếu session 401 |
| TC19 | Action/actor | PASS | CREATE/ACCEPT/COMPLETE và timestamp khớp Requests |
| TC20 | Lọc/phân trang | PASS | Input sai 400; trang rỗng; không trùng trang; status/waste/date; browser pagination/admin filter |

Kiểm tra bổ sung: rollback cả CREATE/ACCEPT/COMPLETE khi cố ý gây lỗi log; tám CREATE đồng thời; trigger migration không cho sửa/lùi trạng thái; đúng bốn bảng nghiệp vụ; giới hạn login trả 429. Lượt rate-limit riêng hạ ngưỡng **chỉ trong test** xuống một để kiểm tra nhánh 429 nhanh, không đổi cấu hình production 10/60. Binding Cloudflare là xấp xỉ theo location, không khẳng định request thứ 11 luôn bị chặn.

Browser chạy desktop 1366×900 và mobile 390×844, không horizontal overflow; kiểm tra form giữ dữ liệu, chặn bấm gửi hai lần, thông báo thành công, ghi chú HTML chỉ là text, Escape/trả focus, offline, login và logout. Ảnh thật ở [screenshots](evidence/screenshots). Visibility test điều khiển `document.hidden` rồi phát `visibilitychange` để kiểm tra hook dừng/tiếp tục GET; chưa thay thế nghiệm thu thao tác chuyển tab vật lý trên hai thiết bị.

`API error: Error` xuất hiện ba lần trong integration là chủ động chèn lỗi log để thử rollback. Đây là lỗi dự kiến trong môi trường test, không chứa SQL/địa chỉ/secret. Những lượt FAIL phát hiện lỗi trong quá trình sửa đã được sửa và chạy lại; JSON chứa lượt chạy mới nhất, không gán PASS cho hosted tests chưa chạy.

## BLOCKED / nghiệm thu còn lại

- Production HTTPS, Secure cookie trên Cloudflare hosted, hai thiết bị thật, Usage dashboard và CPU quota: chưa deploy, chờ phê duyệt.
- PBKDF2 hosted có thể khác workerd local; cần smoke test đúng tài khoản/gói trước khi nghiệm thu F01 trên cloud.
- Đối chiếu công thức F12 và rubric: thiếu tài liệu gốc.
- Chuyển tab thực, keyboard/thiết bị trình duyệt khác và kiểm tra accessibility sâu vẫn cần lượt nghiệm thu thủ công; không tuyên bố đã kiểm tra mọi thiết bị.
