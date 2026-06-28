# Decisions

## Async Jobs Instead Of Synchronous Search

`POST /api/jobs` only creates work. It does not run discovery or verification inline. This keeps the HTTP path fast, makes failures observable through job status, and leaves room for real provider latency, retries, and rate limits.

The worker owns the pipeline:

1. Claim a job.
2. Run discovery and persist `unverified_raw` leads.
3. Run verification in a separate stage.
4. Mark the job `completed` or `failed`.

## Job Statuses

The active statuses are `queued`, `discovering`, and `verifying`. Terminal statuses are `completed`, `failed`, and `cancelled`.

`cancelled` is included in the schema for future API/UI support, but this implementation does not expose cancellation. That keeps the take-home focused on discovery, verification, credits, and tenancy.

## Worker Claiming And Recovery

The worker claims jobs with `FOR UPDATE SKIP LOCKED`. Queued jobs are marked `discovering` while still inside the claim transaction so another worker cannot immediately claim the same job after the lock is released.

Jobs already in `discovering` or `verifying` are only reclaimable after 30 minutes. This is a simple crash recovery policy: a live worker should finish normal provider calls before the timeout, while a crashed worker's job eventually resumes.

## Credits

Credits are deducted with:

```sql
UPDATE organizations
SET credits = credits - 1
WHERE id = $1 AND credits > 0
RETURNING id
```

The credit update and job insert share one transaction. If the insert fails, the deduction rolls back. If two submits race with one remaining credit, only one update can return a row and create a job.

## Multi-Tenancy

The API never trusts `org_id` from the request body. It uses the session's organization for list/detail queries.

Lead access is scoped by both job and organization. Job list counts also join leads with both `job_id` and `org_id`, which prevents mismatched or corrupted lead rows from affecting another tenant's counts.

Worker lead updates include `lead_id`, `job_id`, and `org_id`. The worker currently reads leads through an org-scoped query first, but the update predicate is still tenant-defensive.

## Provider Interfaces

Discovery and verification are interfaces rather than direct mock calls. The mock implementations are deterministic enough for tests and demos, while still resembling production integration points.

The mock discover provider returns 0 to 50 candidates per job. The Marriott Malaysia scenario includes a matching `Director of Sales` candidate and junk emails so the verification stage demonstrates both accepted and rejected leads.

## UI Polling

The UI polls job detail after creation instead of assuming progress locally. This keeps the visible status tied to backend truth. For larger workloads, this could move to server-sent events or WebSockets.

The worker includes a small configurable demo delay after persisting `discovering` and `verifying`. This is intentionally outside the HTTP handler, so discovery and verification remain separate asynchronous stages. Set `WORKER_STAGE_DELAY_MS=0` to disable it.

## Known Follow-Ups

- Add a dedicated paginated inbox endpoint.
- Add cancellation API/UI behavior.
- Add structured JSON logs and provider timing metrics.
- Add idempotency keys if the product requirement becomes "same search click can only create one job" rather than "credits cannot be overspent".
