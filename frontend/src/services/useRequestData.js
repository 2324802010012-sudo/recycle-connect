import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// Build-time override for TN02; normal builds always default to five seconds.
const experimentInterval = Number(import.meta.env.VITE_POLL_INTERVAL_MS)
const POLL_INTERVAL = [2000, 5000, 10000].includes(experimentInterval) ? experimentInterval : 5000
const empty = { data: null, error: '', updatedAt: null }

export function useRequestData(load, { enabled = true, poll = false, clearOnError = false } = {}) {
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState(null)
  const [revision, setRevision] = useState(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])

  useEffect(() => {
    if (!enabled) return

    let active = true
    let timer
    let controller
    let sessionExpired = false

    function stop() {
      clearTimeout(timer)
      controller?.abort()
    }

    async function fetchData() {
      stop()
      const request = new AbortController()
      controller = request
      const timeout = setTimeout(() => request.abort('timeout'), 12000)
      try {
        const data = await load(request.signal)
        if (active && !request.signal.aborted) {
          setSnapshot({ load, data, error: '', updatedAt: new Date() })
        }
      } catch (error) {
        if (!active || (request.signal.aborted && request.signal.reason !== 'timeout')) return
        if (error.status === 401) {
          sessionExpired = true
          navigate('/login', { replace: true })
          return
        }
        const unavailable = [403, 404].includes(error.status)
        const message = error.status === 403 ? 'Bạn không có quyền truy cập.'
          : request.signal.reason === 'timeout' ? 'Máy chủ phản hồi quá chậm. Vui lòng thử lại.'
            : error.message
        setSnapshot(previous => ({
          ...(previous?.load === load && !clearOnError && !unavailable ? previous : empty),
          load,
          error: message,
        }))
      } finally {
        clearTimeout(timeout)
        if (active && poll && !sessionExpired && controller === request && !document.hidden) {
          timer = setTimeout(fetchData, POLL_INTERVAL)
        }
      }
    }

    function onVisibilityChange() {
      if (document.hidden) stop()
      else if (!sessionExpired) fetchData()
    }

    if (!poll || !document.hidden) fetchData()
    if (poll) document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      active = false
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [load, enabled, poll, clearOnError, revision, navigate])

  const current = enabled && snapshot?.load === load ? snapshot : empty
  return { ...current, lastData: enabled ? snapshot?.data : null, loading: enabled && current === empty, refresh }
}

