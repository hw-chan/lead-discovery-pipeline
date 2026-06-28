import { useState, type FormEvent } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  Link,
} from '@mui/material'
import EmailIcon from '@mui/icons-material/Email'
import LockIcon from '@mui/icons-material/Lock'
import { useAuth } from './useAuth'

export interface RegisterFormProps {
  onSwitchToLogin: () => void
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const { register, error } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await register(email, password, confirmPassword)
    } catch {
      // error is set in context
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        backgroundImage:
          'radial-gradient(circle at 10% 20%, rgb(239 246 255) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgb(243 232 255) 0%, transparent 40%)',
        p: 3,
      }}
    >
      <Container maxWidth="xs">
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography
            variant="h3"
            component="h1"
            sx={{
              fontWeight: 800,
              mb: 1,
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            LeadFlow
          </Typography>
          <Typography color="text.secondary">
            Create an account to get started
          </Typography>
        </Box>

        <Card component="form" onSubmit={handleSubmit}>
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, p: 4 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              helperText="At least 8 characters with a letter and a number"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              label="Confirm Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon color="action" />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={18} /> : null}
              fullWidth
            >
              {submitting ? 'Creating account…' : 'Create account'}
            </Button>
          </CardContent>
        </Card>

        <Typography variant="body2" color="text.secondary" sx={{ display: 'block', mt: 3, textAlign: 'center' }}>
          Already have an account?{' '}
          <Link component="button" type="button" onClick={onSwitchToLogin} underline="hover">
            Sign in
          </Link>
        </Typography>
      </Container>
    </Box>
  )
}
