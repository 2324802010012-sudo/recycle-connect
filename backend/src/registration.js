import { normalizeUsername } from '../../shared/passwords.mjs'
import { hashPassword } from './password-service.js'

export function validateRegistration(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Dữ liệu đăng ký không hợp lệ.' }
  }
  // Quyền DAN do server gán, client không được chọn vai trò.
  if (Object.hasOwn(body, 'role') || Object.hasOwn(body, 'Role') || Object.hasOwn(body, 'userId')) {
    return { error: 'Dữ liệu đăng ký chứa trường không được phép.' }
  }
  const username = normalizeUsername(body.username)
  const fullName = typeof body.fullName === 'string' ? body.fullName.trim().replace(/\s+/g, ' ') : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!/^[a-z][a-z0-9_]{3,23}$/.test(username)) {
    return { error: 'Tên đăng nhập từ 4–24 ký tự, bắt đầu bằng chữ và chỉ gồm chữ thường, số, dấu gạch dưới.' }
  }
  if (fullName.length < 2 || fullName.length > 80) {
    return { error: 'Họ tên phải dài từ 2 đến 80 ký tự.' }
  }
  if (password.length < 12 || password.length > 128 ||
      !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { error: 'Mật khẩu dài 12–128 ký tự, có chữ hoa, chữ thường và chữ số.' }
  }
  return { username, fullName, password }
}

function errorResponse(status, code, message, headers = {}) {
  return Response.json({ success: false, error: { code, message } },
    { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

export async function registerCitizen(request, env) {
  const body = await request.json().catch(() => null)
  const parsed = validateRegistration(body)
  if (parsed.error) return errorResponse(400, 'INVALID_REGISTRATION', parsed.error)
  const { success: allowed } = await env.REGISTRATION_LIMITER.limit({
    key: 'register:' + (request.headers.get('CF-Connecting-IP') ?? 'local'),
  })
  if (!allowed) {
    return errorResponse(429, 'REGISTRATION_RATE_LIMITED',
      'Bạn đăng ký quá nhiều lần. Vui lòng thử lại sau một phút.', { 'Retry-After': '60' })
  }
  const passwordHash = await hashPassword(env, parsed.password)

  try {
    const inserted = await env.DB.prepare(`
      INSERT INTO Users (Username,PasswordHash,FullName,Role,ServiceArea,CreatedAt)
      VALUES (?,?,?,'DAN',NULL,?) RETURNING UserId AS userId
    `).bind(parsed.username, passwordHash, parsed.fullName, new Date().toISOString()).first()
    return Response.json({ success: true, data: { userId: inserted.userId, role: 'DAN' } },
      { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (/UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE/i.test(String(error?.message))) {
      return errorResponse(409, 'USERNAME_TAKEN', 'Tên đăng nhập đã tồn tại.')
    }
    throw error
  }
}
