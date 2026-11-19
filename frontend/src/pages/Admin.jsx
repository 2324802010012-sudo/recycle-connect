
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Recycle, LogOut, LayoutDashboard,
  Clock3, Truck, CircleCheck,
  ClipboardList, Filter, Eye,
  AlertCircle, BarChart3,
} from 'lucide-react'

import { logout } from '../services/authService'
import RequestDetail from '../components/RequestDetail'
import StatusBadge from '../components/StatusBadge'

import { getAdminStats, getRequestPage } from '../services/requestService'
import { areaLabel } from '../services/requestOptions'
import RequestCard from '../components/RequestCard'
import { useRequestData } from '../services/useRequestData'
import RequestFeedback from '../components/RequestFeedback'
import RequestPagination from '../components/RequestPagination'

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

function Admin({ user }) {
  const navigate = useNavigate()

  const [error, setError] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [wasteFilter, setWasteFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const loadRequests = useCallback(signal => getRequestPage('admin/requests', {
    status: statusFilter, wasteType: wasteFilter, from: fromDate, to: toDate, page, limit: 20,
  }, signal), [statusFilter, wasteFilter, fromDate, toDate, page])
  const list = useRequestData(loadRequests)
  const statistics = useRequestData(getAdminStats)
  const stats = statistics.data?.byStatus ?? {}
  const total = statistics.data?.total ?? 0
  const filteredRequests = list.data?.items ?? []

  function resetFilters() {
    setStatusFilter('')
    setWasteFilter('')
    setFromDate('')
    setToDate('')
    setPage(1)
  }

  async function handleLogout() {
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Không thể đăng xuất.')
    }
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

        <RequestFeedback state={statistics} />

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
                {item.value ?? '—'}
              </p>
            </div>
          ))}
        </section>

        {/* BIỂU ĐỒ */}
        {statistics.data && <section className="rounded-2xl border bg-white p-6 shadow-sm">
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
        </section>}

        {statistics.data?.byWasteType?.length > 0 && (
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="mb-5 text-xl font-bold">Yêu cầu theo loại rác</h3>
            <div className="space-y-4">
              {statistics.data.byWasteType.map(({ wasteType, count }) => (
                <div key={wasteType}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span>{wasteLabels[wasteType] ?? wasteType}</span>
                    <span>{count} yêu cầu</span>
                  </div>
                  <div aria-hidden="true" className="h-3 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-[#167D61]"
                      style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

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
                onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
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
                onChange={e => { setWasteFilter(e.target.value); setPage(1) }}
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
                onChange={e => { setFromDate(e.target.value); setPage(1) }}
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
                onChange={e => { setToDate(e.target.value); setPage(1) }}
                className="w-full rounded-xl border p-3"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
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

          <RequestFeedback state={list} />
          {list.data && (filteredRequests.length === 0 ? (
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
            <>
            <div className="grid gap-3 p-4 lg:hidden">
              {filteredRequests.map(request => (
                <RequestCard key={request.RequestId} request={request} onView={setSelectedRequest} />
              ))}
            </div>
            <div className="hidden overflow-x-auto lg:block">
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
                        {areaLabel(request.Area)}
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
            </>
          ))}
          <RequestPagination pagination={list.data?.pagination} onPage={setPage} />
        </section>

        <footer className="pb-4 text-center text-sm text-gray-400">
          RECYCLE CONNECT · Serverless Cloud Platform
        </footer>
      </main>

      <RequestDetail
        id={selectedRequest?.RequestId}
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  )
}

export default Admin
