export default function RequestFeedback({ state }) {
  if (state.loading) return <p role="status" className="p-4 text-gray-600">Đang tải dữ liệu…</p>
  if (!state.error) return null

  return (
    <div role="alert" className="rounded-xl border border-warning bg-warning/15 p-4 text-sm text-amber-900">
      {state.updatedAt && (
        <p>Chưa đồng bộ. Cập nhật lần cuối lúc {state.updatedAt.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.</p>
      )}
      <p>{state.error}</p>
      <button type="button" onClick={state.refresh} className="mt-2 font-semibold underline">
        Thử lại
      </button>
    </div>
  )
}

