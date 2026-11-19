const requestFields = [
  'RequestId', 'CollectorId', 'CollectorName', 'WasteType', 'QuantityKg',
  'Address', 'Area', 'PreferredDate', 'Note', 'Status', 'CreatedAt',
  'AcceptedAt', 'CompletedAt', 'PriorityScore',
]

function normalizeRequest(request) {
  return Object.fromEntries(requestFields.map(field => {
    const key = field[0].toLowerCase() + field.slice(1)
    return [field, Object.hasOwn(request, key) ? request[key] : request[field]]
  }))
}

async function requestApi(path, { query, signal, method = 'GET', body } = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== '' && value != null) params.set(key, value)
  }
  const response = await fetch(`/api/${path}${params.size ? `?${params}` : ''}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: signal ?? AbortSignal.timeout(15000),
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = await response.json().catch(() => null)

  if (!response.ok || result?.success !== true) {
    const message = result?.error?.message || 'Không thể tải dữ liệu. Vui lòng thử lại.'
    throw Object.assign(new Error(message), { status: response.status })
  }

  return result.data
}

export async function getRequestPage(path, query, signal) {
  const result = await requestApi(path, { query, signal })
  return { ...result, items: result.items.map(normalizeRequest) }
}

export async function getRequestDetail(id, signal) {
  const data = await requestApi(`requests/${id}`, { signal })
  return normalizeRequest(data.request ?? data)
}

export function createRequest(body) {
  return requestApi('requests', { method: 'POST', body })
}

export function updateRequest(id, action) {
  return requestApi(`requests/${id}/${action}`, { method: 'POST' })
}

export function getAdminStats(signal) {
  return requestApi('admin/stats', { signal })
}
