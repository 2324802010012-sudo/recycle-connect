// Chỉ retry GET; POST cần người dùng xác nhận gửi lại an toàn.
const TRANSIENT = new Set([429, 502, 503, 504])

function retryAfterMs(value) {
  if (!value) return null
  const ms = /^\d+(?:\.\d+)?$/.test(value.trim()) ? Number(value) * 1000 : Date.parse(value) - Date.now()
  return Number.isFinite(ms) && ms >= 0 ? ms : null
}

class ApiError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'ApiError'
    Object.assign(this, details)
  }
}

export async function readApiResponse(response, { mutation = false } = {}) {
  const data = response.status === 204 ? null : await response.json().catch(() => null)
  if (!response.ok || (response.status !== 204 && data?.success !== true)) {
    const after = retryAfterMs(response.headers.get('Retry-After'))
    const requestId = response.headers.get('X-Request-ID') || data?.requestId
    throw new ApiError(data?.error?.message || data?.message || 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại.', {
      status: response.status, code: data?.error?.code, requestId,
      retryAt: after === null ? 0 : Date.now() + after,
      unknownOutcome: mutation && (response.status >= 500 || response.ok),
    })
  }
  return data
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel)
      resolve()
    }, ms)
    function cancel() {
      clearTimeout(timer)
      signal?.removeEventListener('abort', cancel)
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal?.addEventListener('abort', cancel, { once: true })
  })
}

export async function apiFetch(url, options = {}) {
  const { signal, method = 'GET', ...rest } = options
  const safeToRetry = method.toUpperCase() === 'GET'
  const maxRetries = safeToRetry ? 2 : 0
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), safeToRetry ? 8000 : 15000)
    const combined = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
    let response
    try {
      response = await fetch(url, { ...rest, method, signal: combined })
    } catch (error) {
      if (signal?.aborted) throw signal.reason ?? error
      if (attempt >= maxRetries) throw new ApiError(
        controller.signal.aborted ? 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.' : 'Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối mạng.',
        { unknownOutcome: !safeToRetry, code: controller.signal.aborted ? 'TIMEOUT' : 'NETWORK_ERROR' },
      )
      await sleep(500 * 2 ** attempt + Math.random() * 150, signal)
      continue
    } finally {
      clearTimeout(timer)
    }
    if (!safeToRetry || !TRANSIENT.has(response.status) || attempt >= maxRetries) return response
    const after = retryAfterMs(response.headers.get('Retry-After'))
    // Chờ dài hơn 30 giây được giao cho UI và cooldown.
    if (after !== null && after > 30000) return response
    await response.body?.cancel()
    await sleep(after ?? (500 * 2 ** attempt + Math.random() * 150), signal)
  }
  throw new Error('Không thể tải dữ liệu.')
}
