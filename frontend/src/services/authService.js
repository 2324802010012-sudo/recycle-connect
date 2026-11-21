
export const rolePaths = {
  DAN: '/dan',
  THUGOM: '/thugom',
  ADMIN: '/admin',
}

async function parseResponse(response) {
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw Object.assign(new Error(
      data?.error?.message ||
      data?.message ||
      'Không thể xử lý yêu cầu.'
    ), { status: response.status })
  }

  return data
}

export async function login(username, password) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ username, password }),
  })

  return parseResponse(response)
}

export async function getCurrentUser() {
  const response = await fetch('/api/auth/me', {
    method: 'GET',
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  })

  if (response.status === 401) return null

  const data = await parseResponse(response)
  if (!data?.success || !data?.user) {
    throw new Error('Phản hồi phiên đăng nhập không hợp lệ.')
  }
  return data
}

export async function logout() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
  })

  if (response.status === 401) return true
  if (!response.ok) {
    return parseResponse(response)
  }

  return true
}
