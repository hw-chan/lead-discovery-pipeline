import { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Chip,
  Container,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Avatar,
} from '@mui/material'
import FilterListIcon from '@mui/icons-material/FilterList'
import VerifiedIcon from '@mui/icons-material/Verified'
import CancelIcon from '@mui/icons-material/Cancel'
import AppsIcon from '@mui/icons-material/Apps'
import { listJobs, getJob, type Lead, type JobListItem } from '../jobs/api'

type Filter = 'all' | 'verified' | 'rejected'

interface LeadWithJob extends Lead {
  job: JobListItem
}

function statusColor(status: string): 'default' | 'success' | 'error' {
  return status === 'verified' ? 'success' : status === 'rejected' ? 'error' : 'default'
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function InboxTable() {
  const [filter, setFilter] = useState<Filter>('all')
  const [leads, setLeads] = useState<LeadWithJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const { jobs } = await listJobs()
        const detailResponses = await Promise.all(
          jobs.map((job) => getJob(job.id).then((res) => ({ job, res }))),
        )
        if (cancelled) return
        const allLeads: LeadWithJob[] = detailResponses.flatMap(({ job, res }) =>
          res.leads.map((lead) => ({ ...lead, job })),
        )
        setLeads(allLeads)
      } catch (err) {
        if (cancelled) return
        setError((err as Error).message ?? 'Failed to load inbox')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const filteredLeads = useMemo(() => {
    if (filter === 'all') return leads
    return leads.filter((lead) => lead.status === filter)
  }, [leads, filter])

  const counts = useMemo(
    () => ({
      all: leads.length,
      verified: leads.filter((l) => l.status === 'verified').length,
      rejected: leads.filter((l) => l.status === 'rejected').length,
    }),
    [leads],
  )

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Inbox
          </Typography>
          <Typography color="text.secondary">
            Verified and rejected leads from all your searches.
          </Typography>
        </Box>

        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(_e, value) => value && setFilter(value as Filter)}
          aria-label="filter leads"
          size="small"
          sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 0.5 }}
        >
          <ToggleButton value="all" sx={{ borderRadius: 2, gap: 1 }}>
            <AppsIcon fontSize="small" />
            All {counts.all}
          </ToggleButton>
          <ToggleButton value="verified" sx={{ borderRadius: 2, gap: 1 }}>
            <VerifiedIcon fontSize="small" />
            Verified {counts.verified}
          </ToggleButton>
          <ToggleButton value="rejected" sx={{ borderRadius: 2, gap: 1 }}>
            <CancelIcon fontSize="small" />
            Rejected {counts.rejected}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Contact</TableCell>
                    <TableCell>Company</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Rejection Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                        <FilterListIcon color="disabled" sx={{ fontSize: 40, mb: 1 }} />
                        <Typography color="text.secondary">
                          No leads match this filter
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => (
                      <TableRow key={lead.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
                              {initials(lead.name)}
                            </Avatar>
                            <Typography sx={{ fontWeight: 600 }}>
                              {lead.name ?? 'Unknown'}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>{lead.company ?? '—'}</TableCell>
                        <TableCell>{lead.title ?? '—'}</TableCell>
                        <TableCell>
                          <Typography
                            component="a"
                            href={lead.email ? `mailto:${lead.email}` : undefined}
                            sx={{ color: 'primary.main', textDecoration: 'none' }}
                          >
                            {lead.email ?? '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            icon={
                              lead.status === 'verified' ? (
                                <VerifiedIcon fontSize="small" />
                              ) : lead.status === 'rejected' ? (
                                <CancelIcon fontSize="small" />
                              ) : undefined
                            }
                            label={lead.status}
                            color={statusColor(lead.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{lead.rejection_reason ?? '—'}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Container>
  )
}
