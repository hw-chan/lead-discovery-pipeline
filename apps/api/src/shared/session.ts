import session from "express-session";
import type { RequestHandler } from "express";

const DEFAULT_LOCAL_SECRET = "local-dev-session-secret";

function resolveSessionSecret(override?: string): string {
  const secret = override ?? process.env.SESSION_SECRET;

  if (secret && secret.trim().length > 0) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to a non-empty value in production.",
    );
  }

  return DEFAULT_LOCAL_SECRET;
}

function hasNonLocalOrigin(): boolean {
  const raw = process.env.ALLOWED_ORIGINS ?? "";
  return raw
    .split(",")
    .map((o) => o.trim())
    .some((o) => o && !o.startsWith("http://localhost") && !o.startsWith("http://127.0.0.1"));
}

export function createSessionMiddleware(
  store: session.Store,
  secretOverride?: string,
): RequestHandler {
  const secret = resolveSessionSecret(secretOverride);
  const isProduction = process.env.NODE_ENV === "production";
  const crossSite = isProduction || hasNonLocalOrigin();

  return session({
    name: "lead.sid",
    secret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: crossSite ? "none" : "lax",
      secure: crossSite,
      maxAge: 24 * 60 * 60 * 1000,
    },
  });
}
