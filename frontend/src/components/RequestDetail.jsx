import { useCallback, useEffect, useRef } from 'react'
import {
  CalendarDays, Check, CircleCheck, Clock3, MapPin, MapPinned,
  PackageOpen, Scale, StickyNote, Truck, UserRound, X,
} from 'lucide-react'
import StatusBadge from './StatusBadge'
import { getRequestDetail } from '../services/requestService'
import { areaLabel } from '../services/requestOptions'
import { useRequestData } from '../services/useRequestData'
import RequestFeedback from './RequestFeedback'

const wasteLabels = {
  GIAY: 'Giấy',
  NHUA: 'Nhựa',
  KIM_LOAI: 'Kim loại',
  THUY_TINH: 'Thủy tinh',
  KHAC: 'Khác',
}

const steps = [
  { status: 'CHO_NHAN', label: 'Chờ nhận', dateField: 'CreatedAt', Icon: Clock3 },
  { status: 'DA_NHAN', label: 'Đã nhận', dateField: 'AcceptedAt', Icon: Truck },
  { status: 'HOAN_THANH', label: 'Hoàn thành', dateField: 'CompletedAt', Icon: CircleCheck },
]

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  dateStyle: 'short',
  timeStyle: 'short',
})

function formatTimestamp(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date)
}

function formatPreferredDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('/') : value
}

function DetailField({ icon: Icon, label, value, wide = false }) {
  if (value == null || value === '') return null

  return (
    <div className={`flex min-w-0 items-start gap-3 rounded-2xl bg-[#f4f8f5] p-3 ${wide ? 'col-span-full' : ''}`}>
      <Icon size={17} className="mt-0.5 shrink-0 text-[#167d61]" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs font-medium text-slate-600">{label}</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-[#153e31]">{value}</dd>
      </div>
    </div>
  )
}

function RequestTimeline({ request }) {
  const currentIndex = steps.findIndex(step => step.status === request.Status)

  return (
    <section aria-labelledby="request-timeline-title" className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
      <h3 id="request-timeline-title" className="text-base font-bold text-[#153e31]">Tiến độ thu gom</h3>
      <ol className="mt-4">
        {steps.map(({ status, label, dateField, Icon }, index) => {
          const current = index === currentIndex
          const passed = index < currentIndex
          const timestamp = current || passed ? request[dateField] : null
          const Marker = passed ? Check : Icon
          const markerStyle = current
            ? 'bg-[#167d61] text-white ring-4 ring-[#dcefe4]'
            : passed ? 'bg-[#e7f3ec] text-[#167d61]' : 'bg-[#f0f4f2] text-slate-500'

          return (
            <li key={status} aria-current={current ? 'step' : undefined} className="relative flex gap-3 pb-3 last:pb-0 sm:gap-4">
              {index < steps.length - 1 && (
                <span aria-hidden="true" className={`absolute bottom-[-10px] left-[19px] top-8 w-0.5 ${passed ? 'bg-[#92c7ad]' : 'bg-[#e2ebe6]'}`} />
              )}
              <span className={`relative mt-2 grid size-10 shrink-0 place-items-center rounded-full ${markerStyle}`}>
                <Marker size={19} aria-hidden="true" />
              </span>
              <div className={`min-w-0 flex-1 rounded-2xl border px-3 py-2.5 sm:px-4 ${current ? 'border-[#cce5d7] bg-[#eef8f1]' : 'border-transparent'}`}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className={`text-sm font-semibold ${current || passed ? 'text-[#153e31]' : 'text-slate-600'}`}>{label}</p>
                  {current && (
                    <span className="rounded-full bg-[#dcefe4] px-2 py-0.5 text-[11px] font-semibold text-[#12644e]">Hiện tại</span>
                  )}
                </div>
                {timestamp ? (
                  <time dateTime={timestamp} className="mt-1 block text-xs tabular-nums text-slate-600">
                    {formatTimestamp(timestamp)}
                  </time>
                ) : (
                  <p className="mt-1 text-xs text-slate-600">
                    {current || passed ? 'Chưa có thời gian ghi nhận' : 'Chưa đến giai đoạn này'}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function RequestDetail({ id, onClose }) {
  const dialog = useRef(null)
  const load = useCallback(signal => getRequestDetail(id, signal), [id])
  const state = useRequestData(load, { enabled: id != null, poll: true })
  const request = state.data?.RequestId != null && String(state.data.RequestId) === String(id)
    ? state.data
    : null

  useEffect(() => {
    const element = dialog.current
    if (id == null || !element) return
    const trigger = document.activeElement
    if (!element.open) element.showModal()
    return () => {
      if (element.open) element.close()
      if (trigger?.isConnected) trigger.focus()
    }
  }, [id])

  if (id == null) return null

  return (
    <dialog
      ref={dialog}
      aria-labelledby="request-detail-title"
      onCancel={event => { event.preventDefault(); onClose() }}
      onClick={event => {
        if (event.target === event.currentTarget) {
          const bounds = event.currentTarget.getBoundingClientRect()
          if (event.clientX < bounds.left || event.clientX > bounds.right ||
              event.clientY < bounds.top || event.clientY > bounds.bottom) onClose()
        }
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto overscroll-contain bg-[#f5f8f6] shadow-2xl backdrop:bg-[#0c2a21]/50 md:bottom-3 md:left-auto md:right-3 md:top-3 md:h-auto md:max-w-xl md:rounded-3xl"
    >
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-white px-4 py-3 sm:px-6">
        <h2 id="request-detail-title" className="min-w-0 break-words text-lg font-bold tracking-tight text-[#153e31] sm:text-xl">
          Chi tiết yêu cầu #{id}
        </h2>
        <button type="button" onClick={onClose} aria-label="Đóng chi tiết"
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eef4f1] text-[#153e31] transition hover:bg-[#deebe3]">
          <X size={21} aria-hidden="true" />
        </button>
      </header>

      <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
        <RequestFeedback state={state} />
        {request && (
          <>
            <section aria-label="Tóm tắt yêu cầu" className="rounded-3xl bg-gradient-to-br from-[#143e32] to-[#1c7056] p-4 text-white sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15">
                    <PackageOpen size={22} aria-hidden="true" />
                  </span>
                  <h3 className="min-w-0 break-words text-lg font-semibold tracking-tight">
                    {wasteLabels[request.WasteType] ?? request.WasteType}
                  </h3>
                </div>
                <div className="rounded-full bg-white">
                  <StatusBadge status={request.Status} />
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-2 border-t border-white/20 pt-3 text-sm">
                <div className="min-w-0">
                  <dt className="flex items-center gap-1.5 text-xs text-emerald-100"><Scale size={15} aria-hidden="true" />Khối lượng</dt>
                  <dd className="mt-1 break-words font-semibold tabular-nums">{request.QuantityKg} kg</dd>
                </div>
                <div className="min-w-0">
                  <dt className="flex items-center gap-1.5 text-xs text-emerald-100"><MapPinned size={15} aria-hidden="true" />Khu vực</dt>
                  <dd className="mt-1 break-words font-semibold">{areaLabel(request.Area)}</dd>
                </div>
              </dl>
            </section>

            <RequestTimeline request={request} />

            <section aria-labelledby="request-info-title" className="rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
              <h3 id="request-info-title" className="text-base font-bold text-[#153e31]">Thông tin thu gom</h3>
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                <DetailField icon={CalendarDays} label="Ngày mong muốn" value={formatPreferredDate(request.PreferredDate)} />
                <DetailField icon={Clock3} label="Ngày tạo" value={request.CreatedAt && formatTimestamp(request.CreatedAt)} />
                <DetailField icon={MapPin} label="Địa chỉ thu gom" value={request.Address} wide />
                <DetailField icon={StickyNote} label="Ghi chú" value={request.Note} wide />
              </dl>
            </section>

            {request.CollectorId && (
              <section aria-labelledby="request-collector-title" className="flex items-center gap-3 rounded-3xl border bg-white p-4 shadow-sm sm:p-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e7f3ec] text-[#167d61]">
                  <UserRound size={22} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 id="request-collector-title" className="text-xs font-medium text-slate-600">Người thu gom</h3>
                  {request.CollectorName && <p className="mt-0.5 break-words text-sm font-semibold text-[#153e31]">{request.CollectorName}</p>}
                  <p className="mt-0.5 text-xs text-slate-600">Mã nhân viên #{request.CollectorId}</p>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </dialog>
  )
}

export default RequestDetail
