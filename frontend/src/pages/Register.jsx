import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Recycle, UserRoundPlus } from 'lucide-react'
import { register } from '../services/authService'
import { useRetryCooldown } from '../hooks/useRetryCooldown'

const inputStyle = 'mt-2 block w-full rounded-xl border border-slate-200 bg-[#f8faf9] px-4 py-3 text-base text-[#253b35] outline-none focus:border-[#167d61] focus:ring-2 focus:ring-[#167d61]/15'

export default function Register() {
  const navigate = useNavigate()
  const lock = useRef(false)
  const [form, setForm] = useState({ fullName: '', username: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const cooldown = useRetryCooldown()

  function change(key, value) {
    setForm(previous => ({ ...previous, [key]: value }))
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (lock.current || cooldown.blocked) return
    if (!/^[a-z][a-z0-9_]{3,23}$/.test(form.username.trim().toLowerCase())) {
      setError('Tên đăng nhập từ 4–24 ký tự, bắt đầu bằng chữ, chỉ gồm chữ, số và dấu gạch dưới.')
      return
    }
    if (form.fullName.trim().length < 2) {
      setError('Họ tên phải có ít nhất 2 ký tự.')
      return
    }
    if (form.password.length < 12 || !/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      setError('Mật khẩu từ 12–128 ký tự, có chữ hoa, chữ thường và chữ số.')
      return
    }
    if (form.password !== form.confirm) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }

    lock.current = true
    setLoading(true)
    setError('')
    try {
      await register({
        fullName: form.fullName,
        username: form.username,
        password: form.password,
      })
      // Không giữ mật khẩu trong state sau khi đăng ký thành công.
      setForm(previous => ({ ...previous, password: '', confirm: '' }))
      navigate('/login', { replace: true, state: { justRegistered: true } })
    } catch (e) {
      cooldown.defer(e)
      setError(e.message || 'Không thể đăng ký tài khoản.')
    } finally {
      lock.current = false
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f8f6] px-4 py-8 text-[#253b35]">
      <div className="mx-auto max-w-lg rounded-3xl border bg-white p-6 shadow-lg sm:p-9">
        <div className="flex items-center gap-3 text-[#167d61]">
          <Recycle size={32} aria-hidden="true" />
          <strong className="text-lg">Recycle Connect</strong>
        </div>
        <h1 className="mt-5 flex items-center gap-2 text-2xl font-bold">
          <UserRoundPlus aria-hidden="true" /> Đăng ký người dân
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Chỉ tạo tài khoản người dân. Người thu gom và quản trị được cấp tài khoản riêng.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <label htmlFor="fullName" className="block text-sm font-semibold">
            Họ và tên
            <input id="fullName" name="fullName" required autoComplete="name"
              maxLength={80} value={form.fullName}
              onChange={e => change('fullName', e.target.value)}
              className={inputStyle} />
          </label>

          <label htmlFor="username" className="block text-sm font-semibold">
            Tên đăng nhập
            <input id="username" name="username" required autoComplete="username"
              minLength={4} maxLength={24} value={form.username}
              onChange={e => change('username', e.target.value)}
              className={inputStyle} />
          </label>

          <div>
            <label htmlFor="register-password" className="block text-sm font-semibold">Mật khẩu</label>
            <div className="relative">
              <input id="register-password" name="password" required
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password" minLength={12} maxLength={128}
                value={form.password}
                onChange={e => change('password', e.target.value)}
                className={`${inputStyle} pr-14`} />
              <button type="button" onClick={() => setShowPassword(value => !value)}
                aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-2 mt-2 flex w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-[#e7f3ec]">
                {showPassword ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="register-confirm" className="block text-sm font-semibold">Nhập lại mật khẩu</label>
            <div className="relative">
              <input id="register-confirm" name="confirm" required
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password" minLength={12} maxLength={128}
                value={form.confirm}
                onChange={e => change('confirm', e.target.value)}
                className={`${inputStyle} pr-14`} />
              <button type="button" onClick={() => setShowConfirm(value => !value)}
                aria-label={showConfirm ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'}
                aria-pressed={showConfirm}
                className="absolute inset-y-0 right-2 mt-2 flex w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-[#e7f3ec]">
                {showConfirm ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-600">
            Tên đăng nhập 4–24 ký tự, bắt đầu bằng chữ: chữ, số, dấu gạch dưới; tự chuyển thành chữ thường.
            Mật khẩu 12–128 ký tự, gồm chữ hoa, chữ thường và số. Khoảng trắng trong mật khẩu được giữ nguyên.
          </p>
          {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={loading || cooldown.blocked} aria-busy={loading}
            className="w-full rounded-xl bg-[#167d61] p-3 font-semibold text-white hover:bg-[#12664f] disabled:opacity-60">
            {loading ? 'Đang tạo tài khoản…' : cooldown.blocked ? 'Vui lòng chờ để thử lại' : 'Tạo tài khoản'}
          </button>
        </form>

        <Link className="mt-5 block text-center text-sm font-semibold text-[#167d61] underline" to="/login">
          Đã có tài khoản? Đăng nhập
        </Link>
      </div>
    </main>
  )
}
