import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const POLL_INTERVAL = 5000
const empty = { data: null, error: '', updatedAt: null }

export function useRequestData(load, { enabled = true, poll = false } = {}) {
  const navigate = useNavigate()
  const [snapshot, setSnapshot] = useState(null)
  const [revision, setRevision] = useState(0)
  const nextAllowed = useRef(0)
  const refresh = useCallback(() => setRevision(value => value + 1), [])

  useEffect(() => {
    if (!enabled) return

    let active = true
    let timer
    let controller
    let sessionExpired = false
    let offline = false

    function stop() {
      clearTimeout(timer)
      controller?.abort()
    }

    async function fetchData() {
      stop()
      if (nextAllowed.current > Date.now()) {
        timer = setTimeout(fetchData, Math.min(2147483647, nextAllowed.current - Date.now()))
        return
      }
      const request = new AbortController()
      controller = request
      let permanentError = false
      try {
        const data = await load(request.signal)
        if (active && !request.signal.aborted) {
          setSnapshot({ load, data, error: '', updatedAt: new Date(), retryAt: 0 })
        }
      } catch (error) {
        if (!active || request.signal.aborted) return
        if (error.status === 401) {
          sessionExpired = true
          navigate('/login', { replace: true })
          return
        }
        const unavailable = [403, 404].includes(error.status)
        permanentError = [400, 403, 404, 409].includes(error.status)
        nextAllowed.current = error.retryAt || 0
        const message = error.status === 403 ? 'Bạn không có quyền truy cập.' : error.message
        setSnapshot(previous => ({
          ...(previous?.load === load && !unavailable ? previous : empty),
          load,
          error: message,
          retryAt: nextAllowed.current,
        }))
      } finally {
        if (active && poll && !permanentError && !sessionExpired && !offline && controller === request && !document.hidden) {
          timer = setTimeout(fetchData, Math.min(2147483647, Math.max(POLL_INTERVAL, nextAllowed.current - Date.now())))
        }
      }
    }

    function onVisibilityChange() {
      if (document.hidden) stop()
      else if (!sessionExpired && !offline) fetchData()
    }

    function onOffline() {
      offline = true
      stop()
      setSnapshot(previous => ({
        ...(previous?.load === load ? previous : empty),
        load,
        error: 'Mất kết nối mạng. Dữ liệu có thể chưa đồng bộ.',
      }))
    }
    function onOnline() { offline = false; if (active && !sessionExpired && !document.hidden) fetchData() }
    if (!poll || !document.hidden) fetchData()
    if (poll) {
      document.addEventListener('visibilitychange', onVisibilityChange)
      window.addEventListener('offline', onOffline)
      window.addEventListener('online', onOnline)
    }
    return () => {
      active = false
      stop()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [load, enabled, poll, revision, navigate])

  const current = enabled && snapshot?.load === load ? snapshot : empty
  return { ...current, lastData: enabled ? snapshot?.data : null, loading: enabled && current === empty,
    synchronized: Boolean(current.data && !current.error), refresh }
}

