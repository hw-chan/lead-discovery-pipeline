import "dotenv/config";
import type { Pool, PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import pool from "./shared/db";
import {
  createMockDiscoverProvider,
  createMockVerifyProvider,
} from "./modules/jobs/providers";
import type {
  CandidateLead,
  DiscoverProvider,
  SearchRequest,
  VerifyProvider,
} from "./modules/jobs/providers";
import type { JobRow } from "./modules/jobs/types";
import {
  claimNextJob,
  getDiscoveredLeadsByJobId,
  insertLead,
  updateJobStatus,
  updateLeadStatus,
} from "./modules/jobs/repository";

export interface WorkerOptions {
  pool: Pool;
  discoverProvider: DiscoverProvider;
  verifyProvider: VerifyProvider;
  pollIntervalMs?: number;
}

export interface Worker {
  start(): void;
  stop(): Promise<void>;
}

const DEFAULT_POLL_INTERVAL_MS = 2000;

function buildSearchRequest(job: JobRow): SearchRequest {
  const criteria = job.criteria ?? {};
  return {
    jobId: job.id,
    companies: Array.isArray(criteria.companies) ? criteria.companies : [],
    roles: Array.isArray(criteria.roles) ? criteria.roles : [],
    region: typeof criteria.region === "string" ? criteria.region : "",
  };
}

async function withTransaction<T>(
  db: Pool,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function setJobStatus(
  db: Pool,
  jobId: string,
  status: string,
  error?: string | null,
): Promise<void> {
  await withTransaction(db, (client) =>
    updateJobStatus(client, jobId, status, error),
  );
}

async function insertCandidates(
  client: PoolClient,
  job: JobRow,
  candidates: CandidateLead[],
): Promise<void> {
  for (const candidate of candidates) {
    await insertLead(client, {
      id: uuidv4(),
      job_id: job.id,
      org_id: job.org_id,
      name: candidate.name,
      company: candidate.company,
      title: candidate.title,
      email: candidate.email,
      source_url: candidate.source_url ?? null,
      status: "discovered",
    });
  }
}

async function runDiscoverStage(
  options: WorkerOptions,
  job: JobRow,
): Promise<void> {
  // Persist the discovering status before doing I/O so a crash resumes here
  // and idempotent inserts prevent duplicate leads.
  await setJobStatus(options.pool, job.id, "discovering");

  const request = buildSearchRequest(job);
  const candidates = await options.discoverProvider.discover(request);

  await withTransaction(options.pool, async (client) => {
    await insertCandidates(client, job, candidates);
    await updateJobStatus(client, job.id, "verifying");
  });
}

async function runVerifyStage(
  options: WorkerOptions,
  job: JobRow,
): Promise<void> {
  await withTransaction(options.pool, async (client) => {
    const leads = await getDiscoveredLeadsByJobId(client, job.id);

    for (const lead of leads) {
      const result = await options.verifyProvider.verify(lead);
      if (result.ok) {
        await updateLeadStatus(
          client,
          lead.id,
          "verified",
          result.score ?? null,
          null,
        );
      } else {
        await updateLeadStatus(
          client,
          lead.id,
          "rejected",
          null,
          result.reason ?? null,
        );
      }
    }

    await updateJobStatus(client, job.id, "completed");
  });
}

export async function processJob(
  options: WorkerOptions,
  job: JobRow,
): Promise<void> {
  try {
    if (job.status === "queued" || job.status === "discovering") {
      await runDiscoverStage(options, job);
    }

    await runVerifyStage(options, job);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setJobStatus(options.pool, job.id, "failed", message);
  }
}

async function claimJob(options: WorkerOptions): Promise<JobRow | null> {
  return withTransaction(options.pool, (client) => claimNextJob(client));
}

export function createWorker(options: WorkerOptions): Worker {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  let running = false;
  let timeout: NodeJS.Timeout | null = null;
  let currentPromise: Promise<void> | null = null;

  async function poll(): Promise<void> {
    if (!running) return;

    try {
      const job = await claimJob(options);
      if (job) {
        currentPromise = processJob(options, job);
        await currentPromise;
      }
    } catch (error) {
      console.error("Worker poll error:", error);
    } finally {
      currentPromise = null;
      if (running) {
        timeout = setTimeout(() => {
          void poll();
        }, pollIntervalMs);
      }
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      void poll();
    },

    async stop() {
      running = false;
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      if (currentPromise) {
        await currentPromise;
      }
    },
  };
}

export function createDefaultWorker(): Worker {
  return createWorker({
    pool,
    discoverProvider: createMockDiscoverProvider(),
    verifyProvider: createMockVerifyProvider(),
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
  });
}

if (require.main === module) {
  const worker = createDefaultWorker();
  worker.start();

  process.on("SIGINT", async () => {
    console.log("\nShutting down worker...");
    await worker.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await worker.stop();
    process.exit(0);
  });
}
