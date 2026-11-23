import { useEffect, useState } from 'react'

// Retry-After cũng khóa thao tác thử lại thủ công, kể cả form POST.
export function useRetryCooldown() {
  const [until, setUntil] = useState(0)
  useEffect(() => {
    if (!until) return
    const timer = setTimeout(() => setUntil(0), Math.min(2147483647, Math.max(0, until - Date.now())))
    return () => clearTimeout(timer)
  }, [until])
  return { blocked: until !== 0, defer: error => {
    if (error.retryAt > Date.now()) setUntil(error.retryAt)
  } }
}
