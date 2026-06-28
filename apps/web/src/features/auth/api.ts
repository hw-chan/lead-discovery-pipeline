export interface AuthUser {
  userId: string
  email: string
  orgId: string
}

let csrfToken: string | null = null

export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/api/csrf-token', { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch CSRF token')
  const data = (await res.json()) as { csrfToken: string }
  csrfToken = data.csrfToken
  return csrfToken
}

function getCsrfToken(): string | null {
  return csrfToken
}

export function clearCsrfToken(): void {
  csrfToken = null
}

async function request(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  }
  const token = getCsrfToken()
  if (token && !['GET', 'HEAD', 'OPTIONS'].includes(options.method ?? 'GET')) {
    headers['X-CSRF-Token'] = token
  }
  return fetch(url, { ...options, headers, credentials: 'include' })
}

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
  if (!res.ok) throw new Error('Login failed')
  return (await res.json()) as AuthUser
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', {
    method: 'POST',
  })
}
