
async function parseResponse(response) {
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
      data?.message ||
      'Không thể xử lý yêu cầu.'
    )
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

  return parseResponse(response)
}

export async function logout() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    return parseResponse(response)
  }

  return true
}
