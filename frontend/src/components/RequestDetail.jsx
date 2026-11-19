
import { useCallback, useEffect, useRef } from 'react'
import {
  X,
  UserRound,
  Clock3,
  CheckCircle2,
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
  { status: 'CHO_NHAN', label: 'Chờ nhận' },
  { status: 'DA_NHAN', label: 'Đã nhận' },
  { status: 'HOAN_THANH', label: 'Hoàn thành' },
]

function formatDate(value) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
}

function DetailRow({ label, value }) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return (
    <div className="border-b border-gray-100 py-3">
      <p className="mb-1 text-sm text-gray-500">{label}</p>
      <p className="break-words font-medium text-[#253B35]">
        {value}
      </p>
    </div>
  )
}

function RequestDetail({ id, onClose }) {
  const dialog = useRef(null)
  const load = useCallback(signal => getRequestDetail(id, signal), [id])
  const state = useRequestData(load, { enabled: id != null, poll: true })
  const request = state.data

  useEffect(() => {
    const element = dialog.current
    if (id == null || !element) return
    const trigger = document.activeElement
    element.showModal()
    return () => {
      element.close()
      trigger?.focus()
    }
  }, [id])

  if (id == null) return null

  const currentIndex = steps.findIndex(
    step => step.status === request?.Status
  )

  const timestamps = {
    CHO_NHAN: request?.CreatedAt,
    DA_NHAN: request?.AcceptedAt,
    HOAN_THANH: request?.CompletedAt,
  }

  const showCollector = Boolean(request?.CollectorId)

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
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto bg-white shadow-2xl backdrop:bg-black/40 md:left-auto md:w-full md:max-w-xl"
    >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4">
          <h2
            id="request-detail-title"
            className="text-xl font-bold text-[#167D61]"
          >
            Chi tiết yêu cầu #{id}
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chi tiết"
            className="rounded-lg p-2 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-[#167D61]"
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-7 p-5 md:p-7">
          <RequestFeedback state={state} />
          {request && <>
          <section>
            <h3 className="mb-4 text-lg font-bold">
              Thông tin yêu cầu
            </h3>

            <StatusBadge status={request.Status} />

            <div className="mt-4">
              <DetailRow
                label="Loại rác"
                value={wasteLabels[request.WasteType] || request.WasteType}
              />
              <DetailRow
                label="Khối lượng"
                value={`${request.QuantityKg} kg`}
              />
              <DetailRow
                label="Khu vực"
                value={areaLabel(request.Area)}
              />
              <DetailRow
                label="Địa chỉ thu gom"
                value={request.Address}
              />
              <DetailRow
                label="Ngày mong muốn"
                value={request.PreferredDate}
              />
              <DetailRow
                label="Ghi chú"
                value={request.Note}
              />
              <DetailRow
                label="Ngày tạo"
                value={formatDate(request?.CreatedAt)}
              />
            </div>
          </section>

          {showCollector && (
            <section className="rounded-xl bg-[#EAF5EF] p-4">
              <div className="flex items-center gap-2 font-semibold">
                <UserRound size={20} />
                Thông tin người thu gom
              </div>

              <p className="mt-2 text-sm">
                Mã nhân viên: {request.CollectorId}
              </p>

              {request.CollectorName && (
                <p className="mt-1 text-sm">
                  Họ tên: {request.CollectorName}
                </p>
              )}
            </section>
          )}

          <section>
            <h3 className="mb-5 text-lg font-bold">
              Tiến độ thu gom
            </h3>

            <div className="space-y-0">
              {steps.map((step, index) => {
                const active = index <= currentIndex
                const timestamp = timestamps[step.status]

                return (
                  <div key={step.status} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${
                          active
                            ? 'bg-[#167D61] text-white'
                            : 'bg-gray-100 text-gray-400'
                        }`}
                      >
                        {active
                          ? <CheckCircle2 size={20} />
                          : <Clock3 size={20} />}
                      </div>

                      {index < steps.length - 1 && (
                        <div
                          className={`h-14 w-0.5 ${
                            index < currentIndex
                              ? 'bg-[#167D61]'
                              : 'bg-gray-200'
                          }`}
                        />
                      )}
                    </div>

                    <div className="pb-7">
                      <p
                        className={`font-semibold ${
                          active ? 'text-[#253B35]' : 'text-gray-400'
                        }`}
                      >
                        {step.label}
                      </p>

                      {active && timestamp && (
                        <p className="mt-1 text-sm text-gray-500">
                          {formatDate(timestamp)}
                        </p>
                      )}

                      {!active && (
                        <p className="mt-1 text-sm text-gray-400">
                          Chưa đến giai đoạn này
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          </>}
        </div>
    </dialog>
  )
}

export default RequestDetail
