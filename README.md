# Recycle Connect

## 1. Giới thiệu

Đề tài: Thiết kế, triển khai và đánh giá hệ thống tiếp nhận, điều phối yêu cầu thu gom rác tái chế trên nền tảng Serverless Cloud. Người dân tạo yêu cầu, người thu gom tiếp nhận và hoàn thành, quản trị viên theo dõi danh sách và thống kê.

## 2. Công nghệ

React, Vite, Tailwind CSS, Cloudflare Workers Static Assets, Cloudflare D1 và Durable Objects.

## 3. Yêu cầu cài đặt

Node.js 24 và npm. Wrangler được cài cùng dependencies của backend, không cần cài toàn cục.

## 4. Cách chạy trên máy

Chạy tại thư mục gốc bằng PowerShell. Dừng server local trước khi cài lại dependencies.

```powershell
npm --prefix frontend ci
npm --prefix backend ci
npm run build
Set-Location backend
# Chỉ chạy dòng schema.sql khi database local mới, chưa có bảng.
npx wrangler d1 execute DB --local --file=schema.sql
npx wrangler d1 migrations apply DB --local
```

Nếu cần tạo hoặc đặt lại mật khẩu tài khoản demo, chạy tiếp:

```powershell
$demoSecret = Read-Host 'Mật khẩu demo 8–128 ký tự' -AsSecureString
$env:DEMO_PASSWORD = [System.Net.NetworkCredential]::new('', $demoSecret).Password
try { node scripts/seed-users.mjs } finally {
  Remove-Item Env:DEMO_PASSWORD
  $demoSecret.Dispose()
}
npm run dev
```

Nếu đã có tài khoản thì bỏ qua seed, chỉ chạy npm run dev trong backend. Mở **http://localhost:8787**. Khi sửa frontend, build lại hoặc dùng npm --prefix frontend run dev từ thư mục gốc để chạy Vite với proxy về Worker.

## 5. Tài khoản demo

| Username | Vai trò |
| --- | --- |
| D01 | Người dân (DAN) |
| TG01 | Người thu gom (THUGOM) |
| TG02 | Người thu gom (THUGOM) |
| AD01 | Quản trị viên (ADMIN) |

Mật khẩu do bạn nhập qua DEMO_PASSWORD khi seed. Seed có thể đổi mật khẩu tài khoản hiện có; chỉ chạy khi cần. Có thể chọn riêng một tài khoản: node scripts/seed-users.mjs TG02.

## 6. Triển khai Cloudflare

Cập nhật database_id trong backend/wrangler.jsonc theo D1 của bạn. Khởi tạo schema cho database mới, sao lưu database có dữ liệu trước khi áp dụng migration. Từ thư mục gốc:

```powershell
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build frontend thất bại' }
Set-Location backend
npx wrangler login
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

Không deploy nếu build thất bại. Route /register và API đăng ký có sẵn mặc định; server luôn gán vai trò DAN và giới hạn số lần đăng ký.

