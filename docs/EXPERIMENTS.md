# Thực nghiệm RQ01–RQ03 — kết quả local

Được tạo lại bằng `npm --prefix backend run experiment:report` từ JSON thực đo. Không phải benchmark Cloudflare production. Mỗi tệp chứa thời điểm UTC, ngày Việt Nam, commit nền/trạng thái working tree, Node/OS, thiết bị và môi trường. Dữ liệu nghiệp vụ là fixture tổng hợp; thời gian và HTTP được đo từ thao tác thực.

## Giới hạn Cloudflare đã tra cứu ngày 21/11/2026

| Tài nguyên Free | Giới hạn tài liệu hiện hành |
| --- | --- |
| Worker dynamic requests | 100000/ngày, reset UTC |
| Worker CPU | 10 ms/invocation; khác wall-clock latency |
| Worker memory | 128 MB |
| D1 rows read | 5 triệu/ngày |
| D1 rows written | 100000/ngày; index cũng phát sinh row writes |
| D1 storage | 500 MB/database; 5 GB tổng; tối đa 10 database |

Nguồn: [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/). Free là giới hạn dùng thử cần theo dõi, không phải năng lực vô hạn. Quét nhiều hàng và polling nhiều tab có thể chạm quota dù số request nhỏ. Mọi số đo dưới đây chạy local nên không sử dụng hoặc kiểm chứng quota hosted.

PBKDF2-SHA256 giữ 310000 vòng và salt 32 byte; local verify Node seed hash PASS. [Workerd limit-enforcer](https://github.com/cloudflare/workerd/blob/main/src/workerd/io/limit-enforcer.h) và [PR #7550](https://github.com/cloudflare/workerd/pull/7550) cho thấy giới hạn PBKDF2 và override của open-source runtime là điểm cần kiểm tra riêng. Không coi local PASS là hosted PASS. Nếu hosted không hỗ trợ hoặc vượt CPU Free, nghiệm thu login BLOCKED; không hạ vòng hash/đổi thuật toán hoặc mua gói tự động. Worker trả 503 khi WebCrypto báo không hỗ trợ.

## RQ01 / TN01 — nhận đồng thời

Câu hỏi: conditional UPDATE + D1 batch có ngăn hai collector cùng thắng? Tạo mười đơn qua HTTP, với mỗi đơn dùng `Promise.all` gửi hai POST từ cookie TG01/TG02 độc lập. Sau khi response về, truy vấn trực tiếp D1 để kiểm tra CollectorId, AcceptedAt, số log và actor. UPDATE và INSERT log là hai statement cùng batch; log có điều kiện changes()=1. Không mock D1 hoặc chỉ nhìn UI.

| Môi trường | Lượt | HTTP 200 | HTTP 409 | ACCEPT/đơn |
| --- | ---: | ---: | ---: | ---: |
| workerd + isolated D1 local | 10 | 10 | 10 | 1 |

Thời điểm bằng chứng: 2026-11-21T01:08:20.402Z. [Mẫu thô, collector/timestamp/log](evidence/integration.json). Ngoài TN01, integration cố ý gây lỗi INSERT log CREATE/ACCEPT/COMPLETE để kiểm chứng rollback toàn giao dịch. Kết luận chỉ áp dụng mười lượt và runtime đã chạy; chưa chứng minh tải lớn hoặc hosted.

## RQ02 / TN02 — polling và độ trễ giao diện

Hai browser context cookie độc lập (DAN quan sát, THUGOM đổi trạng thái); Edge 158.0.4370.33, viewport 1366×900, Windows, loopback. Mỗi chu kỳ có năm ACCEPT trên năm đơn khác nhau. Chờ offset ngẫu nhiên trước POST để thay đổi pha polling. Timestamp POST lấy sau khi response được đọc ở browser collector; MutationObserver ghi lúc card DAN render trạng thái mới. GET được đếm riêng `/api/requests/mine`, không gồm auth/me, màn hình collector hoặc drawer. Cửa sổ quan sát ít nhất 60 giây/mức; GET/phút = count × 60000 / thời gian thực tế.

| Chu kỳ | Mẫu | Trễ TB (ms) | Trễ max (ms) | Thời gian quan sát (ms) | GET đếm | GET/phút đo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2s | 5 | 1130.80 | 1914 | 60002 | 30 | 30.00 |
| 5s | 5 | 3076.80 | 4686 | 60009 | 12 | 12.00 |
| 10s | 5 | 6244.60 | 8414 | 60000 | 6 | 6.00 |

Thời điểm: 2026-11-21T01:12:29.820Z. [Mẫu thô](evidence/tn02.json). Polling được lập lịch sau khi lượt GET trước kết thúc; còn thời gian mạng, CPU và render. Mẫu ít và pha ngẫu nhiên nên trung bình không nhất thiết đơn điệu giữa hai lần chạy. Không cam kết mọi cập nhật dưới năm giây. Build thử nghiệm ở thư mục tạm; build bình thường mặc định 5000 ms. Hidden-tab branch được browser suite thử bằng visibilitychange điều khiển; thí nghiệm timing này dùng hai trang visible, không giả lập đồng hồ.

## RQ03 / TN03 — API dưới tải nhỏ

Mỗi API chính hai mươi mẫu tuần tự (concurrency 1), dùng Node fetch + performance.now tới khi đọc xong JSON response. Login chuẩn bị session không nằm trong latency bảng; auth chức năng đã kiểm tra riêng. Không loại warmup. p95 dùng nearest rank ceil(0.95×n). Mỗi POST dùng trạng thái/đơn phù hợp, giữ các sample hợp lệ. GET mine có thêm năm nhóm × bốn request đồng thời, báo riêng. Ngày đo 2026-11-21T01:09:12.137Z; v24.21.0, win32 x64, network loopback.

| Endpoint | Đồng thời | n | Mean ms | p95 ms | Max ms | HTTP | 429/5xx |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| POST /api/requests | 1 | 20 | 7.22 | 8.41 | 10.35 | 201×20 | 0.00% |
| GET /api/requests/available | 1 | 20 | 5.71 | 6.69 | 7.14 | 200×20 | 0.00% |
| POST /api/requests/:id/accept | 1 | 20 | 6.76 | 7.99 | 17.73 | 200×20 | 0.00% |
| GET /api/requests/assigned | 1 | 20 | 6.61 | 7.93 | 7.97 | 200×20 | 0.00% |
| POST /api/requests/:id/complete | 1 | 20 | 7.52 | 8.93 | 9.03 | 200×20 | 0.00% |
| GET /api/auth/me | 1 | 20 | 4.02 | 5.01 | 6.01 | 200×20 | 0.00% |
| GET /api/requests/mine | 1 | 20 | 6.42 | 8.02 | 12.85 | 200×20 | 0.00% |
| GET /api/requests/:id | 1 | 20 | 5.39 | 6.56 | 6.83 | 200×20 | 0.00% |
| GET /api/admin/requests | 1 | 20 | 6.06 | 6.86 | 10.24 | 200×20 | 0.00% |
| GET /api/admin/stats | 1 | 20 | 5.68 | 6.51 | 6.95 | 200×20 | 0.00% |
| GET /api/requests/mine | 4 | 20 | 19.60 | 24.51 | 24.76 | 200×20 | 0.00% |

[Mẫu thô và HTTP](evidence/tn03.json). Latency đo là round trip local, không phải CPU time của Worker. Dataset nhỏ, thiết bị và cạnh tranh tài nguyên local ảnh hưởng số đo. Không suy diễn sức tải Internet, autoscaling, cold start hay hạn CPU Free từ bảng này.

## Chạy lại và phần còn BLOCKED

Từ repo root, chạy integration, experiment:api, experiment:polling rồi experiment:report theo README. Scripts chỉ chạy workerd/D1 local cô lập, không nhận URL remote hoặc cookie thật. Muốn thực nghiệm hosted cần phê duyệt riêng account/database test, kế hoạch số request/rows và cách cung cấp session qua môi trường không ghi log. Không sửa script để trỏ production có dữ liệu thật.

Hosted TN01–TN03, HTTPS hai thiết bị, usage/CPU dashboard: **BLOCKED chờ quyền deploy và môi trường thử nghiệm**. Chưa có số đo production. Giới hạn Cloudflare có thể thay đổi; kiểm tra lại các nguồn trên và gói tài khoản ngay trước deployment/thực nghiệm remote.
