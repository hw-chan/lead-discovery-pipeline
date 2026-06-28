import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { AuthProvider } from './features/auth/AuthContext'
import { useAuth } from './features/auth/useAuth'
import { LoginForm } from './features/auth/LoginForm'
import { Layout } from './components/Layout'
import { SearchForm } from './features/jobs/SearchForm'
import { JobProgressView } from './features/jobs/JobProgressView'
import { InboxTable } from './features/inbox/InboxTable'
import { theme } from './theme'

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <LoginForm />
  return <>{children}</>
}

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AuthGate>
        <Layout />
      </AuthGate>
    ),
    children: [
      { index: true, element: <SearchForm /> },
      { path: 'jobs/:id', element: <JobProgressView /> },
      { path: 'inbox', element: <InboxTable /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  )
}
