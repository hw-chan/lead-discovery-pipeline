CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES jobs(id),
  org_id UUID REFERENCES organizations(id),
  name TEXT,
  company TEXT,
  title TEXT,
  email TEXT,
  source_url TEXT,
  status TEXT NOT NULL,
  rejection_reason TEXT,
  score INTEGER,
  CONSTRAINT leads_job_id_email_unique UNIQUE (job_id, email),
  CONSTRAINT score_range CHECK (score IS NULL OR (score >= 0 AND score <= 100))
);
