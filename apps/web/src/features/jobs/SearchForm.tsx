import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Skeleton,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import BusinessIcon from '@mui/icons-material/Business'
import WorkIcon from '@mui/icons-material/Work'
import LocationOnIcon from '@mui/icons-material/LocationOn'
import { createJob } from './api'
import { fetchOrganization } from '../organization/api'

function splitToArray(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function SearchForm() {
  const navigate = useNavigate()
  const [companies, setCompanies] = useState('')
  const [roles, setRoles] = useState('')
  const [region, setRegion] = useState('')
  const [credits, setCredits] = useState<number | null>(null)
  const [loadingCredits, setLoadingCredits] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchOrganization()
      .then((org) => setCredits(org.credits))
      .catch(() => setError('Failed to load credits'))
      .finally(() => setLoadingCredits(false))
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const companiesArr = splitToArray(companies)
    const rolesArr = splitToArray(roles)

    if (companiesArr.length === 0 || rolesArr.length === 0 || !region.trim()) {
      setError('Please fill in all fields')
      return
    }

    setSubmitting(true)
    try {
      const { job_id } = await createJob({
        companies: companiesArr,
        roles: rolesArr,
        region: region.trim(),
      })
      navigate(`/jobs/${job_id}`)
    } catch (err) {
      const status = (err as Error & { status?: number }).status
      if (status === 402) {
        setError('Insufficient credits')
        if (credits !== null) setCredits(0)
      } else {
        setError((err as Error).message ?? 'Failed to create job')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Container maxWidth="md" sx={{ py: 2 }}>
      <Box sx={{ mb: 5 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          New Search
        </Typography>
        <Typography color="text.secondary">
          Define your target companies, roles, and region to start discovering leads.
        </Typography>
      </Box>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card component="form" onSubmit={handleSubmit}>
            <CardContent sx={{ p: 4 }}>
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}

              <Grid container spacing={3}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Target Companies"
                    placeholder="e.g. Acme Inc, Globex, Stark Industries"
                    value={companies}
                    onChange={(e) => setCompanies(e.target.value)}
                    helperText="Separate multiple companies with commas"
                    required
                    fullWidth
                    slotProps={{
                      input: {
                        startAdornment: (
                          <BusinessIcon color="action" sx={{ mr: 1 }} />
                        ),
                      },
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Roles"
                    placeholder="e.g. CTO, VP Engineering, Head of Sales"
                    value={roles}
                    onChange={(e) => setRoles(e.target.value)}
                    helperText="Separate multiple roles with commas"
                    required
                    fullWidth
                    slotProps={{
                      input: {
                        startAdornment: <WorkIcon color="action" sx={{ mr: 1 }} />,
                      },
                    }}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Region"
                    placeholder="e.g. North America, EMEA"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    required
                    fullWidth
                    slotProps={{
                      input: {
                        startAdornment: (
                          <LocationOnIcon color="action" sx={{ mr: 1 }} />
                        ),
                      },
                    }}
                  />
                </Grid>
              </Grid>

              <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting || loadingCredits}
                  startIcon={
                    submitting ? <CircularProgress size={18} /> : <SearchIcon />
                  }
                >
                  {submitting ? 'Starting…' : 'Start Discovery'}
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              border: 'none',
            }}
          >
            <CardContent sx={{ p: 4 }}>
              <Typography variant="overline" sx={{ opacity: 0.8 }}>
                Available Credits
              </Typography>
              <Typography variant="h2" sx={{ my: 1, fontWeight: 800 }}>
                {loadingCredits || credits === null ? (
                  <Skeleton width={80} height={60} sx={{ bgcolor: 'rgba(255,255,255,0.2)' }} />
                ) : (
                  credits
                )}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Each new search consumes 1 credit.
              </Typography>
            </CardContent>
          </Card>


        </Grid>
      </Grid>
    </Container>
  )
}
