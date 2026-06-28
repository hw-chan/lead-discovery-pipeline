import http from "node:http";
import type { Express } from "express";
import type { Pool, PoolClient, QueryResult } from "pg";

export interface SessionData {
  cookies: string;
  csrfToken: string;
}

export function extractCookies(res: globalThis.Response): string {
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

export async function startServer(app: Express) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return { server, baseUrl: `http://localhost:${port}` };
}

export async function stopServer(server: http.Server) {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

export async function initSession(baseUrl: string): Promise<SessionData> {
  const res = await fetch(`${baseUrl}/api/csrf-token`);
  const body = (await res.json()) as { csrfToken: string };
  return { cookies: extractCookies(res), csrfToken: body.csrfToken };
}

export async function fetchCsrfToken(
  baseUrl: string,
  cookies: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/api/csrf-token`, {
    headers: { cookie: cookies },
  });
  const body = (await res.json()) as { csrfToken: string };
  return body.csrfToken;
}

export async function login(
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

type QueryHandler =
  | QueryResult<Record<string, unknown>>
  | ((text: string, params?: unknown[]) => QueryResult<Record<string, unknown>>);

export function createMockPool(
  queries: Record<string, QueryHandler>,
  clientBehavior?: {
    beginError?: Error;
    commitError?: Error;
    queries?: Record<string, QueryHandler>;
    releaseError?: Error;
  },
): Pool {
  const runHandler = (handler: QueryHandler, text: string, params?: unknown[]) =>
    typeof handler === "function" ? handler(text, params) : handler;

  const query = async (
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<Record<string, unknown>>> => {
    const key = normalizeQueryKey(text);
    if (Object.prototype.hasOwnProperty.call(queries, key)) {
      return withRowCount(runHandler(queries[key], text, params));
    }
    if (text === "SELECT 1") return withRowCount({ rows: [{ "?column?": 1 }] } as unknown as QueryResult<Record<string, unknown>>);
    return withRowCount({ rows: [] } as unknown as QueryResult<Record<string, unknown>>);
  };

  const connect = async (): Promise<PoolClient> => {
    const client: Partial<PoolClient> = {
      release: async (): Promise<void> => {
        if (clientBehavior?.releaseError) throw clientBehavior.releaseError;
      },
    };

    (client as Record<string, unknown>).query = async (
      text: string,
      params?: unknown[],
    ): Promise<QueryResult<Record<string, unknown>>> => {
      const key = normalizeQueryKey(text);
      const clientQueries = clientBehavior?.queries ?? {};
      if (text === "BEGIN") {
        if (clientBehavior?.beginError) throw clientBehavior.beginError;
        return withRowCount({ rows: [] } as unknown as QueryResult<Record<string, unknown>>);
      }
      if (text === "COMMIT") {
        if (clientBehavior?.commitError) throw clientBehavior.commitError;
        return withRowCount({ rows: [] } as unknown as QueryResult<Record<string, unknown>>);
      }
      if (text === "ROLLBACK") {
        return withRowCount({ rows: [] } as unknown as QueryResult<Record<string, unknown>>);
      }
      if (Object.prototype.hasOwnProperty.call(clientQueries, key)) {
        return withRowCount(runHandler(clientQueries[key], text, params));
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
  } as unknown as Pool;
}

function withRowCount(
  result: QueryResult<Record<string, unknown>>,
): QueryResult<Record<string, unknown>> {
  if (typeof result.rowCount !== "number") {
    result.rowCount = result.rows.length;
  }
  return result;
}

export function normalizeQueryKey(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\$\d+/g, "$?")
    .trim()
    .toLowerCase();
}
