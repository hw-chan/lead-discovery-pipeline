import type { Pool, PoolClient } from "pg";
import { v4 as uuidv4 } from "uuid";
import type { JobListItem, JobRow, LeadRow } from "./types";

export async function deductCreditAndCreateJob(
  db: Pool,
  orgId: string,
  userId: string,
  criteria: Record<string, unknown>,
): Promise<string | null> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const creditResult = await client.query<{ id: string }>(
      "UPDATE organizations SET credits=credits-1 WHERE id=$1 AND credits>0 RETURNING id",
      [orgId],
    );

    if (creditResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const jobId = uuidv4();
    await client.query(
      "INSERT INTO jobs (id, org_id, user_id, status, criteria) VALUES ($1, $2, $3, $4, $5)",
      [jobId, orgId, userId, "queued", JSON.stringify(criteria)],
    );

    await client.query("COMMIT");
    return jobId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findJobsByOrg(
  db: Pool,
  orgId: string,
): Promise<JobListItem[]> {
  const result = await db.query<JobListItem>(
    `SELECT
       j.id,
       j.org_id,
       j.user_id,
       j.status,
       j.criteria,
       j.error,
       j.created_at,
       j.updated_at,
       COUNT(l.id) FILTER (WHERE l.status = 'discovered') AS discovered_count,
       COUNT(l.id) FILTER (WHERE l.status = 'verified') AS verified_count,
       COUNT(l.id) FILTER (WHERE l.status = 'rejected') AS rejected_count
     FROM jobs j
     LEFT JOIN leads l ON l.job_id = j.id
     WHERE j.org_id = $1
     GROUP BY j.id
     ORDER BY j.created_at DESC`,
    [orgId],
  );
  return result.rows;
}

export async function findJobById(
  db: Pool,
  jobId: string,
): Promise<JobRow | null> {
  const result = await db.query<JobRow>(
    "SELECT id, org_id, user_id, status, criteria, error, created_at, updated_at FROM jobs WHERE id = $1",
    [jobId],
  );
  return (result.rows[0] as JobRow | undefined) ?? null;
}

export async function findLeadsByJobId(
  db: Pool,
  jobId: string,
): Promise<LeadRow[]> {
  const result = await db.query<LeadRow>(
    "SELECT id, job_id, org_id, name, company, title, email, source_url, status, rejection_reason, score FROM leads WHERE job_id = $1",
    [jobId],
  );
  return result.rows;
}
