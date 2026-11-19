
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Recycle,
  Plus,
  Clock3,
  Truck,
  CircleCheck,
  LogOut,
  ClipboardList,
} from 'lucide-react'
import { getCurrentUser, logout } from '../services/authService'
import EmptyState from '../components/EmptyState'

function Dan() {
  const navigate = useNavigate()

  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let active = true

    async function loadUser() {
      try {
        const data = await getCurrentUser()
        if (!active) return

        if (!data?.user) {
          navigate('/login', { replace: true })
          return
        }

        if (data.user.role !== 'DAN') {
          navigate('/login', { replace: true })
          return
        }

        setUser(data.user)
      } catch (err) {
        if (active) {
          setError(err.message || 'Không thể tải tài khoản.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadUser()

    return () => {
      active = false
    }
  }, [navigate])

  async function handleLogout() {
    setLoggingOut(true)
    setError('')

    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err.message || 'Không thể đăng xuất.')
    } finally {
      setLoggingOut(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9]">
        <p role="status" className="text-[#167D61]">
          Đang tải thông tin tài khoản...
        </p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div role="alert" className="text-center">
          <p>{error || 'Không thể xác thực tài khoản.'}</p>
          <Link to="/login" className="text-[#167D61] underline">
            Quay lại đăng nhập
          </Link>
        </div>
      </div>
    )
  }

  const stats = [
    {
      title: 'Chờ nhận',
      Icon: Clock3,
      color: 'text-amber-600',
      background: 'bg-amber-50',
    },
    {
      title: 'Đã nhận',
      Icon: Truck,
      color: 'text-blue-600',
      background: 'bg-blue-50',
    },
    {
      title: 'Hoàn thành',
      Icon: CircleCheck,
      color: 'text-green-600',
      background: 'bg-green-50',
    },
  ]

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-[#253B35]">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/dan" className="flex items-center gap-2">
            <Recycle size={30} className="text-[#167D61]" />
            <span className="font-bold text-lg text-[#167D61]">
              RECYCLE CONNECT
            </span>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex items-center gap-2 text-gray-600 hover:text-red-600 disabled:opacity-50"
          >
            <LogOut size={18} />
            <span>{loggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div role="alert" className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        <section className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 shadow-sm">
          <p className="text-gray-500 mb-2">
            Trang người dân
          </p>

          <h1 className="text-2xl md:text-3xl font-bold mb-3">
            Xin chào, {user.fullName}!
          </h1>

          <p className="text-gray-600 mb-6">
            Tạo yêu cầu thu gom rác tái chế và theo dõi
            tiến độ xử lý của bạn.
          </p>

          <Link
            to="/dan/tao-yeu-cau"
            className="inline-flex items-center justify-center gap-2 bg-[#167D61] hover:bg-[#11634D] text-white font-semibold px-6 py-3 rounded-xl"
          >
            <Plus size={20} />
            Tạo yêu cầu thu gom
          </Link>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-bold mb-4">
            Tổng quan yêu cầu
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map(({ title, Icon, color, background }) => (
              <div
                key={title}
                className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm"
              >
                <div className={`inline-flex p-3 rounded-xl ${background}`}>
                  <Icon size={24} className={color} />
                </div>

                <p className="mt-4 text-gray-500">
                  {title}
                </p>

                <p className="mt-2 text-sm font-medium text-gray-400">
                  Chưa tải dữ liệu
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList size={23} className="text-[#167D61]" />
            <h2 className="text-xl font-bold">
              Yêu cầu gần đây
            </h2>
          </div>

          <EmptyState
            title="Chưa có danh sách yêu cầu"
            description="Danh sách sẽ được hiển thị khi kết nối API yêu cầu thu gom. Bạn có thể chuẩn bị thông tin bằng biểu mẫu tạo yêu cầu."
          />
        </section>
      </main>
    </div>
  )
}

export default Dan
