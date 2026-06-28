import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Grid,
  LinearProgress,
  Typography,
  Alert,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import InboxIcon from '@mui/icons-material/Inbox'
import RefreshIcon from '@mui/icons-material/Refresh'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { getJob, type JobDetailResponse } from './api'

const TERMINAL_STATUSES = new Set(['completed', 'failed'])
const STEPS = ['queued', 'discovering', 'verifying', 'completed']

function statusColor(status: string): 'default' | 'primary' | 'success' | 'error' | 'warning' {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'verifying':
      return 'primary'
    case 'discovering':
      return 'warning'
    default:
      return 'default'
  }
}

function activeStepIndex(status: string): number {
  if (status === 'failed') return -1
  const index = STEPS.indexOf(status)
  return index === -1 ? 0 : index
}

export function JobProgressView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<JobDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [polling, setPolling] = useState(true)

  useEffect(() => {
    if (!id) return

    let cancelled = false
    let timer: number | undefined

    const load = async () => {
      try {
        const result = await getJob(id)
        if (cancelled) return
        setData(result)
        setError(null)
        if (TERMINAL_STATUSES.has(result.job.status)) {
          setPolling(false)
        }
      } catch (err) {
        if (cancelled) return
        setError((err as Error).message ?? 'Failed to load job')
        setPolling(false)
      }
    }

    const tick = () => {
      void load()
      timer = window.setTimeout(tick, 2000)
    }

    void load()
    if (polling) {
      timer = window.setTimeout(tick, 2000)
    }

    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [id, polling])

  const discovered = data?.leads.filter((l) => l.status === 'discovered').length ?? 0
  const verified = data?.leads.filter((l) => l.status === 'verified').length ?? 0
  const rejected = data?.leads.filter((l) => l.status === 'rejected').length ?? 0

  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/')}
          sx={{ borderRadius: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4" component="h1">
          Job Progress
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!data && !error && <LinearProgress sx={{ borderRadius: 2 }} />}

      {data && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent sx={{ p: 4 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: 2,
                  mb: 3,
                }}
              >
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Status
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
                    <Typography variant="h5" sx={{ textTransform: 'capitalize' }}>
                      {data.job.status}
                    </Typography>
                    <Chip
                      icon={
                        data.job.status === 'completed' ? (
                          <CheckCircleIcon />
                        ) : data.job.status === 'failed' ? (
                          <ErrorIcon />
                        ) : undefined
                      }
                      label={data.job.status}
                      color={statusColor(data.job.status)}
                      size="small"
                    />
                  </Box>
                </Box>

                <Button
                  variant="outlined"
                  startIcon={<RefreshIcon />}
                  onClick={() => {
                    setPolling(true)
                    void getJob(id!).then(setData)
                  }}
                  disabled={TERMINAL_STATUSES.has(data.job.status)}
                  sx={{ borderRadius: 2 }}
                >
                  Refresh
                </Button>
              </Box>

              {data.job.error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {data.job.error}
                </Alert>
              )}

              <Stepper
                activeStep={activeStepIndex(data.job.status)}
                alternativeLabel
                sx={{ mb: 4 }}
              >
                {STEPS.map((label) => (
                  <Step key={label}>
                    <StepLabel sx={{ textTransform: 'capitalize' }}>{label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card variant="outlined" sx={{ bgcolor: 'info.light', border: 'none' }}>
                    <CardContent>
                      <Typography color="info.dark" variant="overline">
                        Discovered
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 800, color: 'info.dark' }}>
                        {discovered}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card variant="outlined" sx={{ bgcolor: 'success.light', border: 'none' }}>
                    <CardContent>
                      <Typography color="success.dark" variant="overline">
                        Verified
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 800, color: 'success.dark' }}>
                        {verified}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card variant="outlined" sx={{ bgcolor: 'error.light', border: 'none' }}>
                    <CardContent>
                      <Typography color="error.dark" variant="overline">
                        Rejected
                      </Typography>
                      <Typography variant="h3" sx={{ fontWeight: 800, color: 'error.dark' }}>
                        {rejected}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<InboxIcon />}
              onClick={() => navigate('/inbox')}
              sx={{ borderRadius: 2 }}
            >
              View Results
            </Button>
            <Button
              variant="outlined"
              onClick={() => navigate('/')}
              sx={{ borderRadius: 2 }}
            >
              New Search
            </Button>
          </Box>
        </>
      )}
    </Container>
  )
}
