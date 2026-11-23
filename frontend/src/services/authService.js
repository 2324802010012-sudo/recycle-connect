import { apiFetch, readApiResponse } from './apiClient'

export const rolePaths = {
  DAN: '/dan',
  THUGOM: '/thugom',
  ADMIN: '/admin',
}

export async function login(username, password) {
  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({ username, password }),
  })

  return readApiResponse(response, { mutation: true })
}

export async function getCurrentUser() {
  const response = await apiFetch('/api/auth/me', {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
  })

  if (response.status === 401) return null

  const data = await readApiResponse(response)
  if (!data?.success || !data?.user) {
    throw new Error('Phản hồi phiên đăng nhập không hợp lệ.')
  }
  return data
}

export async function logout() {
  const response = await apiFetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'same-origin',
  })

  if (response.status === 401) return true
  if (!response.ok) {
    return readApiResponse(response, { mutation: true })
  }

  return true
}

export async function register({ fullName, username, password }) {
  const response = await apiFetch('/api/auth/register', {
    method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName, username, password }),
  })
  return readApiResponse(response, { mutation: true })
}
