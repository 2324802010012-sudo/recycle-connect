import { readFile, writeFile } from 'node:fs/promises'
import { evidence } from './environment.mjs'

const integration = JSON.parse(await readFile(evidence + 'integration.json', 'utf8'))
const polling = JSON.parse(await readFile(evidence + 'tn02.json', 'utf8'))
const performance = JSON.parse(await readFile(evidence + 'tn03.json', 'utf8'))
if (integration.results.some(r => r.status !== 'PASS') || integration.tn01.trials !== 10
  || polling.results.length !== 3 || polling.results.some(r => r.samples.length < 5)
  || performance.results.some(r => r.n < 20)) throw new Error('Incomplete or failed evidence; inspect JSON before publishing a report.')
const n = value => Number(value).toFixed(2)
const text = `# Thực nghiệm RQ01–RQ03 — kết quả local

Được tạo lại bằng \`npm --prefix backend run experiment:report\` từ JSON thực đo. Không phải benchmark Cloudflare production. Mỗi tệp chứa thời điểm UTC, ngày Việt Nam, commit nền/trạng thái working tree, Node/OS, thiết bị và môi trường. Dữ liệu nghiệp vụ là fixture tổng hợp; thời gian và HTTP được đo từ thao tác thực.

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

Câu hỏi: conditional UPDATE + D1 batch có ngăn hai collector cùng thắng? Tạo mười đơn qua HTTP, với mỗi đơn dùng \`Promise.all\` gửi hai POST từ cookie TG01/TG02 độc lập. Sau khi response về, truy vấn trực tiếp D1 để kiểm tra CollectorId, AcceptedAt, số log và actor. UPDATE và INSERT log là hai statement cùng batch; log có điều kiện changes()=1. Không mock D1 hoặc chỉ nhìn UI.

| Môi trường | Lượt | HTTP 200 | HTTP 409 | ACCEPT/đơn |
| --- | ---: | ---: | ---: | ---: |
| workerd + isolated D1 local | ${integration.tn01.trials} | ${integration.tn01.successes} | ${integration.tn01.conflicts} | 1 |

Thời điểm bằng chứng: ${integration.measuredAt}. [Mẫu thô, collector/timestamp/log](evidence/integration.json). Ngoài TN01, integration cố ý gây lỗi INSERT log CREATE/ACCEPT/COMPLETE để kiểm chứng rollback toàn giao dịch. Kết luận chỉ áp dụng mười lượt và runtime đã chạy; chưa chứng minh tải lớn hoặc hosted.

## RQ02 / TN02 — polling và độ trễ giao diện

Hai browser context cookie độc lập (DAN quan sát, THUGOM đổi trạng thái); Edge ${polling.browser}, viewport 1366×900, Windows, loopback. Mỗi chu kỳ có năm ACCEPT trên năm đơn khác nhau. Chờ offset ngẫu nhiên trước POST để thay đổi pha polling. Timestamp POST lấy sau khi response được đọc ở browser collector; MutationObserver ghi lúc card DAN render trạng thái mới. GET được đếm riêng \`/api/requests/mine\`, không gồm auth/me, màn hình collector hoặc drawer. Cửa sổ quan sát ít nhất 60 giây/mức; GET/phút = count × 60000 / thời gian thực tế.

| Chu kỳ | Mẫu | Trễ TB (ms) | Trễ max (ms) | Thời gian quan sát (ms) | GET đếm | GET/phút đo |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${polling.results.map(r => `| ${r.intervalMs / 1000}s | ${r.samples.length} | ${n(r.meanDelayMs)} | ${r.maxDelayMs} | ${r.observationMs} | ${r.getCount} | ${n(r.getsPerMinute)} |`).join('\n')}

Thời điểm: ${polling.measuredAt}. [Mẫu thô](evidence/tn02.json). Polling được lập lịch sau khi lượt GET trước kết thúc; còn thời gian mạng, CPU và render. Mẫu ít và pha ngẫu nhiên nên trung bình không nhất thiết đơn điệu giữa hai lần chạy. Không cam kết mọi cập nhật dưới năm giây. Build thử nghiệm ở thư mục tạm; build bình thường mặc định 5000 ms. Hidden-tab branch được browser suite thử bằng visibilitychange điều khiển; thí nghiệm timing này dùng hai trang visible, không giả lập đồng hồ.

## RQ03 / TN03 — API dưới tải nhỏ

Mỗi API chính hai mươi mẫu tuần tự (concurrency 1), dùng Node fetch + performance.now tới khi đọc xong JSON response. Login chuẩn bị session không nằm trong latency bảng; auth chức năng đã kiểm tra riêng. Không loại warmup. p95 dùng nearest rank ceil(0.95×n). Mỗi POST dùng trạng thái/đơn phù hợp, giữ các sample hợp lệ. GET mine có thêm năm nhóm × bốn request đồng thời, báo riêng. Ngày đo ${performance.measuredAt}; ${performance.node}, ${performance.platform}, network ${performance.network}.

| Endpoint | Đồng thời | n | Mean ms | p95 ms | Max ms | HTTP | 429/5xx |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
${performance.results.map(r => `| ${r.endpoint} | ${r.concurrency} | ${r.n} | ${n(r.meanMs)} | ${n(r.p95Ms)} | ${n(r.maxMs)} | ${Object.entries(r.http).map(([s,c]) => s + '×' + c).join(', ')} | ${n(r.error429or5xxRate * 100)}% |`).join('\n')}

[Mẫu thô và HTTP](evidence/tn03.json). Latency đo là round trip local, không phải CPU time của Worker. Dataset nhỏ, thiết bị và cạnh tranh tài nguyên local ảnh hưởng số đo. Không suy diễn sức tải Internet, autoscaling, cold start hay hạn CPU Free từ bảng này.

## Chạy lại và phần còn BLOCKED

Từ repo root, chạy integration, experiment:api, experiment:polling rồi experiment:report theo README. Scripts chỉ chạy workerd/D1 local cô lập, không nhận URL remote hoặc cookie thật. Muốn thực nghiệm hosted cần phê duyệt riêng account/database test, kế hoạch số request/rows và cách cung cấp session qua môi trường không ghi log. Không sửa script để trỏ production có dữ liệu thật.

Hosted TN01–TN03, HTTPS hai thiết bị, usage/CPU dashboard: **BLOCKED chờ quyền deploy và môi trường thử nghiệm**. Chưa có số đo production. Giới hạn Cloudflare có thể thay đổi; kiểm tra lại các nguồn trên và gói tài khoản ngay trước deployment/thực nghiệm remote.
`
await writeFile(new URL('../../docs/EXPERIMENTS.md', import.meta.url), text, 'utf8')
console.log('Updated docs/EXPERIMENTS.md from measured evidence.')
