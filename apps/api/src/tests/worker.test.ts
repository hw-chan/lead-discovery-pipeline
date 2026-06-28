import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient, QueryResult } from "pg";
import { processJob, type WorkerOptions } from "../worker";
import type { CandidateLead, DiscoverProvider, VerifyProvider } from "../modules/jobs/providers";
import type { JobRow, LeadRow } from "../modules/jobs/types";

const CLAIM_JOB_SQL = `SELECT id, org_id, user_id, status, criteria, error, created_at, updated_at FROM jobs WHERE status IN ('queued', 'discovering', 'verifying') ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`;
const UPDATE_JOB_STATUS_SQL =
  "UPDATE jobs SET status = $1, error = $2, updated_at = now() WHERE id = $3";
const INSERT_LEAD_SQL = `INSERT INTO leads (id, job_id, org_id, name, company, title, email, source_url, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (job_id, email) DO NOTHING`;
const GET_DISCOVERED_LEADS_SQL = `SELECT id, job_id, org_id, name, company, title, email, source_url, status, rejection_reason, score FROM leads WHERE job_id = $1 AND status = 'discovered'`;
const UPDATE_LEAD_STATUS_SQL =
  "UPDATE leads SET status = $1, score = $2, rejection_reason = $3 WHERE id = $4";

function normalize(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\$\d+/g, "$?")
    .trim()
    .toLowerCase();
}

interface MockLead extends LeadRow {}

function createMockPool({
  initialJob,
  discoveredLeads,
}: {
  initialJob: JobRow;
  discoveredLeads: MockLead[];
}): Pool & {
  jobUpdates: Array<{ status: string; error: string | null }>;
  leadInserts: Array<{
    id: string;
    job_id: string;
    org_id: string;
    name: string | null;
    company: string | null;
    title: string | null;
    email: string | null;
    source_url: string | null;
    status: string;
  }>;
  leadUpdates: Array<{
    leadId: string;
    status: string;
    score: number | null;
    rejectionReason: string | null;
  }>;
} {
  const state = {
    jobUpdates: [] as Array<{ status: string; error: string | null }>,
    leadInserts: [] as Array<{
      id: string;
      job_id: string;
      org_id: string;
      name: string | null;
      company: string | null;
      title: string | null;
      email: string | null;
      source_url: string | null;
      status: string;
    }>,
    leadUpdates: [] as Array<{
      leadId: string;
      status: string;
      score: number | null;
      rejectionReason: string | null;
    }>,
  };

  const query = async (
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<Record<string, unknown>>> => {
    const key = normalize(text);

    if (key === normalize(CLAIM_JOB_SQL)) {
      return {
        rows: [initialJob as unknown as Record<string, unknown>],
        rowCount: 1,
      } as unknown as QueryResult<Record<string, unknown>>;
    }

    if (key === normalize(GET_DISCOVERED_LEADS_SQL)) {
      const jobId = params?.[0] as string;
      return {
        rows: discoveredLeads
          .filter((l) => l.job_id === jobId)
          .map((l) => ({ ...l }) as unknown as Record<string, unknown>),
        rowCount: discoveredLeads.length,
      } as unknown as QueryResult<Record<string, unknown>>;
    }

    return { rows: [], rowCount: 0 } as unknown as QueryResult<Record<string, unknown>>;
  };

  const connect = async (): Promise<PoolClient> => {
    const client: Partial<PoolClient> = {
      release: async () => undefined,
    };

    (client as Record<string, unknown>).query = async (
      text: string,
      params?: unknown[],
    ): Promise<QueryResult<Record<string, unknown>>> => {
      const key = normalize(text);

      if (text === "BEGIN" || text === "COMMIT" || text === "ROLLBACK") {
        return { rows: [], rowCount: 0 } as unknown as QueryResult<Record<string, unknown>>;
      }

      if (key === normalize(CLAIM_JOB_SQL)) {
        return {
          rows: [initialJob as unknown as Record<string, unknown>],
          rowCount: 1,
        } as unknown as QueryResult<Record<string, unknown>>;
      }

      if (key === normalize(UPDATE_JOB_STATUS_SQL)) {
        state.jobUpdates.push({
          status: params?.[0] as string,
          error: params?.[1] as string | null,
        });
        return { rows: [], rowCount: 1 } as unknown as QueryResult<Record<string, unknown>>;
      }

      if (key === normalize(INSERT_LEAD_SQL)) {
        state.leadInserts.push({
          id: params?.[0] as string,
          job_id: params?.[1] as string,
          org_id: params?.[2] as string,
          name: params?.[3] as string | null,
          company: params?.[4] as string | null,
          title: params?.[5] as string | null,
          email: params?.[6] as string | null,
          source_url: params?.[7] as string | null,
          status: params?.[8] as string,
        });
        return { rows: [], rowCount: 1 } as unknown as QueryResult<Record<string, unknown>>;
      }

      if (key === normalize(GET_DISCOVERED_LEADS_SQL)) {
        const jobId = params?.[0] as string;
        const rows = discoveredLeads
          .filter((l) => l.job_id === jobId)
          .map((l) => ({ ...l }) as unknown as Record<string, unknown>);
        return { rows, rowCount: rows.length } as unknown as QueryResult<
          Record<string, unknown>
        >;
      }

      if (key === normalize(UPDATE_LEAD_STATUS_SQL)) {
        state.leadUpdates.push({
          status: params?.[0] as string,
          score: params?.[1] as number | null,
          rejectionReason: params?.[2] as string | null,
          leadId: params?.[3] as string,
        });
        return { rows: [], rowCount: 1 } as unknown as QueryResult<Record<string, unknown>>;
      }

      return query(text, params);
    };

    return client as PoolClient;
  };

  return {
    query,
    connect,
    on: () => undefined,
    end: async () => undefined,
    ...state,
  } as unknown as Pool & typeof state;
}

function makeJob(status: JobRow["status"]): JobRow {
  return {
    id: "job-1",
    org_id: "org-1",
    user_id: "user-1",
    status,
    criteria: {
      companies: ["Acme"],
      roles: ["CEO"],
      region: "US",
    },
    error: null,
    created_at: new Date(),
    updated_at: new Date(),
  };
}

const deterministicDiscoverProvider: DiscoverProvider = {
  async discover(): Promise<CandidateLead[]> {
    return [
      {
        name: "Alice Smith",
        company: "Acme",
        title: "CEO",
        email: "alice.smith@acme.com",
      },
      {
        name: "Info Desk",
        company: "Acme",
        title: "Contact",
        email: "info@acme.com",
      },
    ];
  },
};

const deterministicVerifyProvider: VerifyProvider = {
  async verify(candidate: CandidateLead) {
    if (candidate.email === "info@acme.com") {
      return { ok: false, reason: "Generic email" };
    }
    return { ok: true, score: 85 };
  },
};

test("processJob transitions a queued job through discovering, verifying, and completed", async () => {
  const job = makeJob("queued");
  const discoveredLeads: MockLead[] = [
    {
      id: "lead-1",
      job_id: job.id,
      org_id: job.org_id,
      name: "Alice Smith",
      company: "Acme",
      title: "CEO",
      email: "alice.smith@acme.com",
      source_url: null,
      status: "discovered",
      rejection_reason: null,
      score: null,
    },
    {
      id: "lead-2",
      job_id: job.id,
      org_id: job.org_id,
      name: "Info Desk",
      company: "Acme",
      title: "Contact",
      email: "info@acme.com",
      source_url: null,
      status: "discovered",
      rejection_reason: null,
      score: null,
    },
  ];

  const mockPool = createMockPool({ initialJob: job, discoveredLeads });
  const options: WorkerOptions = {
    pool: mockPool,
    discoverProvider: deterministicDiscoverProvider,
    verifyProvider: deterministicVerifyProvider,
  };

  await processJob(options, job);

  const statusSequence = mockPool.jobUpdates.map((u) => u.status);
  assert.deepEqual(statusSequence, [
    "discovering",
    "verifying",
    "completed",
  ]);

  assert.equal(mockPool.leadInserts.length, 2);
  assert.ok(
    mockPool.leadInserts.every((l) => l.status === "discovered"),
    "inserted leads should be in discovered status",
  );

  assert.equal(mockPool.leadUpdates.length, 2);
  const verified = mockPool.leadUpdates.find(
    (u) => u.leadId === "lead-1" && u.status === "verified",
  );
  const rejected = mockPool.leadUpdates.find(
    (u) => u.leadId === "lead-2" && u.status === "rejected",
  );
  assert.ok(verified, "alice should be verified");
  assert.equal(verified?.score, 85);
  assert.ok(rejected, "info@ should be rejected");
  assert.equal(rejected?.rejectionReason, "Generic email");
});

test("processJob inserts leads with ON CONFLICT idempotency clause", async () => {
  const job = makeJob("queued");
  const mockPool = createMockPool({ initialJob: job, discoveredLeads: [] });
  const options: WorkerOptions = {
    pool: mockPool,
    discoverProvider: deterministicDiscoverProvider,
    verifyProvider: deterministicVerifyProvider,
  };

  await processJob(options, job);

  assert.ok(
    mockPool.leadInserts.length > 0,
    "should have attempted to insert leads",
  );
  // The insert was recorded by the client mock; the SQL itself is in repository.ts.
  // We verify the recorded insert carries the expected discovered status.
  assert.ok(
    mockPool.leadInserts.every((l) => l.job_id === job.id),
    "inserts should reference the job",
  );
});

test("processJob sets job status to failed when discovery throws", async () => {
  const job = makeJob("queued");
  const failingDiscoverProvider: DiscoverProvider = {
    async discover(): Promise<CandidateLead[]> {
      throw new Error("discovery service unavailable");
    },
  };

  const mockPool = createMockPool({ initialJob: job, discoveredLeads: [] });
  const options: WorkerOptions = {
    pool: mockPool,
    discoverProvider: failingDiscoverProvider,
    verifyProvider: deterministicVerifyProvider,
  };

  await processJob(options, job);

  const failedUpdate = mockPool.jobUpdates.find((u) => u.status === "failed");
  assert.ok(failedUpdate);
  assert.ok(failedUpdate?.error?.includes("discovery service unavailable"));
});

test("processJob resumes a discovering job by re-running discovery", async () => {
  const job = makeJob("discovering");
  const mockPool = createMockPool({ initialJob: job, discoveredLeads: [] });
  const options: WorkerOptions = {
    pool: mockPool,
    discoverProvider: deterministicDiscoverProvider,
    verifyProvider: deterministicVerifyProvider,
  };

  await processJob(options, job);

  assert.ok(
    mockPool.jobUpdates.some((u) => u.status === "discovering"),
    "should set discovering status",
  );
  assert.ok(
    mockPool.jobUpdates.some((u) => u.status === "verifying"),
    "should set verifying status",
  );
  assert.ok(
    mockPool.jobUpdates.some((u) => u.status === "completed"),
    "should set completed status",
  );
  assert.equal(mockPool.leadInserts.length, 2);
});
