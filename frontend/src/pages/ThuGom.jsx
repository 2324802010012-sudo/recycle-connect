
import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Recycle, LogOut, UserRound, Filter, AlertCircle, Sparkles } from 'lucide-react'

import { logout } from '../services/authService'
import RequestCard from '../components/RequestCard'
import RequestDetail from '../components/RequestDetail'
import { getAllRequests, getRequestPage, updateRequest } from '../services/requestService'
import { AREA_OPTIONS, areaLabel, vietnamDate } from '../services/requestOptions'
import { useRequestData } from '../services/useRequestData'
import RequestFeedback from '../components/RequestFeedback'
import RequestPagination from '../components/RequestPagination'

// DỮ LIỆU MÔ PHỎNG FRONTEND
const wasteOptions = [
  { value: '', label: 'Tất cả loại rác' },
  { value: 'GIAY', label: 'Giấy' },
  { value: 'NHUA', label: 'Nhựa' },
  { value: 'KIM_LOAI', label: 'Kim loại' },
  { value: 'THUY_TINH', label: 'Thủy tinh' },
  { value: 'KHAC', label: 'Khác' },
]

function rankAvailableRequests(requests, area, now) {
  const today = Date.parse(vietnamDate(now))
  const day = 86400000
  const hour = 3600000

  return requests.map(request => {
    const created = Date.parse(request.CreatedAt)
    const remainingDays = Math.max(0, (Date.parse(request.PreferredDate) - today) / day)
    const waitingHours = Math.max(0, (now.getTime() - created) / hour)
    const areaScore = area && request.Area === area ? 50 : 0
    const score = areaScore + Math.max(0, 30 - 5 * remainingDays)
      + Math.min(20, 5 * Math.floor(waitingHours / 12))
    return { ...request, priorityScore: score }
  }).sort((a, b) => b.priorityScore - a.priorityScore
    || Date.parse(a.CreatedAt) - Date.parse(b.CreatedAt)
    || a.RequestId - b.RequestId)
}

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
  const available = activeTab === 'CHO_NHAN'
  const serviceArea = areaLabel(user.serviceArea)
  const loadRequests = useCallback(async signal => {
    const limit = 20
    if (!available) return getRequestPage('requests/assigned', { page, limit }, signal)
    const filters = { wasteType: wasteFilter, area: areaFilter }
    if (!priorityEnabled) return getRequestPage('requests/available', { ...filters, page, limit }, signal)

    const requests = await getAllRequests('requests/available', filters, signal)
    const ranked = rankAvailableRequests(requests, user.serviceArea, new Date())
    const currentPage = Math.min(page, Math.max(1, Math.ceil(ranked.length / limit)))
    return {
      items: ranked.slice((currentPage - 1) * limit, currentPage * limit),
      pagination: { page: currentPage, limit, total: ranked.length },
    }
  }, [available, page, wasteFilter, areaFilter, priorityEnabled, user.serviceArea])
  const list = useRequestData(loadRequests, { poll: true })
  const filteredRequests = list.data?.items ?? []

  function changeTab(tab) {
    setPage(1)
    setActiveTab(tab)
  }

  async function handleAction(request, action) {
    if (pending.current) return
    pending.current = true
    setBusyId(request.RequestId)
    setNotice('')
    setError('')
    try {
      await updateRequest(request.RequestId, action)
      setNotice(action === 'accept' ? 'Đã nhận yêu cầu.' : 'Đã hoàn thành yêu cầu.')
      list.refresh()
    } catch (error) {
      if (error.status === 401) {
        navigate('/login', { replace: true })
        return
      }
      if (error.status === 409) {
        setError(action === 'accept'
          ? 'Yêu cầu đã được tiếp nhận hoặc không còn khả dụng.'
          : 'Trạng thái yêu cầu đã thay đổi. Danh sách đang được cập nhật.')
        list.refresh()
      } else {
        setError(error.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.' : error.message)
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
        <section className="rounded-2xl bg-[#EAF5EF] p-6">
          <div className="flex items-center gap-3">
            <UserRound className="text-[#167D61]" />
            <div>
              <h2 className="text-2xl font-bold">
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


        <section className="rounded-2xl border bg-white p-5">
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
                    {request.priorityScore != null && (
                      <p className="mb-2 text-sm font-medium text-amber-800">
                        Điểm ưu tiên: {request.priorityScore}/100
                      </p>
                    )}
                    <RequestCard
                      request={request}
                      onView={setSelectedRequest}
                      action={
                        request.Status === 'CHO_NHAN' ? (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => handleAction(request, 'accept')}
                            className="rounded-xl bg-[#167D61] px-4 py-2 font-medium text-white hover:bg-[#11634D] disabled:opacity-50"
                          >
                            {busyId === request.RequestId ? 'Đang nhận…' : 'Nhận yêu cầu'}
                          </button>
                        ) : request.Status === 'DA_NHAN' &&
                          String(request.CollectorId) === String(user.userId) ? (
                          <button
                            type="button"
                            disabled={busyId !== null}
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
