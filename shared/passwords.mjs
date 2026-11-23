// Giữ tham số hash cũ; đổi chính sách cần kế hoạch chuyển dữ liệu.
const PASSWORD_ITERATIONS = 310000
const PASSWORD_BYTES = 32
const PASSWORD_SCHEME = 'pbkdf2_sha256'

function parsePasswordHash(stored) {
  if (typeof stored !== 'string') return null
  const parts = stored.split('$')
  const [scheme, rounds, salt, digest] = parts
  // Hash cũ có salt 16/32 byte; PBKDF2 nhận UTF-8 của chuỗi hex, không giải mã hex.
  if (parts.length !== 4 || scheme !== PASSWORD_SCHEME || rounds !== String(PASSWORD_ITERATIONS)
    || !/^(?:[0-9a-fA-F]{32}|[0-9a-fA-F]{64})$/.test(salt ?? '')
    || !/^[0-9a-fA-F]{64}$/.test(digest ?? '')) return null
  return { salt, digest: digest.toLowerCase() }
}

const encoder = new TextEncoder()
const hex = bytes => Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')

export function normalizeUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

async function nativePbkdf2(password, salt, iterations, bytes) {
  const key = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', salt, iterations, hash: 'SHA-256',
  }, key, bytes * 8)
  return new Uint8Array(bits)
}

async function derive(password, salt, pbkdf2) {
  const passwordBytes = encoder.encode(password)
  try {
    // Dùng cùng tham số và UTF-8 cho WebCrypto (seed) lẫn Durable Object (Hosted).
    return hex(await pbkdf2(passwordBytes, encoder.encode(salt), PASSWORD_ITERATIONS, PASSWORD_BYTES))
  } finally {
    passwordBytes.fill(0)
  }
}

export async function createPasswordHash(password, pbkdf2 = nativePbkdf2) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await derive(password, salt, pbkdf2)
  return `${PASSWORD_SCHEME}$${PASSWORD_ITERATIONS}$${salt}$${digest}`
}

export async function verifyPassword(password, stored, pbkdf2 = nativePbkdf2) {
  const parsed = parsePasswordHash(stored)
  // Tài khoản không tồn tại vẫn chạy KDF để tránh lộ username qua thời gian phản hồi.
  const actual = await derive(password, parsed?.salt ?? '0'.repeat(64), pbkdf2)
  const expected = parsed?.digest ?? '0'.repeat(64)
  let difference = 0
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ actual.charCodeAt(i)
  return parsed !== null && difference === 0
}
