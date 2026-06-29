# Lead Discovery Pipeline

Async lead discovery take-home with a React inbox, Express API, Postgres storage, and a worker that runs discovery and verification outside the HTTP request path.

## Stack

- **Frontend**: React + TypeScript, built with Vite and styled with Material UI.
- **Backend API**: Express + TypeScript
- **Database**: PostgreSQL for jobs, leads, users, organizations, and credits.
- **Background worker**: A separate TypeScript process that discovers candidate leads and verifies their emails. Providers are swappable, so mock implementations can be replaced with real services later.
- **Tests**: Node's built-in test runner, with `ts-node/register` to run TypeScript tests directly.

## Local Run

1. Install dependencies:

```bash
npm install
```

2. Configure the API environment:

```bash
copy apps\api\.env.example apps\api\.env
```

Set these values in `apps/api/.env`:

```bash
DATABASE_URL=postgres://postgres:your_password_here@localhost:5432/lead_discovery
SEED_ADMIN_PASSWORD=replace_with_a_real_local_password
SESSION_SECRET=replace_with_a_random_local_secret
WORKER_STAGE_DELAY_MS=2500
ALLOWED_ORIGINS=http://localhost:5173
```

`WORKER_STAGE_DELAY_MS` controls the demo pause after `discovering` and `verifying` are persisted. Use `0` to disable the pause.

`ALLOWED_ORIGINS` configures CORS for the frontend. For deployed environments, set it to your frontend URL (e.g., `https://your-frontend.onrender.com`).

3. Run migrations and seed demo organizations/users:

```bash
npm run migrate
npm run seed
```

Seeded logins use the password from `SEED_ADMIN_PASSWORD`:

- `admin@igo.com`
- `admin@ego.com`

4. Start the API and web app:

```bash
npm run dev
```

5. Start the worker in a separate terminal:

```bash
npm run worker
```

`npm run dev` starts only API and web. The separate worker process is required for jobs to leave `queued` and progress through discovery and verification.

## Verification

```bash
npm test
npm run build
```

The API tests cover authentication, organization isolation, credit deduction, job creation, provider behavior, and worker stage transitions.

## Pipeline Behavior

- `POST /api/jobs` validates the search, atomically deducts one organization credit, inserts a `queued` job, and returns `job_id`.
- The worker claims jobs separately from the HTTP handler.
- Discovery writes candidates as `unverified_raw` leads and moves the job to `verifying`.
- Verification updates each lead to `verified` or `rejected` and then marks the job `completed`.
- The worker adds a configurable demo pause after `discovering` and `verifying` so the UI can show each stage while polling.
- If discovery returns zero candidates, the job still reaches `completed` with an empty inbox.
- If discovery or verification throws, the worker marks the job `failed` and stores the error for the UI.

## Mock Providers

Providers are defined by interfaces so real SERP/email services can replace the mocks later:

- `DiscoverProvider.discover(input)` returns `CandidateLead[]`.
- `VerifyProvider.verify(candidate)` returns `{ ok, reason?, score? }`.

The mock discovery provider is deterministic by `jobId` and returns 0 to 50 candidates. The Marriott Malaysia demo includes a matching `Director of Sales` lead plus junk emails such as `info@` so verification has rejected rows to show.

## Multi-Tenancy And Credits

- API reads use the authenticated session's `orgId`.
- Job detail and lead queries require both `job_id` and `org_id`.
- Job list lead counts join on both `job_id` and `org_id` to avoid counting mismatched tenant rows.
- Worker lead status updates include `lead_id`, `job_id`, and `org_id`.
- Credit deduction and job creation happen in one DB transaction with `credits > 0`, so concurrent submits cannot drive credits negative. A second submit with no remaining credit returns `402`.

## Trade-Offs

- The worker uses Postgres row locking and marks queued jobs as `discovering` while claiming them. Stale `discovering` and `verifying` jobs are reclaimable after 30 minutes to recover from worker crashes while avoiding duplicate work for normal provider latency.
- Cancellation is represented in the database status enum but has no API/UI action yet.
- The inbox uses existing job detail APIs instead of a dedicated paginated inbox endpoint. That is acceptable for the demo dataset but should become a server-side inbox endpoint for larger volumes.
- Mock verification uses simple local-part rules and pseudo-random scores. A production verifier should use deterministic scoring, richer bounce/risk signals, and rate-limited provider clients.
- Runtime logging is intentionally lightweight for the take-home. Production should add structured logs with job IDs, org IDs, provider timing, and retry metadata.

See `DECISIONS.md` for more design rationale.
