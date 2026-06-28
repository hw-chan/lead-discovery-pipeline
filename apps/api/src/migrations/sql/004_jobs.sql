CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY,
  org_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES users(id),
  status TEXT NOT NULL CHECK (status IN ('queued', 'discovering', 'verifying', 'completed', 'failed', 'cancelled')),
  criteria JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_jobs_org_id_status ON jobs (org_id, status);
