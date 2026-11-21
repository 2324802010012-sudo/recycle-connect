# Chuẩn bị triển khai Cloudflare

Trạng thái: **dry-run local PASS; remote BLOCKED chờ chủ dự án phê duyệt**. Chưa xác minh tài khoản Cloudflare đang đăng nhập, chưa ghi D1 remote, chưa deploy hoặc phát sinh dịch vụ trả phí. Không suy ra quyền sở hữu database chỉ từ ID trong repo.

## Local

Từ repo root cài frontend/backend, build; sau đó trong `backend`:

```powershell
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

Với database đã có, schema dùng IF NOT EXISTS và migration chỉ thêm trigger; backup local trước thay đổi. Seed là upsert tài khoản và đổi mật khẩu đã chọn: không chạy lại nếu không định đổi mật khẩu. Script seed **luôn `--local`**, không có cờ remote. D1 local của nhóm không được test suite sử dụng.

Dry-run từ repo root:

```powershell
npm --prefix frontend run build
npm --prefix backend run deploy:check
```

Wrangler xác nhận assets, Worker bundle, binding DB và LOGIN_LIMITER. Lệnh này không upload. API `/api/*` đi Worker trước, các route `/dan`, `/admin`... dùng SPA fallback; đã kiểm tra với Miniflare assets và trình duyệt.

## Kế hoạch remote để duyệt

Worker dự kiến `recycle-connect-api`; D1 tên `recycle-connect-db`, ID trong cấu hình `5b4a7a63-73fe-4614-900e-31fec2e455e2`, binding `DB`. Rate limiter namespace `1001` cần xác nhận chưa dùng cho Worker khác trong cùng tài khoản.

Chủ dự án xác nhận tài khoản/account ID, database đích, database mới hay đã có dữ liệu, gói Free, quyền deploy và quyền ghi schema/migration/seed. Sau đó đọc metadata bằng `wrangler whoami` và `wrangler d1 info DB` để đối chiếu. Không đưa token/API key vào tài liệu.

Các lệnh **chưa chạy**, chỉ thực hiện sau phê duyệt, tại `backend`:

```powershell
# Đọc/backup dữ liệu trước ghi; output có thể chứa dữ liệu riêng tư: giữ ngoài Git.
npx wrangler d1 export DB --remote --output=<duong-dan-backup-rieng>
# Chỉ khởi tạo schema khi đã xác nhận đúng database và kiểm tra dữ liệu hiện hữu.
npx wrangler d1 execute DB --remote --file=schema.sql
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

Tác động: export đọc và ghi file backup; execute/migration ghi D1; deploy thay Worker/assets phục vụ người dùng. Mọi backup, seed SQL và thông tin nhạy cảm phải giữ ngoài repo, không commit. Seed production cần chuẩn bị file SQL chứa hash có salt từ policy hiện hành sau khi nhận mật khẩu qua môi trường, duyệt danh sách tài khoản rồi mới chạy remote; không đổi `--local` trong script một cách tùy tiện. Không có seed remote tự động trong lượt này.

## Cổng nghiệm thu hosted

1. Ghi URL HTTPS thực tế, deployment/version ID, commit và thời điểm.
2. Kiểm tra GET health, SPA deep link, API không bị fallback HTML, cookie HttpOnly/Secure/Lax/Path=/.
3. Seed và đăng nhập từng vai trò. Nếu PASSWORD_RUNTIME_UNSUPPORTED/CPU limit: dừng nghiệm thu, giữ policy 310000, không hạ số vòng hoặc tự nâng gói. Xác nhận giải pháp/tài nguyên với chủ dự án trước bước tiếp theo.
4. Chạy TC quyền, luồng tạo/nhận/hoàn thành, replay sau logout; kiểm tra SQL log không chứa dữ liệu nhạy cảm.
5. Hai thiết bị/session độc lập; TN01–TN03 chỉ được chạy trên database thử nghiệm được duyệt với ngân sách request/row rõ ràng. Scripts trong repo mặc định chỉ chạy local và không nhận URL remote.
6. Chụp Worker deploy, HTTPS, D1 tables, Usage và kết quả thực đo. Không sử dụng ảnh local làm bằng chứng production.

## Khôi phục

Giữ version Worker trước deploy. Nếu bản mới lỗi, chọn version trước từ dashboard hoặc dùng `wrangler rollback <version-id>` sau khi xác định đúng version. Rollback Worker không tự hoàn tác D1. Migration hiện tại chỉ thêm trigger, nhưng mọi thay đổi/restore remote phải được duyệt và backup trước; không tự DROP bảng/trigger hoặc restore ghi đè production. D1 Free có Time Travel bảy ngày theo [giới hạn hiện hành](https://developers.cloudflare.com/d1/platform/limits/); xác nhận khả năng restore thật của tài khoản trước khi dựa vào nó.

Giới hạn/chi phí và rủi ro PBKDF2: xem [EXPERIMENTS](EXPERIMENTS.md). Dry-run/local không kiểm tra tài khoản, TLS public, quota CPU hoặc khả năng deploy thành công.
