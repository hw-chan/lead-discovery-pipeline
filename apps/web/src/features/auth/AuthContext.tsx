import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { fetchMe, fetchCsrfToken, clearCsrfToken, login as apiLogin, logout as apiLogout } from './api'
import { AuthContext, type AuthState } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState['user']>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCsrfToken()
      .then(() => fetchMe())
      .then(setUser)
      .catch(() => setError('Failed to restore session'))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setError(null)
    try {
      const u = await apiLogin(email, password)
      setUser(u)
      clearCsrfToken()
      await fetchCsrfToken()
    } catch (err) {
      setError((err as Error).message ?? 'Invalid email or password')
      throw err
    }
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
    clearCsrfToken()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
