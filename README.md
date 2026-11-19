# Recycle Connect

Recycle Connect giúp người dân đặt lịch thu gom rác tái chế, người thu gom xử lý yêu cầu và quản trị viên theo dõi tiến độ. Giao diện dùng React, Vite, Tailwind CSS và font Inter. Cloudflare Worker phục vụ frontend và REST API trên cùng origin. Cloudflare D1 là cơ sở dữ liệu dựa trên SQLite.

## Chạy cục bộ

Các lệnh bên dưới dùng PowerShell trên Windows. Dự án đã chạy với Node.js 26.13.1 và npm.

**1. Cài thư viện và build giao diện**

Chạy tại thư mục gốc của repo.

```powershell
npm --prefix frontend ci
npm --prefix backend ci
npm --prefix frontend run build
```

**2. Khởi tạo D1 cục bộ và tạo tài khoản demo**

```powershell
Set-Location backend
npx wrangler d1 execute DB --local --file=schema.sql
$env:DEMO_PASSWORD = Read-Host 'Nhập mật khẩu demo từ 8 đến 128 ký tự'
node scripts/seed-users.mjs
Remove-Item Env:DEMO_PASSWORD
```

| Tài khoản | Vai trò |
| --- | --- |
| `D01` | Người dân |
| `TG01` | Người thu gom khu vực Thuận An |
| `TG02` | Người thu gom khu vực Thủ Dầu Một |
| `AD01` | Quản trị viên |

Mật khẩu ban đầu của các tài khoản là giá trị vừa nhập. Chạy lại seed sẽ cập nhật mật khẩu của các tài khoản được chọn. Để cập nhật riêng `TG02`, đặt lại `DEMO_PASSWORD` rồi chạy `node scripts/seed-users.mjs TG02`.

Dữ liệu chạy cục bộ được Wrangler lưu trong `backend/.wrangler/`. Thư mục này được Git bỏ qua. Sau khi clone, mỗi người cần khởi tạo D1 và seed tài khoản trên máy của mình. Danh sách yêu cầu ban đầu trống. Tên khu vực đi cùng mã nguồn trong [danh mục dùng chung](shared/request-options.mjs). Mã `KHU_VUC_1` hiển thị là **Thuận An**, mã `KHU_VUC_2` hiển thị là **Thủ Dầu Một**.

**3. Khởi động và đăng nhập**

Tiếp tục trong thư mục `backend`.

```powershell
npx wrangler dev --local --port 8787
```

Mở [http://localhost:8787](http://localhost:8787) để đăng nhập. Endpoint `/api/health` dùng để kiểm tra kết nối Worker với D1. Khi sửa giao diện, giữ Worker đang chạy và dùng một cửa sổ PowerShell khác tại thư mục gốc để chạy `npm --prefix frontend run dev`. Mở địa chỉ Vite in ra, thường là `http://localhost:5173`. Vite chuyển tiếp các yêu cầu `/api` đến Worker ở cổng 8787.

Worker phục vụ bản build trong `frontend/dist`. Chạy lại `npm --prefix frontend run build` từ thư mục gốc khi muốn xem thay đổi giao diện qua cổng 8787.

## Frontend đã triển khai theo baseline v1.3

| Màn hình | Chức năng |
| --- | --- |
| M01 · Đăng nhập | Hiện hoặc ẩn mật khẩu, báo lỗi, khôi phục phiên và chuyển trang theo vai trò. Khi mở trang sai quyền, người dùng thấy thông báo và có thể quay về trang của mình. |
| M02 · Người dân | Tổng quan hiển thị KPI toàn bộ yêu cầu cá nhân. Bấm thẻ trạng thái để lọc danh sách, chọn **Tất cả** để bỏ lọc. Có phân trang, xem chi tiết và nút **Trang trước** khi polling làm trang hiện tại hết đơn. |
| M03 · Tạo yêu cầu | Form ba bước gồm chọn loại rác và khối lượng, đặt lịch rồi xác nhận. Có thể sửa từng nhóm ở bước xác nhận. Form giữ dữ liệu khi quay lại, khóa nút trong lúc gửi và chuyển focus đến tiêu đề bước hoặc trường lỗi. |
| M04 · Người thu gom | Xem đơn chờ và đơn đã nhận, lọc theo khu vực và loại rác, nhận hoặc hoàn thành đơn. Giao diện xử lý xung đột khi người khác đã nhận. Gợi ý ưu tiên bật tùy chọn và mặc định tắt. |
| M05 · Quản trị | Có ba KPI, biểu đồ vòng theo trạng thái, biểu đồ thanh theo loại rác và biểu đồ đơn mới/hoàn thành trong 7 hoặc 14 ngày. Danh sách có bộ lọc, phân trang và chuyển sang dạng thẻ trên màn hình nhỏ. |
| M06 · Chi tiết | Tóm tắt yêu cầu, hiển thị dữ liệu theo quyền và timeline ba mốc theo giờ Việt Nam. Có nhãn **Hiện tại**, hỗ trợ đóng bằng `Escape` và trả focus về nút mở. |

Các màn hình dữ liệu có trạng thái đang tải, lỗi và danh sách rỗng. Polling chờ 5 giây giữa các lượt tải khi tab hiển thị. Khi lỗi kết nối, giao diện giữ dữ liệu gần nhất nếu có và báo **Chưa đồng bộ**.

## Backend đã triển khai

- **Xác thực:** đăng nhập, đọc phiên và đăng xuất. Worker phân quyền theo vai trò và từng yêu cầu. D1 lưu mật khẩu và token phiên ở dạng băm.
- **Yêu cầu thu gom:** tạo, liệt kê, lọc, phân trang, xem chi tiết, nhận và hoàn thành. Worker kiểm tra dữ liệu đầu vào và che địa chỉ, ghi chú của đơn chờ đối với người thu gom.
- **Quản trị:** API danh sách có bộ lọc và API thống kê theo trạng thái, loại rác và hoạt động theo ngày.
- **Dữ liệu D1:** bốn bảng `Users`, `Sessions`, `Requests` và `RequestLogs`. Thay đổi trạng thái và ghi nhật ký thực hiện trong cùng giao dịch. Khi hai người cùng nhận, chỉ một thao tác thành công, thao tác còn lại trả HTTP `409`.

## Kiểm tra và nghiệm thu

Chạy tại thư mục gốc để kiểm tra frontend.

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
```

Luồng tạo → nhận → hoàn thành đã được xác minh trên Edge với Worker và D1 cục bộ. Trong 10 lượt thử nhận đồng thời, mỗi lượt ghi nhận một HTTP `200`, một HTTP `409` và một log `ACCEPT` trên D1.

Ở lần rà soát gần nhất, lint không có cảnh báo và build thành công. Đã kiểm tra nhanh cả ba vai trò trên Edge ở chiều rộng 390 px với Worker và D1 cục bộ. Lượt này bao gồm bộ lọc của người dân, form và tên khu vực, thông báo sai quyền cùng biểu đồ quản trị.

### Checklist nghiệm thu frontend

Chạy ứng dụng theo mục **Chạy cục bộ**. Dùng các cửa sổ hoặc hồ sơ trình duyệt độc lập cho `D01`, `TG02` và `AD01` để mỗi vai trò có phiên riêng. Khi nghiệm thu chính thức, lặp lại trên URL HTTPS và ghi ngày, bản commit, URL, thiết bị cùng kết quả từng ca.

| Ca kiểm thử | Cách thực hiện | Điều kiện đạt |
| --- | --- | --- |
| M01 · Phiên và quyền | Thử mật khẩu sai, đăng nhập bằng từng vai trò, tải lại trang, mở route của vai trò khác rồi đăng xuất. | Trang sai quyền hiển thị **Không có quyền truy cập** và nút quay về. Route bảo vệ yêu cầu đăng nhập sau khi đăng xuất. |
| M02 · Tổng quan và lọc đơn | Dùng `D01` bấm từng thẻ trạng thái rồi chọn **Tất cả**. Với dữ liệu đủ hai trang, thử giảm số đơn của bộ lọc khi đang ở trang cuối. | KPI giữ số liệu toàn bộ yêu cầu. Danh sách đổi theo trạng thái, đổi bộ lọc về trang đầu, và **Trang trước** vẫn có khi trang hiện tại hết đơn. |
| M03 · Tạo yêu cầu | Dùng bàn phím để chuyển bước, thử thiếu trường, bấm **Sửa** ở bước xác nhận rồi gửi một đơn hợp lệ. | Focus tới tiêu đề bước hoặc trường lỗi. Form giữ dữ liệu khi sửa. Đơn mới xuất hiện ở trạng thái **Chờ nhận**. |
| M04 · Thu gom | Dùng `TG02` lọc theo khu vực, nhận đơn rồi chuyển sang tab Đã nhận và hoàn thành. Thử bật gợi ý ưu tiên. | Đơn chờ che địa chỉ và ghi chú. Đơn đã nhận hiển thị dữ liệu theo quyền. Bật gợi ý vẫn phân trang và hiện điểm ưu tiên. |
| M04 · Nhận đồng thời | Dùng `TG01` và `TG02` mở cùng một đơn chờ rồi bấm nhận gần như đồng thời. | Một thao tác thành công, bên còn lại nhận `409` và danh sách tự làm mới. |
| M05 · Quản trị | Dùng `AD01` lọc theo loại rác, trạng thái và khoảng ngày. Đổi biểu đồ hoạt động giữa 7 và 14 ngày. | Bộ lọc và phân trang đúng. KPI và các biểu đồ khớp dữ liệu D1 theo phạm vi hiển thị. |
| M06 · Chi tiết và di động | Mở chi tiết khi dùng bàn phím. Kiểm tra ở chiều rộng 390 px và thử đóng bằng `Escape`. | Hiển thị ba mốc theo giờ Việt Nam, có thể đóng bằng bàn phím và focus trở về nút mở. Danh sách quản trị hiển thị dạng thẻ. |
| F10 · Polling và lỗi mạng | Đặt cửa sổ người dân và thu gom cạnh nhau. Đổi trạng thái từ người thu gom, quan sát UI người dân. Sau đó thử ẩn tab và chuyển Network sang Offline. | UI đổi trạng thái khi polling. Tab ẩn dừng gọi GET. Khi lỗi, UI giữ dữ liệu gần nhất, báo chưa đồng bộ và phục hồi khi thử lại. |

Để kiểm tra số lượt gọi API, mở DevTools → Network và lọc `/api/requests/`. Mỗi lượt polling danh sách chỉ tải trang đang xem, kể cả khi có nhiều trang hoặc bật gợi ý ưu tiên. API đơn cá nhân trả KPI cho toàn bộ đơn cùng lượt gọi. Khi mở drawer, theo dõi riêng GET chi tiết.

Để đo TN02, thay tạm `POLL_INTERVAL` trong [useRequestData.js](frontend/src/services/useRequestData.js) lần lượt thành 2000, 5000 và 10000 ms. Giữ cùng một màn hình ở ba phép đo, thử ít nhất 5 lượt mỗi mức và ghi thời gian từ khi POST đổi trạng thái trả `200` đến khi UI người dân đổi trạng thái. Đếm số GET nghiệp vụ trong 60 giây, ghi rõ endpoint được đếm và trả cấu hình về 5000 ms sau khi đo.

