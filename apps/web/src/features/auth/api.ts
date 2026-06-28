import { request, fetchCsrfToken, clearCsrfToken } from '../../shared/api'

export interface AuthUser {
  userId: string
  email: string
  orgId: string
}

export { fetchCsrfToken, clearCsrfToken }

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await request('/api/auth/me')
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Failed to fetch user')
  return (await res.json()) as AuthUser
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? 'Login failed')
  }
  return (await res.json()) as AuthUser
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', {
    method: 'POST',
  })
}
