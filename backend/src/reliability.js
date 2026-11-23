export async function sha256Hex(input) {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, '0')).join('')
}

export function validIdempotencyKey(key) {
  return typeof key === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)
}

export function safeLogRoute(pathname) {
  const route = pathname.replace(/\/\d+(?=\/|$)/g, '/:id')
  return /^\/api\/(?:health|auth\/(?:login|logout|me|register)|admin\/(?:requests|stats)|requests(?:\/(?:mine|available|assigned|:id(?:\/(?:accept|complete))?))?)$/.test(route)
    ? route : '/api/unknown'
}

export function dbErrorLikely(error) {
  const message = String(error?.message || '')
  return /D1_|database|SQLITE_|sqlite|SQL error|binding/i.test(message)
}
