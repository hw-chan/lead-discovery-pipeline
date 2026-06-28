export interface JobRow {
  id: string;
  org_id: string;
  user_id: string;
  status: string;
  criteria: Record<string, unknown>;
  error: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface LeadRow {
  id: string;
  job_id: string;
  org_id: string;
  name: string | null;
  company: string | null;
  title: string | null;
  email: string | null;
  source_url: string | null;
  status: string;
  rejection_reason: string | null;
  score: number | null;
}

export interface JobListItem extends JobRow {
  unverified_raw_count: number;
  verified_count: number;
  rejected_count: number;
}
