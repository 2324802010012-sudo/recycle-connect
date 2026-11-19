
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Recycle, LogOut, RefreshCw, Clock3,
  Truck, CircleCheck, Filter, MapPin,
  AlertCircle, Sparkles, UserRound,
} from 'lucide-react'

import { getCurrentUser, logout } from '../services/authService'
import RequestCard from '../components/RequestCard'
import RequestDetail from '../components/RequestDetail'
import StatusBadge from '../components/StatusBadge'

// DỮ LIỆU MÔ PHỎNG FRONTEND
// Chưa lấy dữ liệu từ Cloudflare D1.
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
    Note: 'Chai nhựa đã phân loại',
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
    Note: 'Giấy và thùng carton',
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
]

const wasteOptions = [
  { value: '', label: 'Tất cả loại rác' },
  { value: 'GIAY', label: 'Giấy' },
  { value: 'NHUA', label: 'Nhựa' },
  { value: 'KIM_LOAI', label: 'Kim loại' },
  { value: 'THUY_TINH', label: 'Thủy tinh' },
  { value: 'KHAC', label: 'Khác' },
]

function getPriorityScore(request, serviceArea) {
  const areaScore =
    request.Area === serviceArea ? 50 : 0

  const today = new Date()
  const todayUTC = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  )

  const preferred = new Date(
    `${request.PreferredDate}T00:00:00Z`
  )

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (preferred.getTime() - todayUTC) / 86400000
    )
  )

  const dateScore = Math.max(0, 30 - 5 * daysLeft)

  const waitingHours = Math.max(
    0,
    (Date.now() - new Date(request.CreatedAt).getTime()) /
      3600000
  )

  const waitingScore = Math.min(
    20,
    5 * Math.floor(waitingHours / 12)
  )

  return areaScore + dateScore + waitingScore
}

function ThuGom() {
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [requests, setRequests] = useState(initialRequests)
  const [selectedRequest, setSelectedRequest] = useState(null)

  const [activeTab, setActiveTab] = useState('CHO_NHAN')
  const [wasteFilter, setWasteFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [priorityEnabled, setPriorityEnabled] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [notice, setNotice] = useState('')

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

        if (account.role !== 'THUGOM') {
          navigate(
            account.role === 'DAN'
              ? '/dan'
              : account.role === 'ADMIN'
                ? '/admin'
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

  const serviceArea = user?.serviceArea || ''

  const areaOptions = useMemo(() => {
    return [...new Set(requests.map(r => r.Area))]
      .filter(Boolean)
      .sort()
  }, [requests])

  const stats = useMemo(() => ({
    pending: requests.filter(
      r => r.Status === 'CHO_NHAN'
    ).length,
    accepted: requests.filter(
      r => r.Status === 'DA_NHAN' &&
        r.CollectorId === user?.userId
    ).length,
    completed: requests.filter(
      r => r.Status === 'HOAN_THANH' &&
        r.CollectorId === user?.userId
    ).length,
  }), [requests, user])

  const filteredRequests = useMemo(() => {
    const result = requests.filter(request => {
      const matchingTab =
        activeTab === 'CHO_NHAN'
          ? request.Status === 'CHO_NHAN'
          : request.CollectorId === user?.userId &&
            ['DA_NHAN', 'HOAN_THANH'].includes(request.Status)

      return (
        matchingTab &&
        (!wasteFilter || request.WasteType === wasteFilter) &&
        (!areaFilter || request.Area === areaFilter)
      )
    })

    if (priorityEnabled && activeTab === 'CHO_NHAN') {
      return result.sort((a, b) => {
        const scoreDiff =
          getPriorityScore(b, serviceArea) -
          getPriorityScore(a, serviceArea)

        if (scoreDiff !== 0) return scoreDiff

        const timeDiff =
          new Date(a.CreatedAt) - new Date(b.CreatedAt)

        return timeDiff || a.RequestId - b.RequestId
      })
    }

    return result.sort(
      (a, b) => new Date(b.CreatedAt) - new Date(a.CreatedAt)
    )
  }, [
    requests, activeTab, wasteFilter,
    areaFilter, priorityEnabled, serviceArea, user,
  ])

  function handleAccept(request) {
    if (!user || busyId !== null) return

    setBusyId(request.RequestId)
    setNotice('')

    setRequests(previous =>
      previous.map(item =>
        item.RequestId === request.RequestId &&
        item.Status === 'CHO_NHAN'
          ? {
              ...item,
              Status: 'DA_NHAN',
              CollectorId: user.userId,
              AcceptedAt: new Date().toISOString(),
            }
          : item
      )
    )

    setNotice(
      'Đã mô phỏng nhận yêu cầu trên giao diện. Chưa lưu vào D1.'
    )
    setBusyId(null)
  }

  function handleComplete(request) {
    if (
      !user ||
      busyId !== null ||
      request.CollectorId !== user.userId
    ) return

    setBusyId(request.RequestId)
    setNotice('')

    setRequests(previous =>
      previous.map(item =>
        item.RequestId === request.RequestId &&
        item.Status === 'DA_NHAN' &&
        item.CollectorId === user.userId
          ? {
              ...item,
              Status: 'HOAN_THANH',
              CompletedAt: new Date().toISOString(),
            }
          : item
      )
    )

    setNotice(
      'Đã mô phỏng hoàn thành trên giao diện. Chưa lưu vào D1.'
    )
    setBusyId(null)
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

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Chế độ xem trước Frontend: dữ liệu yêu cầu và
          thao tác nhận/hoàn thành đang được mô phỏng.
        </div>

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

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              label: 'Chờ nhận',
              value: stats.pending,
              Icon: Clock3,
              color: 'text-amber-600',
            },
            {
              label: 'Đã nhận',
              value: stats.accepted,
              Icon: Truck,
              color: 'text-blue-600',
            },
            {
              label: 'Hoàn thành',
              value: stats.completed,
              Icon: CircleCheck,
              color: 'text-[#167D61]',
            },
          ].map(item => (
            <div
              key={item.label}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{item.label}</span>
                <item.Icon size={24} className={item.color} />
              </div>
              <p className="mt-3 text-3xl font-bold">
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-5 flex flex-wrap gap-3">
            <button
              onClick={() => setActiveTab('CHO_NHAN')}
              className={`rounded-xl px-5 py-3 font-medium ${
                activeTab === 'CHO_NHAN'
                  ? 'bg-[#167D61] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Đơn chờ nhận ({stats.pending})
            </button>

            <button
              onClick={() => setActiveTab('DA_NHAN')}
              className={`rounded-xl px-5 py-3 font-medium ${
                activeTab === 'DA_NHAN'
                  ? 'bg-[#167D61] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              Đơn đã nhận ({stats.accepted + stats.completed})
            </button>
          </div>

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
                onChange={e => setWasteFilter(e.target.value)}
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
                onChange={e => setAreaFilter(e.target.value)}
                className="w-full rounded-xl border p-3"
              >
                <option value="">Tất cả khu vực</option>
                {areaOptions.map(area => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {activeTab === 'CHO_NHAN' && (
            <label className="mt-5 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={priorityEnabled}
                onChange={e => setPriorityEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#167D61]"
              />
              <Sparkles size={19} className="text-amber-600" />
              <span className="font-medium">
                Bật gợi ý yêu cầu ưu tiên (F12 - P1)
              </span>
            </label>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-xl font-bold">
            {activeTab === 'CHO_NHAN'
              ? 'Danh sách yêu cầu chờ nhận'
              : 'Danh sách yêu cầu đã nhận'}
          </h2>

          {filteredRequests.length === 0 ? (
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
              {filteredRequests.map(request => {
                const score = getPriorityScore(
                  request,
                  serviceArea
                )

                return (
                  <div key={request.RequestId}>
                    {priorityEnabled &&
                      activeTab === 'CHO_NHAN' && (
                        <div className="mb-2 flex items-center gap-2 text-sm text-amber-700">
                          <Sparkles size={16} />
                          Điểm ưu tiên: {score}/100
                        </div>
                      )}

                    <RequestCard
                      request={request}
                      onView={setSelectedRequest}
                      action={
                        request.Status === 'CHO_NHAN' ? (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => handleAccept(request)}
                            className="rounded-xl bg-[#167D61] px-4 py-2 font-medium text-white hover:bg-[#11634D] disabled:opacity-50"
                          >
                            Nhận yêu cầu
                          </button>
                        ) : request.Status === 'DA_NHAN' &&
                          request.CollectorId === user.userId ? (
                          <button
                            type="button"
                            disabled={busyId !== null}
                            onClick={() => handleComplete(request)}
                            className="rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Hoàn thành
                          </button>
                        ) : null
                      }
                    />
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      <RequestDetail
        request={selectedRequest}
        role="THUGOM"
        onClose={() => setSelectedRequest(null)}
      />
    </div>
  )
}

export default ThuGom
