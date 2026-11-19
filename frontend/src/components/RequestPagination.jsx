export default function RequestPagination({ pagination, onPage }) {
  if (!pagination) return null
  const { page, limit, total } = pagination
  const pages = Math.max(1, Math.ceil(total / limit))
  if (pages === 1 && page === 1) return null

  return (
    <nav aria-label="Phân trang yêu cầu" className="flex flex-wrap items-center justify-center gap-4 p-4 text-sm">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}
        className="rounded-lg border px-3 py-2 disabled:opacity-40">Trang trước</button>
      <span>Trang {page} / {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}
        className="rounded-lg border px-3 py-2 disabled:opacity-40">Trang sau</button>
    </nav>
  )
}

