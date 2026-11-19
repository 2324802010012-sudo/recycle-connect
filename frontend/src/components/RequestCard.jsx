
import {
  CalendarDays,
  MapPin,
  Scale,
  Eye,
} from 'lucide-react'
import StatusBadge from './StatusBadge'

const wasteLabels = {
  GIAY: 'Giấy',
  NHUA: 'Nhựa',
  KIM_LOAI: 'Kim loại',
  THUY_TINH: 'Thủy tinh',
  KHAC: 'Khác',
}

function RequestCard({
  request,
  onView,
  action,
}) {
  if (!request) return null

  return (
    <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-[#253B35]">
          Yêu cầu #{request.RequestId}
        </h3>

        <StatusBadge status={request.Status} />
      </div>

      <div className="space-y-3 text-sm text-gray-600">
        <p className="flex items-center gap-2">
          <Scale size={18} className="text-[#167D61]" />
          {wasteLabels[request.WasteType] || request.WasteType}
          {' · '}
          {request.QuantityKg} kg
        </p>

        <p className="flex items-center gap-2">
          <MapPin size={18} className="text-[#167D61]" />
          Khu vực: {request.Area}
        </p>

        <p className="flex items-center gap-2">
          <CalendarDays size={18} className="text-[#167D61]" />
          Ngày mong muốn: {request.PreferredDate}
        </p>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 border-t pt-4">
        <button
          type="button"
          onClick={() => onView?.(request)}
          disabled={!onView}
          className="inline-flex items-center gap-2 rounded-xl border border-[#167D61] px-4 py-2 font-medium text-[#167D61] hover:bg-[#EAF5EF] disabled:opacity-50"
        >
          <Eye size={18} />
          Xem chi tiết
        </button>

        {action}
      </div>
    </article>
  )
}

export default RequestCard
