# Recycle Connect

Website tiếp nhận và điều phối bán tự động yêu cầu thu gom rác tái chế. Người dân tạo đơn, người thu gom tự chọn và nhận, quản trị viên theo dõi dữ liệu. React + Vite + Tailwind; Cloudflare Worker phục vụ Static Assets và 12 REST API cùng origin; D1 lưu bốn bảng nghiệp vụ.

Vòng đời: **CHO_NHAN → DA_NHAN → HOAN_THANH**. Không tự động phân công, không sửa/hủy/xóa đơn. Danh mục dùng chung: `KHU_VUC_1` = Thuận An, `KHU_VUC_2` = Thủ Dầu Một.

## Trạng thái

Đối chiếu Baseline v1.4 theo prompt; chưa có Baseline/rubric gốc. F01–F11 đã kiểm tra local bằng HTTP + D1 và Edge desktop/mobile. F12 có sẵn, mặc định tắt, chưa xác nhận đầy đủ công thức với Baseline gốc. Production chưa deploy/chưa nghiệm thu. Xem [trạng thái](docs/IMPLEMENTATION_STATUS.md), [audit](docs/AUDIT.md) và [test report](docs/TEST_REPORT.md).

## Chạy local (PowerShell)

Đã xác minh trên Windows, Node.js **24.21.0**, npm 11.19.0, Wrangler 4.165.0:

```powershell
npm --prefix frontend ci
npm --prefix backend ci
npm --prefix frontend run build
Set-Location backend
npx wrangler d1 execute DB --local --file=schema.sql
npx wrangler d1 migrations apply DB --local
$demoSecret = Read-Host 'Mật khẩu demo 8–128 ký tự' -AsSecureString
$env:DEMO_PASSWORD = [System.Net.NetworkCredential]::new('', $demoSecret).Password
try { node scripts/seed-users.mjs } finally {
  Remove-Item Env:DEMO_PASSWORD
  $demoSecret.Dispose()
}
npx wrangler dev --local --port 8787
```

Mở **http://localhost:8787**. Dữ liệu local ở `backend/.wrangler/`, không có trong Git. `/api/health` kiểm tra Worker/D1. Schema/migration giữ dữ liệu hiện hữu; backup local trước thay đổi. Seed upsert tài khoản và đổi mật khẩu đã chọn; chỉ chạy khi có ý định này.

| Username | Role | Khu vực |
| --- | --- | --- |
| D01 | DAN | — |
| TG01 | THUGOM | Thuận An |
| TG02 | THUGOM | Thủ Dầu Một |
| AD01 | ADMIN | — |

Mật khẩu là giá trị nhập trong `DEMO_PASSWORD`, không hardcode. Muốn đổi riêng TG02: đặt biến môi trường rồi chạy `node scripts/seed-users.mjs TG02`. Script luôn dùng `--local`, không hỗ trợ remote.

Khi sửa giao diện, giữ Worker cổng 8787, tại repo root chạy `npm --prefix frontend run dev`, mở URL Vite (thường cổng 5173). Proxy chuyển `/api` về Worker. Xem thay đổi qua cổng 8787 cần build frontend lại.

## Kiểm thử tái lập

Chạy từ repo root:

```powershell
npm --prefix frontend run lint
npm --prefix frontend run build
npm --prefix backend test
npm --prefix backend run test:browser
npm --prefix backend run experiment:api
npm --prefix backend run experiment:polling
npm --prefix backend run experiment:report
npm --prefix backend run deploy:check
```

Tests tạo D1 cô lập, password ngẫu nhiên và session độc lập; không ghi database local của bạn hoặc remote. Browser dùng Edge cài sẵn; máy khác đặt `BROWSER_PATH` trỏ đến Edge/Chromium. Không tự tải browser. Kết quả JSON và ảnh thật lưu vào `docs/evidence/`, cập nhật theo lần chạy mới nhất.

TN01 trong integration: 10 cuộc tranh nhận bằng hai HTTP client, kiểm tra CollectorId/AcceptedAt/một ACCEPT. TN02 dùng hai browser context, timer thật ở 2/5/10 giây, năm mẫu mỗi mức và cửa sổ quan sát GET ít nhất 60 giây/mức; mất khoảng ba đến bốn phút. Build TN02 ở thư mục tạm, không thay `frontend/dist`. Build bình thường không đặt `VITE_POLL_INTERVAL_MS`, polling mặc định 5000 ms. Tab ẩn/logout dừng polling; offline giữ dữ liệu, báo chưa đồng bộ; 401 về login; 409 tải lại danh sách.

TN03 đo 20 mẫu cho mỗi trong 10 API chính và thử GET concurrency 4. Số đo local không đại diện hiệu năng cloud. Xem [phương pháp và kết quả](docs/EXPERIMENTS.md).

## Demo

1. Dùng profile/context riêng cho D01, TG01, TG02 và AD01 để cookie độc lập.
2. D01 tạo đơn qua form ba bước, xem chi tiết đơn chờ.
3. TG01/TG02 tranh nhận cùng đơn. Dùng integration và SQL để minh chứng một HTTP 200, một HTTP 409 và một ACCEPT.
4. Người nhận mở **Đơn đã nhận**, hoàn thành. D01 thấy timeline ba mốc; AD01 thấy KPI/biểu đồ cập nhật.
5. Thử offline/khôi phục, refresh và logout; không chụp password/token/cookie thật.

## Tài liệu và triển khai

- [Kiến trúc, use case, activity, sequence](docs/ARCHITECTURE.md)
- [Database, ERD và migration](docs/DATABASE.md)
- [12 API và JSON](docs/API.md)
- [TC01–TC20](docs/TEST_REPORT.md)
- [RQ01–RQ03 / TN01–TN03](docs/EXPERIMENTS.md)
- [Triển khai và khôi phục](docs/DEPLOYMENT.md)
- [Checklist minh chứng](docs/EVIDENCE_CHECKLIST.md)

Dry-run đóng gói thành công. Còn cần duyệt tài khoản Cloudflare, database đích, ghi schema/migration/seed và deploy. PBKDF2 310000 chạy được trên workerd local; cần kiểm tra hosted runtime/CPU Free trước nghiệm thu cloud. Không giảm vòng hash, tự nâng gói hoặc thêm thanh toán để che lỗi.
