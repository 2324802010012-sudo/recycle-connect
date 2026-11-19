
import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getCurrentUser } from '../services/authService'

const rolePaths = {
  DAN: '/dan',
  THUGOM: '/thugom',
  ADMIN: '/admin',
}

function ProtectedRoute({ children, allowedRoles = [] }) {
  const location = useLocation()

  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')

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
          setError(
            err.message || 'Không thể kiểm tra phiên đăng nhập.'
          )
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    checkAuthentication()

    return () => {
      active = false
    }
  }, [location.pathname])

  if (loading) {
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
          onClick={() => window.location.reload()}
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
    return (
      <Navigate
        to={rolePaths[user.role] || '/login'}
        replace
      />
    )
  }

  return children(user)
}

export default ProtectedRoute
