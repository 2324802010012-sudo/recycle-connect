
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, UserRound, Recycle } from 'lucide-react'
import { login } from '../services/authService'

function Login() {
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!username.trim() || !password) {
      setError('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.')
      return
    }

    setLoading(true)

    try {
    const data = await login(username.trim(), password)

if (!data.success || !data.user) {
  throw new Error('Đăng nhập không thành công.')
}

const user = data.user

      if (user.role === 'DAN') {
        navigate('/dan', { replace: true })
      } else if (user.role === 'THUGOM') {
        navigate('/thugom', { replace: true })
      } else if (user.role === 'ADMIN') {
        navigate('/admin', { replace: true })
      } else {
        setError('Vai trò tài khoản không hợp lệ.')
      }
    } catch (err) {
      setError(err.message || 'Không thể kết nối máy chủ.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">

        <div className="flex flex-col items-center mb-8">
          <div className="bg-green-50 p-4 rounded-full mb-4">
            <Recycle size={42} className="text-[#167D61]" />
          </div>

          <h1 className="text-3xl font-bold text-[#167D61]">
            RECYCLE CONNECT
          </h1>

          <p className="text-gray-500 mt-2 text-center">
            Đăng nhập vào hệ thống thu gom rác tái chế
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label htmlFor="username" className="block font-medium mb-2">
              Tên đăng nhập
            </label>

            <div className="relative">
              <UserRound
                size={20}
                className="absolute left-3 top-3 text-gray-400"
              />

              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập"
                className="w-full border border-gray-300 rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-[#167D61]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block font-medium mb-2">
              Mật khẩu
            </label>

            <div className="relative">
              <LockKeyhole
                size={20}
                className="absolute left-3 top-3 text-gray-400"
              />

              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full border border-gray-300 rounded-xl py-3 pl-11 pr-12 focus:outline-none focus:ring-2 focus:ring-[#167D61]"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                className="absolute right-3 top-3 text-gray-500"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div role="alert" className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#167D61] hover:bg-[#11634D] text-white font-semibold py-3 rounded-xl disabled:opacity-60"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <div className="text-center mt-6">
          <Link to="/" className="text-[#167D61] hover:underline">
            ← Quay về trang chủ
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Login
