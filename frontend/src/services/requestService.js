import { apiFetch, readApiResponse } from './apiClient'
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

async function requestApi(path, { query, signal, method = 'GET', body, idempotencyKey } = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== '' && value != null) params.set(key, value)
  }
  const response = await apiFetch(`/api/${path}${params.size ? `?${params}` : ''}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    signal,
    headers: body ? { 'Content-Type': 'application/json', ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const result = await readApiResponse(response, { mutation: method !== 'GET' })
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

export function createRequest(body, idempotencyKey) {
  return requestApi('requests', { method: 'POST', body, idempotencyKey })
}

export function updateRequest(id, action) {
  return requestApi(`requests/${id}/${action}`, { method: 'POST' })
}

export function getAdminStats(signal) {
  return requestApi('admin/stats', { signal })
}
