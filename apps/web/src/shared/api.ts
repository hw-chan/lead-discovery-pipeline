let csrfToken: string | null = null

const API_BASE = import.meta.env.VITE_API_URL ?? ''

function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}

export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch(apiUrl('/api/csrf-token'), { credentials: 'include' })
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

export async function request(
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
  return fetch(apiUrl(url), { ...options, headers, credentials: 'include' })
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await request(url)
  if (!res.ok) throw new Error(`Failed to GET ${url}`)
  return (await res.json()) as T
}

export async function apiPost<T>(url: string, body: unknown): Promise<T> {
  const res = await request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Failed to POST ${url}`)
  return (await res.json()) as T
}
