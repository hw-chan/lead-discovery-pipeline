import assert from "node:assert/strict";
import test from "node:test";
import type { Pool, PoolClient, QueryResult } from "pg";
import { processJob, type WorkerOptions } from "../worker";
import { claimNextJob } from "../modules/jobs/repository";
import type {
  CandidateLead,
  DiscoverProvider,
  VerifyProvider,
} from "../modules/jobs/providers";
import type { JobRow, LeadRow } from "../modules/jobs/types";

const UPDATE_JOB_STATUS_SQL =
  "UPDATE jobs SET status = $1, error = $2, updated_at = now() WHERE id = $3";
const INSERT_LEAD_SQL = `INSERT INTO leads (id, job_id, org_id, name, company, title, email, source_url, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (job_id, email) DO NOTHING`;
const GET_UNVERIFIED_RAW_LEADS_SQL = `SELECT id, job_id, org_id, name, company, title, email, source_url, status, rejection_reason, score FROM leads WHERE job_id = $1 AND org_id = $2 AND status = 'unverified_raw'`;
const UPDATE_LEAD_STATUS_SQL =
  "UPDATE leads SET status = $1, score = $2, rejection_reason = $3 WHERE id = $4 AND job_id = $5 AND org_id = $6";

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\$\d+/g, "$?").trim().toLowerCase();
}

interface MockLead extends LeadRow {}

function createMockPool({
  initialJob,
  unverifiedRawLeads,
}: {
  initialJob: JobRow;
  unverifiedRawLeads: MockLead[];
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
    jobId: string;
    orgId: string;
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
      jobId: string;
      orgId: string;
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

    if (key === normalize(GET_UNVERIFIED_RAW_LEADS_SQL)) {
      const jobId = params?.[0] as string;
      const orgId = params?.[1] as string;
      return {
        rows: unverifiedRawLeads
          .filter((l) => l.job_id === jobId && l.org_id === orgId)
          .map((l) => ({ ...l }) as unknown as Record<string, unknown>),
        rowCount: unverifiedRawLeads.length,
      } as unknown as QueryResult<Record<string, unknown>>;
    }

    return { rows: [], rowCount: 0 } as unknown as QueryResult<
      Record<string, unknown>
    >;
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
        return { rows: [], rowCount: 0 } as unknown as QueryResult<
          Record<string, unknown>
        >;
      }

      if (key === normalize(UPDATE_JOB_STATUS_SQL)) {
        state.jobUpdates.push({
          status: params?.[0] as string,
          error: params?.[1] as string | null,
        });
        return { rows: [], rowCount: 1 } as unknown as QueryResult<
          Record<string, unknown>
        >;
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
        return { rows: [], rowCount: 1 } as unknown as QueryResult<
          Record<string, unknown>
        >;
      }

      if (key === normalize(GET_UNVERIFIED_RAW_LEADS_SQL)) {
        const jobId = params?.[0] as string;
        const orgId = params?.[1] as string;
        const rows = unverifiedRawLeads
          .filter((l) => l.job_id === jobId && l.org_id === orgId)
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
          jobId: params?.[4] as string,
          orgId: params?.[5] as string,
        });
        return { rows: [], rowCount: 1 } as unknown as QueryResult<
          Record<string, unknown>
        >;
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
  const unverifiedRawLeads: MockLead[] = [
    {
      id: "lead-1",
      job_id: job.id,
      org_id: job.org_id,
      name: "Alice Smith",
      company: "Acme",
      title: "CEO",
      email: "alice.smith@acme.com",
      source_url: null,
      status: "unverified_raw",
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
      status: "unverified_raw",
      rejection_reason: null,
      score: null,
    },
  ];

  const mockPool = createMockPool({ initialJob: job, unverifiedRawLeads });
  const options: WorkerOptions = {
    pool: mockPool,
    discoverProvider: deterministicDiscoverProvider,
    verifyProvider: deterministicVerifyProvider,
  };

  await processJob(options, job);

  const statusSequence = mockPool.jobUpdates.map((u) => u.status);
  assert.deepEqual(statusSequence, ["discovering", "verifying", "completed"]);

  assert.equal(mockPool.leadInserts.length, 2);
  assert.ok(
    mockPool.leadInserts.every((l) => l.status === "unverified_raw"),
    "inserted leads should be in unverified_raw status",
  );

  assert.equal(mockPool.leadUpdates.length, 2);
  assert.ok(
    mockPool.leadUpdates.every(
      (u) => u.jobId === job.id && u.orgId === job.org_id,
    ),
    "lead status updates should be scoped to the job and organization",
  );
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
  const mockPool = createMockPool({ initialJob: job, unverifiedRawLeads: [] });
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
  assert.ok(
    mockPool.leadInserts.every((l) => l.job_id === job.id),
    "inserts should reference the job",
  );
});

test("processJob completes successfully when discovery returns no candidates", async () => {
  const job = makeJob("queued");
  const emptyDiscoverProvider: DiscoverProvider = {
    async discover(): Promise<CandidateLead[]> {
      return [];
    },
  };
  const mockPool = createMockPool({ initialJob: job, unverifiedRawLeads: [] });
  const options: WorkerOptions = {
    pool: mockPool,
    discoverProvider: emptyDiscoverProvider,
    verifyProvider: deterministicVerifyProvider,
  };

  await processJob(options, job);

  const statusSequence = mockPool.jobUpdates.map((u) => u.status);
  assert.deepEqual(statusSequence, ["discovering", "verifying", "completed"]);
  assert.equal(mockPool.leadInserts.length, 0);
  assert.equal(mockPool.leadUpdates.length, 0);
});

test("processJob delays after visible discovery and verification statuses", async () => {
  const job = makeJob("queued");
  const delays: Array<{ ms: number; statuses: string[] }> = [];
  const mockPool = createMockPool({ initialJob: job, unverifiedRawLeads: [] });
  const options: WorkerOptions = {
    pool: mockPool,
    discoverProvider: deterministicDiscoverProvider,
    verifyProvider: deterministicVerifyProvider,
    stageDelayMs: 2500,
    delay: async (ms: number) => {
      delays.push({
        ms,
        statuses: mockPool.jobUpdates.map((u) => u.status),
      });
    },
  };

  await processJob(options, job);

  assert.deepEqual(delays, [
    { ms: 2500, statuses: ["discovering"] },
    { ms: 2500, statuses: ["discovering", "verifying"] },
  ]);
  assert.deepEqual(
    mockPool.jobUpdates.map((u) => u.status),
    ["discovering", "verifying", "completed"],
  );
});

test("processJob sets job status to failed when discovery throws", async () => {
  const job = makeJob("queued");
  const failingDiscoverProvider: DiscoverProvider = {
    async discover(): Promise<CandidateLead[]> {
      throw new Error("discovery service unavailable");
    },
  };

  const mockPool = createMockPool({ initialJob: job, unverifiedRawLeads: [] });
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

test("processJob sets job status to failed when verification throws", async () => {
  const job = makeJob("verifying");
  const throwingVerifyProvider: VerifyProvider = {
    async verify(): Promise<never> {
      throw new Error("verification service unavailable");
    },
  };
  const mockPool = createMockPool({
    initialJob: job,
    unverifiedRawLeads: [
      {
        id: "lead-1",
        job_id: job.id,
        org_id: job.org_id,
        name: "Alice Smith",
        company: "Acme",
        title: "CEO",
        email: "alice.smith@acme.com",
        source_url: null,
        status: "unverified_raw",
        rejection_reason: null,
        score: null,
      },
    ],
  });
  const options: WorkerOptions = {
    pool: mockPool,
    discoverProvider: deterministicDiscoverProvider,
    verifyProvider: throwingVerifyProvider,
  };

  await processJob(options, job);

  const failedUpdate = mockPool.jobUpdates.find((u) => u.status === "failed");
  assert.ok(failedUpdate);
  assert.ok(failedUpdate?.error?.includes("verification service unavailable"));
});

test("processJob resumes a discovering job by re-running discovery", async () => {
  const job = makeJob("discovering");
  const mockPool = createMockPool({ initialJob: job, unverifiedRawLeads: [] });
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

test("claimNextJob atomically marks queued jobs as discovering", async () => {
  const job = makeJob("discovering");
  let capturedSql = "";
  const client = {
    async query(text: string): Promise<QueryResult<Record<string, unknown>>> {
      capturedSql = text;
      return {
        rows: [job as unknown as Record<string, unknown>],
        rowCount: 1,
      } as unknown as QueryResult<Record<string, unknown>>;
    },
  } as unknown as PoolClient;

  const claimed = await claimNextJob(client);
  const normalizedSql = normalize(capturedSql);

  assert.equal(claimed?.id, job.id);
  assert.ok(normalizedSql.includes("update jobs"));
  assert.ok(normalizedSql.includes("set status = 'discovering'"));
  assert.ok(normalizedSql.includes("status = 'queued'"));
  assert.ok(normalizedSql.includes("30 minutes"));
  assert.ok(normalizedSql.includes("for update skip locked"));
  assert.ok(normalizedSql.includes("returning"));
});
