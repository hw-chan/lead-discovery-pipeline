import { request } from '../../shared/api'

export interface Job {
  id: string
  org_id: string
  user_id: string
  status: string
  criteria: Record<string, unknown>
  error: string | null
  created_at: string
  updated_at: string
}

export interface JobListItem extends Job {
  unverified_raw_count: number
  verified_count: number
  rejected_count: number
}

export interface Lead {
  id: string
  job_id: string
  org_id: string
  name: string | null
  company: string | null
  title: string | null
  email: string | null
  source_url: string | null
  status: string
  rejection_reason: string | null
  score: number | null
}

export interface CreateJobInput {
  companies: string[]
  roles: string[]
  region: string
}

export interface CreateJobResponse {
  job_id: string
}

export interface JobListResponse {
  jobs: JobListItem[]
}

export interface JobDetailResponse {
  job: Job
  leads: Lead[]
}

export async function createJob(input: CreateJobInput): Promise<CreateJobResponse> {
  const res = await request('/api/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (res.status === 402) {
    const error = new Error('Insufficient credits')
    ;(error as Error & { status: number }).status = 402
    throw error
  }
  if (!res.ok) throw new Error('Failed to create job')
  return (await res.json()) as CreateJobResponse
}

export async function listJobs(): Promise<JobListResponse> {
  const res = await request('/api/jobs')
  if (!res.ok) throw new Error('Failed to list jobs')
  return (await res.json()) as JobListResponse
}

export async function getJob(id: string): Promise<JobDetailResponse> {
  const res = await request(`/api/jobs/${id}`)
  if (!res.ok) throw new Error('Failed to get job')
  return (await res.json()) as JobDetailResponse
}
