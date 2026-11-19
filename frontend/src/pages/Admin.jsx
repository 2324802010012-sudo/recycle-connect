
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Recycle, LogOut, LayoutDashboard,
  Clock3, Truck, CircleCheck,
  ClipboardList, Filter, Eye,
  RefreshCw, AlertCircle, BarChart3,
  UserRound,
} from 'lucide-react'

import { getCurrentUser, logout } from '../services/authService'
import RequestDetail from '../components/RequestDetail'
import StatusBadge from '../components/StatusBadge'

// Dữ liệu mô phỏng - chưa kết nối D1.
const initialRequests = [
  {
    RequestId: 1,
    UserId: 1,
    CollectorId: null,
    WasteType: 'NHUA',
    QuantityKg: 5,
    Address: 'Địa chỉ thu gom mẫu 01',
    Area: 'KHU_VUC_1',
    PreferredDate: '2026-11-22',
    Note: 'Chai nhựa',
    Status: 'CHO_NHAN',
    CreatedAt: '2026-11-19T08:00:00.000Z',
    AcceptedAt: null,
    CompletedAt: null,
  },
  {
    RequestId: 2,
    UserId: 1,
    CollectorId: null,
    WasteType: 'GIAY',
    QuantityKg: 8,
    Address: 'Địa chỉ thu gom mẫu 02',
    Area: 'KHU_VUC_1',
    PreferredDate: '2026-11-23',
    Note: 'Thùng carton',
    Status: 'CHO_NHAN',
    CreatedAt: '2026-11-19T09:00:00.000Z',
    AcceptedAt: null,
    CompletedAt: null,
  },
  {
    RequestId: 3,
    UserId: 1,
    CollectorId: 2,
    WasteType: 'KIM_LOAI',
    QuantityKg: 3,
    Address: 'Địa chỉ thu gom mẫu 03',
    Area: 'KHU_VUC_1',
    PreferredDate: '2026-11-21',
    Note: 'Lon nhôm',
    Status: 'DA_NHAN',
    CreatedAt: '2026-11-18T08:00:00.000Z',
    AcceptedAt: '2026-11-18T10:00:00.000Z',
    CompletedAt: null,
  },
  {
    RequestId: 4,
    UserId: 1,
    CollectorId: 2,
    WasteType: 'THUY_TINH',
    QuantityKg: 6,
    Address: 'Địa chỉ thu gom mẫu 04',
    Area: 'KHU_VUC_1',
    PreferredDate: '2026-11-19',
    Note: 'Chai thủy tinh',
    Status: 'HOAN_THANH',
    CreatedAt: '2026-11-17T08:00:00.000Z',
    AcceptedAt: '2026-11-17T09:00:00.000Z',
    CompletedAt: '2026-11-19T09:00:00.000Z',
  },
  {
    RequestId: 5,
    UserId: 1,
    CollectorId: null,
    WasteType: 'KHAC',
    QuantityKg: 4,
    Address: 'Địa chỉ thu gom mẫu 05',
    Area: 'KHU_VUC_2',
    PreferredDate: '2026-11-24',
    Note: 'Vật liệu tái chế khác',
    Status: 'CHO_NHAN',
    CreatedAt: '2026-11-19T11:00:00.000Z',
    AcceptedAt: null,
    CompletedAt: null,
  },
]

const wasteLabels = {
  GIAY: 'Giấy',
  NHUA: 'Nhựa',
  KIM_LOAI: 'Kim loại',
  THUY_TINH: 'Thủy tinh',
  KHAC: 'Khác',
}

const chartItems = [
  {
    key: 'CHO_NHAN',
    label: 'Chờ nhận',
    color: 'bg-amber-500',
  },
  {
    key: 'DA_NHAN',
    label: 'Đã nhận',
    color: 'bg-blue-500',
  },
  {
    key: 'HOAN_THANH',
    label: 'Hoàn thành',
    color: 'bg-[#167D61]',
  },
]

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function Admin() {
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [requests] = useState(initialRequests)
  const [selectedRequest, setSelectedRequest] = useState(null)

  const [statusFilter, setStatusFilter] = useState('')
  const [wasteFilter, setWasteFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true

    async function checkAuth() {
      try {
        const result = await getCurrentUser()
        const account = result?.user ?? result

        if (!active) return

        if (!account) {
          navigate('/login', { replace: true })
          return
        }

        if (account.role !== 'ADMIN') {
          navigate(
            account.role === 'DAN'
              ? '/dan'
              : account.role === 'THUGOM'
                ? '/thugom'
                : '/login',
            { replace: true }
          )
          return
        }

        setUser(account)
      } catch (err) {
        if (active) {
          setError(err.message || 'Không thể tải tài khoản.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    checkAuth()

    return () => {
      active = false
    }
  }, [navigate])

  const stats = useMemo(() => {
    return {
      CHO_NHAN: requests.filter(
        r => r.Status === 'CHO_NHAN'
      ).length,
      DA_NHAN: requests.filter(
        r => r.Status === 'DA_NHAN'
      ).length,
      HOAN_THANH: requests.filter(
        r => r.Status === 'HOAN_THANH'
      ).length,
    }
  }, [requests])

  const total = requests.length

  const filteredRequests = useMemo(() => {
    return requests
      .filter(request => {
        const matchesStatus =
          !statusFilter || request.Status === statusFilter

        const matchesWaste =
          !wasteFilter || request.WasteType === wasteFilter

        // So sánh ngày theo múi giờ Việt Nam.
        const createdDate = new Date(
          request.CreatedAt
        ).toLocaleDateString('en-CA', {
          timeZone: 'Asia/Ho_Chi_Minh',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        })

        const matchesFrom =
          !fromDate || createdDate >= fromDate

        const matchesTo =
          !toDate || createdDate <= toDate

        const keyword = search.trim().toLowerCase()

        const matchesSearch =
          !keyword ||
          String(request.RequestId).includes(keyword) ||
          String(request.Area).toLowerCase().includes(keyword) ||
          String(request.Address).toLowerCase().includes(keyword)

        return (
          matchesStatus &&
          matchesWaste &&
          matchesFrom &&
          matchesTo &&
          matchesSearch
        )
      })
      .sort(
        (a, b) =>
          new Date(b.CreatedAt) - new Date(a.CreatedAt)
      )
  }, [
    requests, statusFilter, wasteFilter,
    fromDate, toDate, search,
  ])

  function resetFilters() {
    setStatusFilter('')
    setWasteFilter('')
    setFromDate('')
    setToDate('')
    setSearch('')
  }

  async function handleLogout() {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Không thể đăng xuất.')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3">
        <RefreshCw className="animate-spin text-[#167D61]" />
        Đang kiểm tra phiên đăng nhập...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="p-8 text-center text-red-600">
        {error || 'Không thể xác thực tài khoản.'}
        <button
          onClick={() => navigate('/login')}
          className="ml-3 underline"
        >
          Đăng nhập
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-[#253B35]">
      {/* HEADER */}
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div className="flex items-center gap-3">
            <Recycle
              size={36}
              className="text-[#167D61]"
            />

            <div>
              <h1 className="text-xl font-bold text-[#167D61]">
                RECYCLE CONNECT
              </h1>
              <p className="text-sm text-gray-500">
                Hệ thống quản trị
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-xl border px-4 py-2 hover:bg-gray-50"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7 px-4 py-8">
        {/* THÔNG TIN ADMIN */}
        <section className="rounded-2xl bg-[#EAF5EF] p-6">
          <div className="flex items-center gap-3">
            <LayoutDashboard
              size={30}
              className="text-[#167D61]"
            />

            <div>
              <h2 className="text-2xl font-bold">
                Dashboard quản trị
              </h2>

              <p className="mt-1 text-gray-600">
                Xin chào, {user.fullName}
              </p>
            </div>
          </div>
        </section>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Chế độ xem trước Frontend: số liệu và biểu đồ
          được tính từ dữ liệu mẫu, chưa lấy từ Cloudflare D1.
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl bg-red-50 p-4 text-red-600"
          >
            {error}
          </p>
        )}

        {/* KPI */}
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: 'Chờ nhận',
              value: stats.CHO_NHAN,
              Icon: Clock3,
              color: 'text-amber-600',
            },
            {
              label: 'Đã nhận',
              value: stats.DA_NHAN,
              Icon: Truck,
              color: 'text-blue-600',
            },
            {
              label: 'Hoàn thành',
              value: stats.HOAN_THANH,
              Icon: CircleCheck,
              color: 'text-[#167D61]',
            },
          ].map(item => (
            <div
              key={item.label}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-gray-500">
                  {item.label}
                </p>
                <item.Icon
                  size={26}
                  className={item.color}
                />
              </div>

              <p className="mt-4 text-4xl font-bold">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        {/* BIỂU ĐỒ */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <BarChart3
              size={24}
              className="text-[#167D61]"
            />
            <h3 className="text-xl font-bold">
              Biểu đồ phân bố trạng thái
            </h3>
          </div>

          <p className="mb-5 text-gray-500">
            Tổng số yêu cầu: {total}
          </p>

          <div className="space-y-6">
            {chartItems.map(item => {
              const count = stats[item.key]
              const percent = total > 0
                ? (count / total) * 100
                : 0

              return (
                <div key={item.key}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-medium">
                      {item.label}
                    </span>

                    <span className="text-sm text-gray-500">
                      {count} yêu cầu ({percent.toFixed(1)}%)
                    </span>
                  </div>

                  <div className="h-4 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${item.color}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* BỘ LỌC */}
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <Filter
              size={22}
              className="text-[#167D61]"
            />
            <h3 className="text-xl font-bold">
              Bộ lọc yêu cầu
            </h3>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                htmlFor="admin-status"
                className="mb-2 block text-sm font-medium"
              >
                Trạng thái
              </label>

              <select
                id="admin-status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full rounded-xl border p-3"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="CHO_NHAN">Chờ nhận</option>
                <option value="DA_NHAN">Đã nhận</option>
                <option value="HOAN_THANH">Hoàn thành</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="admin-waste"
                className="mb-2 block text-sm font-medium"
              >
                Loại rác
              </label>

              <select
                id="admin-waste"
                value={wasteFilter}
                onChange={e => setWasteFilter(e.target.value)}
                className="w-full rounded-xl border p-3"
              >
                <option value="">Tất cả loại rác</option>
                {Object.entries(wasteLabels).map(
                  ([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="admin-from"
                className="mb-2 block text-sm font-medium"
              >
                Từ ngày tạo
              </label>

              <input
                id="admin-from"
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={e => setFromDate(e.target.value)}
                className="w-full rounded-xl border p-3"
              />
            </div>

            <div>
              <label
                htmlFor="admin-to"
                className="mb-2 block text-sm font-medium"
              >
                Đến ngày tạo
              </label>

              <input
                id="admin-to"
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={e => setToDate(e.target.value)}
                className="w-full rounded-xl border p-3"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm mã yêu cầu, khu vực, địa chỉ..."
              aria-label="Tìm kiếm yêu cầu"
              className="min-w-0 flex-1 rounded-xl border p-3"
            />

            <button
              onClick={resetFilters}
              className="rounded-xl border px-5 py-3 font-medium hover:bg-gray-50"
            >
              Xóa bộ lọc
            </button>
          </div>
        </section>

        {/* DANH SÁCH */}
        <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div className="flex items-center gap-3">
              <ClipboardList
                size={24}
                className="text-[#167D61]"
              />
              <h3 className="text-xl font-bold">
                Danh sách yêu cầu
              </h3>
            </div>

            <span className="text-sm text-gray-500">
              Hiển thị {filteredRequests.length} yêu cầu
            </span>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="p-12 text-center">
              <AlertCircle
                size={36}
                className="mx-auto mb-3 text-gray-400"
              />
              <p className="text-gray-500">
                Không có yêu cầu phù hợp với bộ lọc.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#EAF5EF] text-[#253B35]">
                  <tr>
                    <th className="p-4">Mã đơn</th>
                    <th className="p-4">Loại rác</th>
                    <th className="p-4">Khối lượng</th>
                    <th className="p-4">Khu vực</th>
                    <th className="p-4">Ngày tạo</th>
                    <th className="p-4">Trạng thái</th>
                    <th className="p-4">Thao tác</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRequests.map(request => (
                    <tr
                      key={request.RequestId}
                      className="border-t hover:bg-gray-50"
                    >
                      <td className="p-4 font-semibold">
                        #{request.RequestId}
                      </td>

                      <td className="p-4">
                        {wasteLabels[request.WasteType] ||
                          request.WasteType}
                      </td>

                      <td className="p-4">
                        {request.QuantityKg} kg
                      </td>

                      <td className="p-4">
                        {request.Area}
                      </td>

                      <td className="p-4">
                        {formatDate(request.CreatedAt)}
                      </td>

                      <td className="p-4">
                        <StatusBadge status={request.Status} />
                      </td>

                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => setSelectedRequest(request)}
                          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-[#167D61] hover:bg-[#EAF5EF]"
                        >
                          <Eye size={17} />
                          Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="pb-4 text-center text-sm text-gray-400">
          RECYCLE CONNECT · Serverless Cloud Platform
        </footer>
      </main>

      <RequestDetail
        request={selectedRequest}
        role="ADMIN"
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  )
}

export default Admin
