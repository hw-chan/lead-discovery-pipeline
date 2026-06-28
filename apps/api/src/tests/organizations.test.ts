import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcrypt";
import session from "express-session";
import { createApp } from "../server";
import {
  createMockPool,
  initSession,
  login,
  normalizeQueryKey,
  startServer,
  stopServer,
} from "./helpers";

const USER_ID = "u1";
const ORG_ID = "o1";

const LOGIN_SQL = "SELECT id, email, password_hash, org_id FROM users WHERE email = $?";
const GET_ORG_SQL = "SELECT id, name, credits, created_at FROM organizations WHERE id = $1";

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
  orgResult?: import("pg").QueryResult<Record<string, unknown>>,
) {
  const queries: Record<string, import("pg").QueryResult<Record<string, unknown>>> = {
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
  };

  if (orgResult) {
    queries[normalizeQueryKey(GET_ORG_SQL)] = orgResult;
  }

  return createMockPool(queries);
}

test("GET /api/organizations/me returns organization name and credits", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const pool = makeAuthPool(hash, {
    rows: [{ id: ORG_ID, name: "Igo", credits: 8, created_at: new Date() }],
    rowCount: 1,
  } as unknown as import("pg").QueryResult<Record<string, unknown>>);

  const { server, baseUrl, sessionData } = await createAuthenticatedApp(pool);

  try {
    const loginResult = await login(
      baseUrl,
      "admin@igo.com",
      password,
      sessionData,
    );
    assert.equal(loginResult.status, 200);

    const res = await fetch(`${baseUrl}/api/organizations/me`, {
      headers: { cookie: loginResult.cookies },
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { name: string; credits: number };
    assert.equal(body.name, "Igo");
    assert.equal(body.credits, 8);
  } finally {
    await stopServer(server);
  }
});

test("GET /api/organizations/me returns 404 when organization is missing", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const pool = makeAuthPool(hash, {
    rows: [],
    rowCount: 0,
  } as unknown as import("pg").QueryResult<Record<string, unknown>>);

  const { server, baseUrl, sessionData } = await createAuthenticatedApp(pool);

  try {
    const loginResult = await login(
      baseUrl,
      "admin@igo.com",
      password,
      sessionData,
    );
    assert.equal(loginResult.status, 200);

    const res = await fetch(`${baseUrl}/api/organizations/me`, {
      headers: { cookie: loginResult.cookies },
    });

    assert.equal(res.status, 404);
  } finally {
    await stopServer(server);
  }
});

test("GET /api/organizations/me requires authentication", async () => {
  const pool = createMockPool({});
  const { server, baseUrl } = await createAuthenticatedApp(pool);

  try {
    const res = await fetch(`${baseUrl}/api/organizations/me`);
    assert.equal(res.status, 401);
  } finally {
    await stopServer(server);
  }
});
