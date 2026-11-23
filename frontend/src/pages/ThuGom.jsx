
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Recycle, LogOut, UserRound, Filter, AlertCircle, Sparkles } from 'lucide-react'

import { logout } from '../services/authService'
import RequestCard from '../components/RequestCard'
import RequestDetail from '../components/RequestDetail'
import { getRequestDetail, getRequestPage, updateRequest } from '../services/requestService'
import { AREA_OPTIONS, areaLabel } from '../services/requestOptions'
import { useRequestData } from '../hooks/useRequestData'
import RequestFeedback from '../components/RequestFeedback'
import RequestPagination from '../components/RequestPagination'
import { useRetryCooldown } from '../hooks/useRetryCooldown'

const wasteOptions = [
  { value: '', label: 'Tất cả loại rác' },
  { value: 'GIAY', label: 'Giấy' },
  { value: 'NHUA', label: 'Nhựa' },
  { value: 'KIM_LOAI', label: 'Kim loại' },
  { value: 'THUY_TINH', label: 'Thủy tinh' },
  { value: 'KHAC', label: 'Khác' },
]

function ThuGom({ user }) {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [activeTab, setActiveTab] = useState('CHO_NHAN')
  const [wasteFilter, setWasteFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [page, setPage] = useState(1)
  const [priorityEnabled, setPriorityEnabled] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const pending = useRef(false)
  const cooldown = useRetryCooldown()
  const available = activeTab === 'CHO_NHAN'
  const serviceArea = areaLabel(user.serviceArea)
  const loadRequests = useCallback(signal => {
    const limit = 20
    if (!available) return getRequestPage('requests/assigned', { page, limit }, signal)
    return getRequestPage('requests/available', {
      page, limit, wasteType: wasteFilter, area: areaFilter, priority: priorityEnabled ? 1 : undefined,
    }, signal)
  }, [available, page, wasteFilter, areaFilter, priorityEnabled])
  const list = useRequestData(loadRequests, { poll: true })
  const filteredRequests = list.data?.items ?? []

  function changeTab(tab) {
    setError('')
    setNotice('')
    setPage(1)
    setActiveTab(tab)
  }

  async function handleAction(request, action) {
    if (pending.current || !list.synchronized || cooldown.blocked) return
    pending.current = true
    setBusyId(request.RequestId)
    setNotice('')
    setError('')
    try {
      await updateRequest(request.RequestId, action)
      setNotice(action === 'accept' ? 'Đã nhận yêu cầu.' : 'Đã hoàn thành yêu cầu.')
      setSelectedRequest(current => current?.RequestId === request.RequestId ? null : current)
      list.refresh()
    } catch (error) {
      cooldown.defer(error)
      if (error.status === 401) {
        navigate('/login', { replace: true })
        return
      }
      if (error.status === 409) {
        setError(action === 'accept'
          ? 'Yêu cầu đã được tiếp nhận hoặc không còn khả dụng.'
          : 'Trạng thái yêu cầu đã thay đổi. Danh sách đang được cập nhật.')
        setSelectedRequest(current => current?.RequestId === request.RequestId ? null : current)
        list.refresh()
      } else if (error.status === 403 || error.status === 404) {
        setError(error.status === 403
          ? 'Bạn không có quyền thực hiện thao tác này.'
          : 'Yêu cầu không còn tồn tại hoặc bạn không được phép xem.')
        list.refresh()
      } else {
        setError(error.unknownOutcome
          ? 'Chưa xác nhận được kết quả. Đang đọc lại trạng thái yêu cầu; vui lòng chờ dữ liệu đồng bộ.'
          : error.message || 'Không thể thực hiện thao tác. Vui lòng thử lại.')
        if (error.unknownOutcome) {
          try {
            const current = await getRequestDetail(request.RequestId)
            if (String(current.CollectorId) === String(user.userId) &&
              (action === 'accept' ? ['DA_NHAN', 'HOAN_THANH'].includes(current.Status) : current.Status === 'HOAN_THANH')) {
              setError('')
              setNotice(action === 'accept' ? 'Đã xác nhận yêu cầu được tiếp nhận.' : 'Đã xác nhận yêu cầu hoàn thành.')
            }
          } catch { /* Giữ dữ liệu đã xác nhận cho tới khi GET thành công. */ }
          list.refresh()
        }
      }
    } finally {
      pending.current = false
      setBusyId(null)
    }
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
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5">
          <div className="flex items-center gap-3">
            <Recycle size={36} className="text-[#167D61]" />
            <div>
              <h1 className="text-xl font-bold text-[#167D61]">
                RECYCLE CONNECT
              </h1>
              <p className="text-sm text-gray-500">
                Trang người thu gom
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
        <section className="rounded-3xl border bg-gradient-to-br from-[#e8f4ec] to-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <UserRound className="text-[#167D61]" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-[#153e31]">
                Xin chào, {user.fullName}
              </h2>
              <p className="mt-1 text-gray-600">
                Khu vực phụ trách: {serviceArea || 'Chưa xác định'}
              </p>
            </div>
          </div>
        </section>



        {error && (
          <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-600">
            {error}
          </p>
        )}

        {notice && (
          <p role="status" className="rounded-xl bg-blue-50 p-4 text-blue-700">
            {notice}
          </p>
        )}


        <section className="rounded-3xl border bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap gap-3">
            <button
              aria-pressed={available}
              onClick={() => changeTab('CHO_NHAN')}
              className={`rounded-xl px-5 py-3 font-medium ${
                activeTab === 'CHO_NHAN'
                  ? 'bg-[#167D61] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Đơn chờ nhận
            </button>

            <button
              aria-pressed={!available}
              onClick={() => changeTab('DA_NHAN')}
              className={`rounded-xl px-5 py-3 font-medium ${
                activeTab === 'DA_NHAN'
                  ? 'bg-[#167D61] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Đơn đã nhận
            </button>
          </div>

          {available && <div>
          <div className="mb-5 flex items-center gap-2 font-semibold">
            <Filter size={20} />
            Bộ lọc yêu cầu
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="waste-filter" className="mb-2 block text-sm">
                Loại rác
              </label>
              <select
                id="waste-filter"
                value={wasteFilter}
                onChange={e => { setWasteFilter(e.target.value); setPage(1) }}
                className="w-full rounded-xl border p-3"
              >
                {wasteOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="area-filter" className="mb-2 block text-sm">
                Khu vực
              </label>
              <select
                id="area-filter"
                value={areaFilter}
                onChange={e => { setAreaFilter(e.target.value); setPage(1) }}
                className="w-full rounded-xl border p-3"
              >
                <option value="">Tất cả khu vực</option>
                {AREA_OPTIONS.map(area => (
                  <option key={area.value} value={area.value}>
                    {area.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="mt-5 flex items-center gap-3 font-medium">
            <input type="checkbox" checked={priorityEnabled}
              onChange={event => { setPriorityEnabled(event.target.checked); setPage(1) }}
              className="h-4 w-4 accent-[#167D61]" />
            <Sparkles size={18} aria-hidden="true" />
            Gợi ý yêu cầu ưu tiên
          </label>
          </div>}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold">
            {activeTab === 'CHO_NHAN'
              ? 'Danh sách yêu cầu chờ nhận'
              : 'Danh sách yêu cầu đã nhận'}
          </h2>

          <RequestFeedback state={list} />
          {list.data && (filteredRequests.length === 0 ? (
            <div className="rounded-2xl border bg-white p-10 text-center">
              <AlertCircle
                size={36}
                className="mx-auto mb-3 text-gray-400"
              />
              <p className="text-gray-500">
                Không có yêu cầu phù hợp.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {filteredRequests.map(request => (
                  <div key={request.RequestId}>
                    {request.PriorityScore != null && (
                      <p className="mb-2 text-sm font-medium text-amber-800">
                        Điểm ưu tiên: {request.PriorityScore}/100
                      </p>
                    )}
                    <RequestCard
                      request={request}
                      onView={setSelectedRequest}
                      action={
                        request.Status === 'CHO_NHAN' ? (
                          <button
                            type="button"
                            disabled={busyId !== null || !list.synchronized || cooldown.blocked}
                            aria-busy={busyId === request.RequestId}
                            onClick={() => handleAction(request, 'accept')}
                            className="rounded-xl bg-[#167D61] px-4 py-2 font-medium text-white hover:bg-[#11634D] disabled:opacity-50"
                          >
                            {busyId === request.RequestId ? 'Đang nhận…' : 'Nhận yêu cầu'}
                          </button>
                        ) : request.Status === 'DA_NHAN' &&
                          String(request.CollectorId) === String(user.userId) ? (
                          <button
                            type="button"
                            disabled={busyId !== null || !list.synchronized || cooldown.blocked}
                            aria-busy={busyId === request.RequestId}
                            onClick={() => handleAction(request, 'complete')}
                            className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {busyId === request.RequestId ? 'Đang xác nhận…' : 'Hoàn thành'}
                          </button>
                        ) : null
                      }
                    />
                  </div>
              ))}
            </div>
          ))}
          <RequestPagination pagination={list.data?.pagination} onPage={setPage} />
        </section>
      </main>

      <RequestDetail
        id={selectedRequest?.RequestId}
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  )
}

export default ThuGom
