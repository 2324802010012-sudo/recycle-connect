
import { Inbox } from 'lucide-react'

function EmptyState({
  title = 'Chưa có dữ liệu',
  description = 'Hiện chưa có thông tin để hiển thị.',
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center">
      <div className="mb-4 rounded-full bg-[#EAF5EF] p-4">
        <Inbox
          size={32}
          className="text-[#167D61]"
          aria-hidden="true"
        />
      </div>

      <h3 className="text-lg font-semibold text-[#253B35]">
        {title}
      </h3>

      <p className="mt-2 max-w-sm text-sm text-gray-500">
        {description}
      </p>
    </div>
  )
}

export default EmptyState
