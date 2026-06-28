import assert from "node:assert/strict";
import test from "node:test";
import http from "node:http";
import bcrypt from "bcrypt";
import session from "express-session";
import type { Express, Request, Response } from "express";
import { createApp } from "../server";

interface MockUser {
  id: string;
  email: string;
  password_hash: string | null;
  org_id: string;
}

function createMockPool(users: MockUser[]) {
  return {
    query: async (text: string, params?: unknown[]) => {
      if (text === "SELECT 1") {
        return { rows: [{ "?column?": 1 }] };
      }
      if (text.includes("FROM users") && text.includes("email")) {
        const email = params?.[0] as string;
        const user = users.find((u) => u.email === email);
        return { rows: user ? [user] : [] };
      }
      return { rows: [] };
    },
  } as unknown as import("pg").Pool;
}

function extractCookies(res: globalThis.Response): string {
  const headers = res.headers as unknown as {
    getSetCookie?: () => string[];
  };
  if (typeof headers.getSetCookie === "function") {
    const cookies = headers.getSetCookie();
    return cookies.map((c) => c.split(";")[0]).join("; ");
  }
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return "";
  return setCookie.split(";")[0];
}

async function startServer(app: Express) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return { server, baseUrl: `http://localhost:${port}` };
}

async function stopServer(server: http.Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

interface SessionData {
  cookies: string;
  csrfToken: string;
}

async function initSession(baseUrl: string): Promise<SessionData> {
  const res = await fetch(`${baseUrl}/api/csrf-token`);
  const body = (await res.json()) as { csrfToken: string };
  return { cookies: extractCookies(res), csrfToken: body.csrfToken };
}

async function login(
  baseUrl: string,
  email: string,
  password: string,
  session: SessionData,
): Promise<{ status: number; cookies: string; body: unknown }> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": session.csrfToken,
      cookie: session.cookies,
    },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json();
  return { status: res.status, cookies: extractCookies(res), body };
}

async function fetchCsrfToken(
  baseUrl: string,
  cookies: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/csrf-token`, {
    headers: { cookie: cookies },
  });
  const body = (await res.json()) as { csrfToken: string };
  return body.csrfToken;
}

test("login succeeds with valid credentials", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const mockPool = createMockPool([
    { id: "u1", email: "admin@igo.com", password_hash: hash, org_id: "o1" },
  ]);
  const store = new session.MemoryStore();
  const app = createApp({
    pool: mockPool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  const { server, baseUrl } = await startServer(app);

  try {
    const sessionData = await initSession(baseUrl);
    const result = await login(baseUrl, "admin@igo.com", password, sessionData);
    assert.equal(result.status, 200);
    const body = result.body as Record<string, string>;
    assert.equal(body.email, "admin@igo.com");
    assert.equal(body.orgId, "o1");
    assert.equal(body.userId, "u1");
    assert.ok(result.cookies.includes("lead.sid="));
  } finally {
    await stopServer(server);
  }
});

test("login fails with unknown email", async () => {
  const mockPool = createMockPool([]);
  const store = new session.MemoryStore();
  const app = createApp({
    pool: mockPool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  const { server, baseUrl } = await startServer(app);

  try {
    const sessionData = await initSession(baseUrl);
    const result = await login(baseUrl, "unknown@igo.com", "any-password", sessionData);
    assert.equal(result.status, 401);
  } finally {
    await stopServer(server);
  }
});

test("login fails with wrong password", async () => {
  const hash = await bcrypt.hash("correct-password", 10);
  const mockPool = createMockPool([
    { id: "u1", email: "admin@igo.com", password_hash: hash, org_id: "o1" },
  ]);
  const store = new session.MemoryStore();
  const app = createApp({
    pool: mockPool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  const { server, baseUrl } = await startServer(app);

  try {
    const sessionData = await initSession(baseUrl);
    const result = await login(baseUrl, "admin@igo.com", "wrong-password", sessionData);
    assert.equal(result.status, 401);
  } finally {
    await stopServer(server);
  }
});

test("login fails when user has no password hash", async () => {
  const mockPool = createMockPool([
    { id: "u1", email: "admin@igo.com", password_hash: null, org_id: "o1" },
  ]);
  const store = new session.MemoryStore();
  const app = createApp({
    pool: mockPool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  const { server, baseUrl } = await startServer(app);

  try {
    const sessionData = await initSession(baseUrl);
    const result = await login(baseUrl, "admin@igo.com", "any-password", sessionData);
    assert.equal(result.status, 401);
  } finally {
    await stopServer(server);
  }
});

test("GET /api/auth/me returns 401 when unauthenticated", async () => {
  const mockPool = createMockPool([]);
  const store = new session.MemoryStore();
  const app = createApp({
    pool: mockPool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  const { server, baseUrl } = await startServer(app);

  try {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
  } finally {
    await stopServer(server);
  }
});

test("GET /api/auth/me returns user when authenticated", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const mockPool = createMockPool([
    { id: "u1", email: "admin@igo.com", password_hash: hash, org_id: "o1" },
  ]);
  const store = new session.MemoryStore();
  const app = createApp({
    pool: mockPool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  const { server, baseUrl } = await startServer(app);

  try {
    const sessionData = await initSession(baseUrl);
    const result = await login(baseUrl, "admin@igo.com", password, sessionData);
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: result.cookies },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, string>;
    assert.equal(body.email, "admin@igo.com");
    assert.equal(body.orgId, "o1");
    assert.equal(body.userId, "u1");
  } finally {
    await stopServer(server);
  }
});

test("POST /api/auth/logout destroys the session", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const mockPool = createMockPool([
    { id: "u1", email: "admin@igo.com", password_hash: hash, org_id: "o1" },
  ]);
  const store = new session.MemoryStore();
  const app = createApp({
    pool: mockPool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  const { server, baseUrl } = await startServer(app);

  try {
    const sessionData = await initSession(baseUrl);
    const result = await login(baseUrl, "admin@igo.com", password, sessionData);
    const csrfToken = await fetchCsrfToken(baseUrl, result.cookies);
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        cookie: result.cookies,
        "X-CSRF-Token": csrfToken,
      },
    });
    assert.equal(logoutRes.status, 200);

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { cookie: result.cookies },
    });
    assert.equal(meRes.status, 401);
  } finally {
    await stopServer(server);
  }
});

test("protected /api route returns 401 when unauthenticated", async () => {
  const mockPool = createMockPool([]);
  const store = new session.MemoryStore();
  const app = createApp({
    pool: mockPool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  app.get("/api/test-protected", (_req: Request, res: Response) => {
    res.json({ reached: true });
  });
  const { server, baseUrl } = await startServer(app);

  try {
    const res = await fetch(`${baseUrl}/api/test-protected`);
    assert.equal(res.status, 401);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.reached, undefined);
  } finally {
    await stopServer(server);
  }
});

test("protected /api route allows authenticated request with orgId", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const mockPool = createMockPool([
    { id: "u1", email: "admin@igo.com", password_hash: hash, org_id: "o1" },
  ]);
  const store = new session.MemoryStore();
  const app = createApp({
    pool: mockPool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  app.get("/api/test-protected", (req: Request, res: Response) => {
    res.json({ orgId: req.orgId });
  });
  const { server, baseUrl } = await startServer(app);

  try {
    const sessionData = await initSession(baseUrl);
    const result = await login(baseUrl, "admin@igo.com", password, sessionData);
    const res = await fetch(`${baseUrl}/api/test-protected`, {
      headers: { cookie: result.cookies },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, string>;
    assert.equal(body.orgId, "o1");
  } finally {
    await stopServer(server);
  }
});

test("session survives app restart", async () => {
  const password = "test-password-123";
  const hash = await bcrypt.hash(password, 10);
  const mockPool = createMockPool([
    { id: "u1", email: "admin@igo.com", password_hash: hash, org_id: "o1" },
  ]);
  const store = new session.MemoryStore();

  const app1 = createApp({
    pool: mockPool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  const { server: server1, baseUrl: baseUrl1 } = await startServer(app1);

  let cookies: string;
  try {
    const sessionData = await initSession(baseUrl1);
    const result = await login(baseUrl1, "admin@igo.com", password, sessionData);
    cookies = result.cookies;
  } finally {
    await stopServer(server1);
  }

  const app2 = createApp({
    pool: mockPool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  const { server: server2, baseUrl: baseUrl2 } = await startServer(app2);

  try {
    const meRes = await fetch(`${baseUrl2}/api/auth/me`, {
      headers: { cookie: cookies },
    });
    assert.equal(meRes.status, 200);
    const body = (await meRes.json()) as Record<string, string>;
    assert.equal(body.email, "admin@igo.com");
  } finally {
    await stopServer(server2);
  }
});

test("/health remains unauthenticated", async () => {
  const mockPool = createMockPool([]);
  const store = new session.MemoryStore();
  const app = createApp({
    pool: mockPool,
    sessionStore: store,
    sessionSecret: "test-secret",
  });
  const { server, baseUrl } = await startServer(app);

  try {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
  } finally {
    await stopServer(server);
  }
});
