import { createContext } from 'react'
import type { AuthUser } from './api'

export interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, confirmPassword: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthState | undefined>(undefined)
