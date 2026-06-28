import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcrypt";
import session from "express-session";
import { createApp } from "../server";
import {
  createMockPool,
  extractCookies,
  initSession,
  login,
  normalizeQueryKey,
  startServer,
  stopServer,
} from "./helpers";

const USER_ID = "u1";
const ORG_ID = "o1";
const OTHER_ORG_ID = "o2";
const JOB_ID = "j1";
const OTHER_JOB_ID = "j2";

const LOGIN_SQL = "SELECT id, email, password_hash, org_id FROM users WHERE email = $?";
const UPDATE_CREDITS_SQL = "UPDATE organizations SET credits=credits-1 WHERE id=$1 AND credits>0 RETURNING id";
const INSERT_JOB_SQL = "INSERT INTO jobs (id, org_id, user_id, status, criteria) VALUES ($1, $2, $3, $4, $5)";
const LIST_JOBS_SQL = `SELECT j.id, j.org_id, j.user_id, j.status, j.criteria, j.error, j.created_at, j.updated_at, COUNT(l.id) FILTER (WHERE l.status = 'discovered') AS discovered_count, COUNT(l.id) FILTER (WHERE l.status = 'verified') AS verified_count, COUNT(l.id) FILTER (WHERE l.status = 'rejected') AS rejected_count FROM jobs j LEFT JOIN leads l ON l.job_id = j.id WHERE j.org_id = $1 GROUP BY j.id ORDER BY j.created_at DESC`;
const GET_JOB_SQL = "SELECT id, org_id, user_id, status, criteria, error, created_at, updated_at FROM jobs WHERE id = $1";
const GET_LEADS_SQL = "SELECT id, job_id, org_id, name, company, title, email, source_url, status, rejection_reason, score FROM leads WHERE job_id = $1";

async function createAuthenticatedApp(
  pool: ReturnType<typeof createMockPool>,
) {
  const store = new session.MemoryStore();
  const app = createApp({
    pool: pool as unknown as import("pg").Pool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  const { server, baseUrl } = await startServer(app);
  const sessionData = await initSession(baseUrl);
  return { app, server, baseUrl, sessionData };
}

function makeAuthPool(
  passwordHash: string | null,
  clientBehavior?: Parameters<typeof createMockPool>[1],
) {
  return createMockPool(
    {
      [normalizeQueryKey(LOGIN_SQL)]: {
        rows: [
          {
            id: USER_ID,
            email: "admin@igo.com",
            password_hash: passwordHash,
            org_id: ORG_ID,
          },
        ],
      } as unknown as import("pg").QueryResult<Record<string, unknown>>,
    },
    clientBehavior,
  );
}

test("POST /api/jobs creates a queued job and deducts a credit", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const pool = makeAuthPool(hash, {
    queries: {
      [normalizeQueryKey(UPDATE_CREDITS_SQL)]: {
        rows: [{ id: ORG_ID }],
        rowCount: 1,
      } as unknown as import("pg").QueryResult<Record<string, unknown>>,
      [normalizeQueryKey(INSERT_JOB_SQL)]: {
        rows: [],
        rowCount: 1,
      } as unknown as import("pg").QueryResult<Record<string, unknown>>,
    },
  });

  const { server, baseUrl, sessionData } = await createAuthenticatedApp(pool);

  try {
    const loginResult = await login(
      baseUrl,
      "admin@igo.com",
      password,
      sessionData,
    );
    assert.equal(loginResult.status, 200);

    const csrfToken = await fetchCsrfToken(baseUrl, loginResult.cookies);

    const res = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
        cookie: loginResult.cookies,
      },
      body: JSON.stringify({
        companies: ["Igo"],
        roles: ["CEO"],
        region: "US",
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { job_id: string };
    assert.ok(body.job_id);
  } finally {
    await stopServer(server);
  }
});

test("POST /api/jobs returns 402 when organization has no credits", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const pool = makeAuthPool(hash, {
    queries: {
      [normalizeQueryKey(UPDATE_CREDITS_SQL)]: {
        rows: [],
        rowCount: 0,
      } as unknown as import("pg").QueryResult<Record<string, unknown>>,
    },
  });

  const { server, baseUrl, sessionData } = await createAuthenticatedApp(pool);

  try {
    const loginResult = await login(
      baseUrl,
      "admin@igo.com",
      password,
      sessionData,
    );
    assert.equal(loginResult.status, 200);

    const csrfToken = await fetchCsrfToken(baseUrl, loginResult.cookies);

    const res = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
        cookie: loginResult.cookies,
      },
      body: JSON.stringify({
        companies: ["Igo"],
        roles: ["CEO"],
        region: "US",
      }),
    });

    assert.equal(res.status, 402);
  } finally {
    await stopServer(server);
  }
});

test("POST /api/jobs returns 400 for invalid body", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const pool = makeAuthPool(hash);

  const { server, baseUrl, sessionData } = await createAuthenticatedApp(pool);

  try {
    const loginResult = await login(
      baseUrl,
      "admin@igo.com",
      password,
      sessionData,
    );
    assert.equal(loginResult.status, 200);

    const csrfToken = await fetchCsrfToken(baseUrl, loginResult.cookies);

    const res = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
        cookie: loginResult.cookies,
      },
      body: JSON.stringify({ companies: [], roles: ["CEO"], region: "US" }),
    });

    assert.equal(res.status, 400);
  } finally {
    await stopServer(server);
  }
});

test("POST /api/jobs rolls back credit deduction when job insert fails", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);

  let rollbackCalled = false;
  const pool = makeAuthPool(hash, {
    queries: {
      [normalizeQueryKey(UPDATE_CREDITS_SQL)]: {
        rows: [{ id: ORG_ID }],
        rowCount: 1,
      } as unknown as import("pg").QueryResult<Record<string, unknown>>,
      [normalizeQueryKey(INSERT_JOB_SQL)]: () => {
        throw new Error("insert failed");
      },
      rollback: {
        rows: [],
        rowCount: 0,
      } as unknown as import("pg").QueryResult<Record<string, unknown>>,
    },
  });

  const originalConnect = pool.connect.bind(pool);
  (pool as any).connect = async () => {
    const client = await originalConnect();
    const originalQuery = client.query.bind(client);
    (client as any).query = async (text: string, params?: unknown[]) => {
      if (text === "ROLLBACK") rollbackCalled = true;
      return originalQuery(text, params);
    };
    return client;
  };

  const { server, baseUrl, sessionData } = await createAuthenticatedApp(pool);

  try {
    const loginResult = await login(
      baseUrl,
      "admin@igo.com",
      password,
      sessionData,
    );
    assert.equal(loginResult.status, 200);

    const csrfToken = await fetchCsrfToken(baseUrl, loginResult.cookies);

    const res = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
        cookie: loginResult.cookies,
      },
      body: JSON.stringify({
        companies: ["Igo"],
        roles: ["CEO"],
        region: "US",
      }),
    });

    assert.equal(res.status, 500);
    assert.equal(rollbackCalled, true);
  } finally {
    await stopServer(server);
  }
});

test("GET /api/jobs returns only current organization jobs with lead counts", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const pool = makeAuthPool(hash);

  const originalQuery = (pool as any).query.bind(pool);
  (pool as any).query = async (text: string, params?: unknown[]) => {
    const key = normalizeQueryKey(text);
    if (key === normalizeQueryKey(LIST_JOBS_SQL)) {
      assert.equal(params?.[0], ORG_ID);
      return {
        rows: [
          {
            id: JOB_ID,
            org_id: ORG_ID,
            user_id: USER_ID,
            status: "queued",
            criteria: {},
            error: null,
            created_at: new Date(),
            updated_at: new Date(),
            discovered_count: 3,
            verified_count: 2,
            rejected_count: 1,
          },
        ],
        rowCount: 1,
      } as unknown as import("pg").QueryResult<Record<string, unknown>>;
    }
    return originalQuery(text, params);
  };

  const { server, baseUrl, sessionData } = await createAuthenticatedApp(pool);

  try {
    const loginResult = await login(
      baseUrl,
      "admin@igo.com",
      password,
      sessionData,
    );
    assert.equal(loginResult.status, 200);

    const res = await fetch(`${baseUrl}/api/jobs`, {
      headers: { cookie: loginResult.cookies },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      jobs: Array<{
        id: string;
        discovered_count: number;
        verified_count: number;
        rejected_count: number;
      }>;
    };
    assert.equal(body.jobs.length, 1);
    assert.equal(body.jobs[0].id, JOB_ID);
    assert.equal(body.jobs[0].discovered_count, 3);
    assert.equal(body.jobs[0].verified_count, 2);
    assert.equal(body.jobs[0].rejected_count, 1);
  } finally {
    await stopServer(server);
  }
});

test("GET /api/jobs/:id returns job and leads for owned job", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const pool = makeAuthPool(hash);

  const originalQuery = (pool as any).query.bind(pool);
  (pool as any).query = async (text: string, params?: unknown[]) => {
    const key = normalizeQueryKey(text);
    if (key === normalizeQueryKey(GET_JOB_SQL)) {
      return {
        rows: [
          {
            id: JOB_ID,
            org_id: ORG_ID,
            user_id: USER_ID,
            status: "queued",
            criteria: {},
            error: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      } as unknown as import("pg").QueryResult<Record<string, unknown>>;
    }
    if (key === normalizeQueryKey(GET_LEADS_SQL)) {
      assert.equal(params?.[0], JOB_ID);
      return {
        rows: [
          {
            id: "l1",
            job_id: JOB_ID,
            org_id: ORG_ID,
            name: "Alice",
            company: "Igo",
            title: "CEO",
            email: "alice@igo.com",
            source_url: null,
            status: "discovered",
            rejection_reason: null,
            score: null,
          },
        ],
        rowCount: 1,
      } as unknown as import("pg").QueryResult<Record<string, unknown>>;
    }
    return originalQuery(text, params);
  };

  const { server, baseUrl, sessionData } = await createAuthenticatedApp(pool);

  try {
    const loginResult = await login(
      baseUrl,
      "admin@igo.com",
      password,
      sessionData,
    );
    assert.equal(loginResult.status, 200);

    const res = await fetch(`${baseUrl}/api/jobs/${JOB_ID}`, {
      headers: { cookie: loginResult.cookies },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      job: { id: string; org_id: string };
      leads: Array<{ id: string }>;
    };
    assert.equal(body.job.id, JOB_ID);
    assert.equal(body.job.org_id, ORG_ID);
    assert.equal(body.leads.length, 1);
    assert.equal(body.leads[0].id, "l1");
  } finally {
    await stopServer(server);
  }
});

test("GET /api/jobs/:id returns 403 for cross-tenant job", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const pool = makeAuthPool(hash);

  const originalQuery = (pool as any).query.bind(pool);
  (pool as any).query = async (text: string) => {
    const key = normalizeQueryKey(text);
    if (key === normalizeQueryKey(GET_JOB_SQL)) {
      return {
        rows: [
          {
            id: OTHER_JOB_ID,
            org_id: OTHER_ORG_ID,
            user_id: "u2",
            status: "queued",
            criteria: {},
            error: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        rowCount: 1,
      } as unknown as import("pg").QueryResult<Record<string, unknown>>;
    }
    return originalQuery(text);
  };

  const { server, baseUrl, sessionData } = await createAuthenticatedApp(pool);

  try {
    const loginResult = await login(
      baseUrl,
      "admin@igo.com",
      password,
      sessionData,
    );
    assert.equal(loginResult.status, 200);

    const res = await fetch(`${baseUrl}/api/jobs/${OTHER_JOB_ID}`, {
      headers: { cookie: loginResult.cookies },
    });

    assert.equal(res.status, 403);
  } finally {
    await stopServer(server);
  }
});

test("GET /api/jobs/:id returns 404 for unknown job", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const pool = makeAuthPool(hash);

  const { server, baseUrl, sessionData } = await createAuthenticatedApp(pool);

  try {
    const loginResult = await login(
      baseUrl,
      "admin@igo.com",
      password,
      sessionData,
    );
    assert.equal(loginResult.status, 200);

    const res = await fetch(`${baseUrl}/api/jobs/unknown-job-id`, {
      headers: { cookie: loginResult.cookies },
    });

    assert.equal(res.status, 404);
  } finally {
    await stopServer(server);
  }
});

test("job endpoints require authentication", async () => {
  const pool = createMockPool({});
  const { server, baseUrl } = await createAuthenticatedApp(pool);

  try {
    const sessionData = await initSession(baseUrl);

    const postRes = await fetch(`${baseUrl}/api/jobs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": sessionData.csrfToken,
        cookie: sessionData.cookies,
      },
      body: JSON.stringify({ companies: ["Igo"], roles: ["CEO"], region: "US" }),
    });
    assert.equal(postRes.status, 401);

    const listRes = await fetch(`${baseUrl}/api/jobs`);
    assert.equal(listRes.status, 401);

    const getRes = await fetch(`${baseUrl}/api/jobs/${JOB_ID}`);
    assert.equal(getRes.status, 401);
  } finally {
    await stopServer(server);
  }
});

async function fetchCsrfToken(baseUrl: string, cookies: string): Promise<string> {
  const res = await fetch(`${baseUrl}/api/csrf-token`, {
    headers: { cookie: cookies },
  });
  const body = (await res.json()) as { csrfToken: string };
  return body.csrfToken;
}
