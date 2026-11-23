
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Recycle,
  Plus,
  Clock3,
  Truck,
  CircleCheck,
  LogOut,
  ClipboardList,
} from 'lucide-react'
import { logout } from '../services/authService'
import EmptyState from '../components/EmptyState'

import { getRequestPage } from '../services/requestService'
import { useRequestData } from '../hooks/useRequestData'
import RequestFeedback from '../components/RequestFeedback'
import RequestPagination from '../components/RequestPagination'
import RequestCard from '../components/RequestCard'
import RequestDetail from '../components/RequestDetail'

const PAGE_SIZE = 20
const requestStats = [
  { key: 'CHO_NHAN', title: 'Chờ nhận', Icon: Clock3, tone: 'bg-warning/20 text-amber-900', bar: '#e6a94a' },
  { key: 'DA_NHAN', title: 'Đã nhận', Icon: Truck, tone: 'bg-[#ebf2fd] text-[#315b9b]', bar: '#5686d3' },
  { key: 'HOAN_THANH', title: 'Hoàn thành', Icon: CircleCheck, tone: 'bg-[#e7f3ec] text-[#167d61]', bar: '#167d61' },
]
const number = new Intl.NumberFormat('vi-VN')

function Dan({ user }) {
  const navigate = useNavigate()

  const { state } = useLocation()
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showCreated, setShowCreated] = useState(() => Boolean(state?.requestCreated))
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const load = useCallback(signal => getRequestPage('requests/mine', { page, limit: PAGE_SIZE, status }, signal), [page, status])
  const list = useRequestData(load, { poll: true })
  const requests = list.data?.items ?? []
  const pagination = list.data?.pagination
  const pageOutOfRange = pagination && pagination.page > Math.max(1, Math.ceil(pagination.total / pagination.limit))
  const counts = list.lastData?.byStatus
  const total = counts && requestStats.reduce((sum, item) => sum + (counts[item.key] ?? 0), 0)
  const activeLabel = requestStats.find(item => item.key === status)?.title

  function filterStatus(nextStatus) {
    setStatus(nextStatus)
    setPage(1)
  }

  // Không giữ thông báo tạo đơn trong history khi người dùng quay lại trang.
  useEffect(() => {
    if (state?.requestCreated) {
      navigate('/dan', { replace: true, state: null })
    }
  }, [state?.requestCreated, navigate])

  async function handleLogout() {
    setLoggingOut(true)
    setError('')

    try {
      await logout()
      setSelectedRequest(null)
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Không thể đăng xuất.')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f8f6] text-[#253B35]">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:py-4">
          <Link to="/dan" className="flex min-w-0 items-center gap-2.5 rounded-xl">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e7f3ec] text-[#167d61]">
              <Recycle size={22} aria-hidden="true" />
            </span>
            <span className="text-sm font-bold tracking-tight text-[#153e31] sm:text-base">
              Recycle Connect
            </span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-[#eef4f1] disabled:opacity-50 sm:text-sm"
          >
            <LogOut size={16} aria-hidden="true" />
            <span>{loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:space-y-6 sm:py-8">
        {showCreated && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#cce5d7] bg-[#eaf5ef] px-4 py-3 text-sm text-[#12644e]">
            <p role="status" className="flex items-center gap-2 font-semibold">
              <CircleCheck size={19} className="shrink-0" aria-hidden="true" />
              Đã tạo yêu cầu thu gom.
            </p>
            <button type="button" onClick={() => setShowCreated(false)} className="rounded-lg px-2 py-1 font-semibold underline" aria-label="Đóng thông báo tạo yêu cầu">Đóng</button>
          </div>
        )}
        {error && (
          <div role="alert" className="rounded-2xl bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <section className="rounded-3xl bg-gradient-to-br from-[#143e32] to-[#1c7056] p-5 text-white shadow-sm sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">
                Xin chào, {user.fullName}!
              </h1>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-emerald-100">
                Đặt lịch thu gom rác tái chế và theo dõi tiến độ yêu cầu của bạn.
              </p>
            </div>
            <Link to="/dan/tao-yeu-cau"
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#12644e] transition hover:bg-[#e7f3ec] focus-visible:outline-white sm:w-auto">
              <Plus size={19} aria-hidden="true" />
              Tạo yêu cầu thu gom
            </Link>
          </div>
        </section>

        <section aria-labelledby="request-overview-title" className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="request-overview-title" className="text-lg font-bold tracking-tight text-[#153e31] sm:text-xl">
              Tổng quan yêu cầu
            </h2>
            <button type="button" aria-pressed={!status} aria-controls="citizen-request-list"
              onClick={() => filterStatus('')}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${status ? 'bg-white text-[#12644e] hover:bg-[#eef4f1]' : 'border-[#cce5d7] bg-[#e7f3ec] text-[#12644e]'}`}>
              Tất cả{total != null && <span className="ml-1.5 tabular-nums">{number.format(total)}</span>}
            </button>
          </div>

          <div role="group" aria-label="Lọc theo trạng thái" className="mt-4 grid gap-2 min-[360px]:grid-cols-3 sm:gap-4">
            {requestStats.map(({ key, title, Icon, tone }) => (
              <button key={key} type="button" aria-pressed={status === key} aria-controls="citizen-request-list"
                onClick={() => filterStatus(status === key ? '' : key)}
                className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition min-[360px]:flex-col min-[360px]:items-start sm:flex-row sm:items-center sm:p-4 ${status === key ? 'border-[#167d61] bg-[#eef8f1] ring-1 ring-[#167d61]' : 'bg-[#f8faf9] hover:border-[#9bcab1] hover:bg-[#eef4f1]'}`}>
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl sm:size-11 ${tone}`}>
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-slate-600 sm:text-sm">{title}</span>
                  <span className="mt-0.5 block text-2xl font-bold leading-none tracking-tight text-[#153e31] tabular-nums">
                    {counts?.[key] == null ? '—' : number.format(counts[key])}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {counts && total > 0 && (
            <div aria-hidden="true" className="mt-4 flex h-2 overflow-hidden rounded-full bg-[#eef4f1]">
              {requestStats.map(({ key, bar }) => (
                <span key={key} style={{ backgroundColor: bar, width: `${(counts[key] ?? 0) / total * 100}%` }} />
              ))}
            </div>
          )}
        </section>

        <section id="citizen-request-list" aria-labelledby="citizen-request-list-title" className="rounded-3xl border bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e7f3ec] text-[#167d61]">
                <ClipboardList size={19} aria-hidden="true" />
              </span>
              <h2 id="citizen-request-list-title" className="text-lg font-bold tracking-tight text-[#153e31] sm:text-xl">
                {activeLabel ? `Yêu cầu · ${activeLabel}` : 'Yêu cầu gần đây'}
              </h2>
            </div>
            {list.updatedAt && !list.error && (
              <p className="text-xs tabular-nums text-slate-600">
                Cập nhật lúc {list.updatedAt.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}
              </p>
            )}
          </div>

          <RequestFeedback state={list} />
          {list.data && (requests.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {requests.map(request => (
                <RequestCard key={request.RequestId} request={request} onView={setSelectedRequest} />
              ))}
            </div>
          ) : pageOutOfRange ? (
            <EmptyState title="Trang này không còn yêu cầu"
              description="Danh sách vừa cập nhật. Chọn Trang trước để quay về trang hợp lệ." />
          ) : (
            <EmptyState title={status ? 'Không có yêu cầu ở trạng thái này' : 'Chưa có yêu cầu'}
              description={status ? 'Chọn Tất cả để xem các yêu cầu khác.' : 'Đặt lịch thu gom để theo dõi tiến độ tại đây.'} />
          ))}
          <RequestPagination pagination={pagination} onPage={setPage} />
        </section>
      </main>
      <RequestDetail id={selectedRequest?.RequestId} onClose={() => setSelectedRequest(null)} />
    </div>
  )
}

export default Dan
