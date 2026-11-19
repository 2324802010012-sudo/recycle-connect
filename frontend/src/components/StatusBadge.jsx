
import {
  Clock3,
  Truck,
  CircleCheck,
  CircleHelp,
} from 'lucide-react'

const statusConfig = {
  CHO_NHAN: {
    label: 'Chờ nhận',
    Icon: Clock3,
    className: 'bg-amber-50 text-amber-700',
  },
  DA_NHAN: {
    label: 'Đã nhận',
    Icon: Truck,
    className: 'bg-blue-50 text-blue-700',
  },
  HOAN_THANH: {
    label: 'Hoàn thành',
    Icon: CircleCheck,
    className: 'bg-green-50 text-green-700',
  },
}

function StatusBadge({ status }) {
  const config = statusConfig[status] || {
    label: 'Không xác định',
    Icon: CircleHelp,
    className: 'bg-gray-100 text-gray-600',
  }

  const { Icon } = config

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${config.className}`}
    >
      <Icon size={16} />
      {config.label}
    </span>
  )
}

export default StatusBadge
