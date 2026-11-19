# Recycle Connect

Ứng dụng điều phối yêu cầu thu gom rác tái chế. React và REST API chạy trên cùng origin với Cloudflare Workers Static Assets. D1 lưu tài khoản, phiên, yêu cầu và nhật ký nghiệp vụ.

## Chạy cục bộ

Ở thư mục gốc, với phiên bản Node phù hợp với Vite và Wrangler:

```sh
npm --prefix frontend ci
npm --prefix backend ci
npm --prefix frontend run build
```

Trong thư mục `backend`, tạo bảng rồi seed tài khoản demo:

```sh
npx wrangler d1 execute DB --local --file=schema.sql
```

Đặt biến môi trường `DEMO_PASSWORD` trong phiên shell với mật khẩu thử nghiệm từ 8 đến 128 ký tự, sau đó chạy:

```sh
node scripts/seed-users.mjs
npx wrangler dev
```

Mở địa chỉ do Wrangler in ra. Tài khoản demo gồm `D01` (người dân), `TG01` và `TG02` (thu gom), `AD01` (quản trị). Seed lại sẽ đặt lại mật khẩu các tài khoản này trên D1 cục bộ. Có thể dùng `npm --prefix frontend run dev` để phát triển giao diện với proxy đến Worker cổng 8787.

## Kiểm tra mã frontend

Từ thư mục gốc, sau khi build frontend:

```sh
npm --prefix frontend run lint
```

Cấu hình Static Assets nằm ở `backend/wrangler.jsonc`. Khi nghiệm thu trên Cloudflare, cần dùng D1 và tài khoản demo của môi trường đích, rồi đo lại các thí nghiệm TN01–TN03 qua URL HTTPS. Kết quả test cục bộ áp dụng cho môi trường phát triển.

