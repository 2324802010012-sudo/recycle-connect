# REST API

Origin chung với frontend. Session lấy từ cookie `rc_session`; không nhận role/UserId từ client làm nguồn phân quyền. POST cần `Origin` cùng nguồn (Vite localhost 5173–5175 chỉ được phép khi backend cũng local). Mọi API nghiệp vụ trả `Cache-Control: no-store`.

| Method | Endpoint | Quyền | Dữ liệu/query |
| --- | --- | --- | --- |
| POST | /api/auth/login | Công khai | username, password dạng string; trả user, data.user, Set-Cookie |
| POST | /api/auth/logout | Session | 204; thu hồi D1 và xóa cookie; 401 nếu đã hết phiên, vẫn xóa cookie |
| GET | /api/auth/me | Session | user và data.user |
| GET | /api/requests/mine | DAN | page, limit, status; KPI byStatus tính toàn bộ đơn cá nhân |
| POST | /api/requests | DAN | wasteType, quantityKg, address, area, preferredDate, note; 201 |
| GET | /api/requests/available | THUGOM | page, limit, wasteType, area; priority=1 tùy chọn |
| GET | /api/requests/assigned | THUGOM | page, limit; gồm cả đơn mình đã hoàn thành |
| GET | /api/requests/:id | Theo từng đơn | DAN chủ đơn; THUGOM xem công khai đơn chờ hoặc đầy đủ đơn mình nhận; ADMIN |
| POST | /api/requests/:id/accept | THUGOM | Không cần body; conditional UPDATE + ACCEPT |
| POST | /api/requests/:id/complete | THUGOM nhận đơn | Không cần body; conditional UPDATE + COMPLETE |
| GET | /api/admin/requests | ADMIN | page, limit, status, wasteType, from, to |
| GET | /api/admin/stats | ADMIN | Tổng toàn hệ thống, byStatus/byWasteType/byDay 14 ngày |

`GET /api/health` là endpoint kỹ thuật riêng, không tính vào 12 endpoint. Auth giữ thêm `user` ở root để tương thích frontend cũ; `data.user` là trường bổ sung. Logout 204 không có JSON.

## Ví dụ

Tạo yêu cầu (đổi ngày thành hôm nay hoặc tương lai theo giờ Việt Nam):

```json
{
  "wasteType": "GIAY",
  "quantityKg": 5,
  "address": "Địa chỉ thu gom ví dụ",
  "area": "KHU_VUC_1",
  "preferredDate": "2026-12-01",
  "note": "Đã phân loại"
}
```

Response 201:

```json
{"success":true,"data":{"requestId":1,"status":"CHO_NHAN"}}
```

Danh sách (ví dụ tối giản trường; item thực có timestamp và thông tin thu gom):

```json
{"success":true,"data":{"items":[],"pagination":{"page":1,"limit":20,"total":0},"byStatus":{"CHO_NHAN":0,"DA_NHAN":0,"HOAN_THANH":0}}}
```

`byStatus` chỉ có ở `/mine`. Limit mặc định 20, tối đa 50. Page/limit sai trả 400; trang vượt cuối trả items rỗng nhưng giữ total. from/to là ngày tạo theo múi giờ Việt Nam, gồm trọn hai ngày biên. Bộ lọc danh sách admin không áp dụng vào KPI/biểu đồ toàn hệ thống.

Item dùng camelCase: requestId, wasteType, quantityKg, area, preferredDate, status, createdAt, acceptedAt, completedAt. Người thu gom xem đơn chờ không nhận address/note/collectorId/collectorName. Người có quyền xem đầy đủ nhận các trường đó; ADMIN có thêm userId. Đơn không có quyền tiết lộ trả 404.

```json
{"success":false,"error":{"code":"REQUEST_NOT_AVAILABLE","message":"Yêu cầu đã được tiếp nhận hoặc không còn ở trạng thái phù hợp."}}
```

| HTTP | Ý nghĩa / code tiêu biểu |
| --- | --- |
| 400 | INVALID_INPUT: JSON, enum, kg, địa chỉ, ngày hoặc pagination sai |
| 401 | UNAUTHENTICATED: chưa đăng nhập, mật khẩu sai hoặc phiên hết hạn |
| 403 | FORBIDDEN: sai vai trò hoặc sai collector khi hoàn thành; Origin sai |
| 404 | REQUEST_NOT_FOUND hoặc NOT_FOUND: không tồn tại/không được xem |
| 409 | REQUEST_NOT_AVAILABLE: trạng thái không phù hợp, bao gồm người nhận sau |
| 429 | LOGIN_RATE_LIMITED, Retry-After: 60 |
| 500 | INTERNAL_ERROR: lỗi xử lý; không trả stack |
| 503 | PASSWORD_RUNTIME_UNSUPPORTED: runtime không thực hiện được policy PBKDF2; không tự giảm số vòng |

QuantityKg là JSON number hữu hạn (0,1000]; Address trim 5–200; Note string ≤500; PreferredDate YYYY-MM-DD ngày thực, không quá khứ theo Việt Nam. Enum giữ nguyên baseline. Frontend render ghi chú dưới dạng text của React.
