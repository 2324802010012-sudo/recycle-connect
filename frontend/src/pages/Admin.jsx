import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Recycle, LogOut,
  Clock3, Truck, CircleCheck,
  ClipboardList, Filter, Eye,
  AlertCircle,
} from 'lucide-react'

import { logout } from '../services/authService'
import RequestDetail from '../components/RequestDetail'
import StatusBadge from '../components/StatusBadge'

import { getAdminStats, getRequestPage } from '../services/requestService'
import { areaLabel } from '../services/requestOptions'
import RequestCard from '../components/RequestCard'
import { useRequestData } from '../hooks/useRequestData'
import RequestFeedback from '../components/RequestFeedback'
import RequestPagination from '../components/RequestPagination'
import AdminCharts from '../components/AdminCharts'

const wasteLabels = {
  GIAY: 'Giấy',
  NHUA: 'Nhựa',
  KIM_LOAI: 'Kim loại',
  THUY_TINH: 'Thủy tinh',
  KHAC: 'Khác',
}

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
  const list = useRequestData(loadRequests, { poll: true })
  const statistics = useRequestData(getAdminStats, { poll: true })
  const stats = statistics.data?.byStatus ?? {}
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
    <div className="min-h-screen bg-[#f5f8f6] text-[#253B35]">
      <header className="border-b bg-white/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-[#e7f3ec] text-[#167d61]">
              <Recycle size={23} aria-hidden="true" />
            </span>

            <div>
              <h1 className="text-sm font-bold tracking-wide text-[#153e31] sm:text-base">
                RECYCLE CONNECT
              </h1>
              <p className="text-sm text-gray-500">
                Hệ thống quản trị
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            type="button"
            className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium text-[#163c30] transition hover:bg-[#eef6f1] sm:px-4"
          >
            <LogOut size={18} />
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7 px-4 py-8">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#123e32] via-[#175641] to-[#1c7556] px-6 py-7 text-white shadow-sm sm:px-8 sm:py-9">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">Tổng quan thu gom</h2>
              <p className="mt-2 text-sm text-emerald-100">{user.fullName}</p>
            </div>
            {statistics.updatedAt && !statistics.error && (
              <p className="text-xs text-emerald-100">
                Cập nhật lúc {statistics.updatedAt.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
              </p>
            )}
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

        <section aria-label="Số yêu cầu theo trạng thái" className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {[
            {
              label: 'Chờ nhận',
              value: stats.CHO_NHAN,
              Icon: Clock3,
              color: 'bg-warning/20 text-amber-900',
            },
            {
              label: 'Đã nhận',
              value: stats.DA_NHAN,
              Icon: Truck,
              color: 'bg-[#ebf2fd] text-[#315b9b]',
            },
            {
              label: 'Hoàn thành',
              value: stats.HOAN_THANH,
              Icon: CircleCheck,
              color: 'bg-[#e7f3ec] text-[#167d61]',
            },
          ].map(item => (
            <div
              key={item.label}
              className="rounded-3xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-gray-500">
                  {item.label}
                </p>
                <span className={`grid size-10 place-items-center rounded-xl ${item.color}`}>
                  <item.Icon size={21} aria-hidden="true" />
                </span>
              </div>

              <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-[#163c30]">
                {item.value ?? '—'}
              </p>
            </div>
          ))}
        </section>

        {statistics.data && <AdminCharts stats={statistics.data} wasteLabels={wasteLabels} />}

        <section className="rounded-3xl border bg-white p-5 shadow-sm sm:p-6">
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
                className="w-full rounded-xl border bg-[#f8faf9] p-3 text-sm"
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
                className="w-full rounded-xl border bg-[#f8faf9] p-3 text-sm"
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
                className="w-full rounded-xl border bg-[#f8faf9] p-3 text-sm"
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
                className="w-full rounded-xl border bg-[#f8faf9] p-3 text-sm"
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

        <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
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
