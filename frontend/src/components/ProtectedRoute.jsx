
import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { getCurrentUser, rolePaths } from '../services/authService'

function ProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [verifiedPath, setVerifiedPath] = useState(null)

  useEffect(() => {
    let active = true

    async function checkAuthentication() {
      setLoading(true)
      setError('')

      try {
        const data = await getCurrentUser()

        if (active) {
          setUser(data?.user ?? null)
        }
      } catch (err) {
        if (active) {
          setUser(null)
          setError(
            err.message || 'Không thể kiểm tra phiên đăng nhập.'
          )
        }
      } finally {
        if (active) {
          setVerifiedPath(location.pathname)
          setLoading(false)
        }
      }
    }

    checkAuthentication()

    return () => {
      active = false
    }
  }, [location.pathname, retry])

  if (loading || verifiedPath !== location.pathname) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9]">
        <p role="status" className="text-[#167D61]">
          Đang kiểm tra quyền truy cập...
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#F8FAF9] p-6 text-center">
        <p role="alert" className="text-red-600">
          {error}
        </p>

        <button
          type="button"
          onClick={() => setRetry(value => value + 1)}
          className="rounded-xl bg-[#167D61] px-5 py-3 text-white"
        >
          Thử lại
        </button>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  if (!allowedRoles.includes(user.role)) {
    const home = rolePaths[user.role]

    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f8f6] px-4 py-8">
        <section className="w-full max-w-md rounded-3xl border bg-white p-6 text-center shadow-sm sm:p-8">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-warning/20 text-amber-900">
            <ShieldAlert size={28} aria-hidden="true" />
          </div>
          <div role="alert">
            <h1 className="text-xl font-bold tracking-tight text-[#153e31] sm:text-2xl">
              Không có quyền truy cập
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Tài khoản của bạn không có quyền mở trang này.
            </p>
          </div>
          <Link to={home ?? '/login'} replace
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#167d61] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#11634d]">
            <ArrowLeft size={18} aria-hidden="true" />
            {home ? 'Về trang của tôi' : 'Về trang đăng nhập'}
          </Link>
        </section>
      </main>
    )
  }

  return children(user)
}

export default ProtectedRoute
