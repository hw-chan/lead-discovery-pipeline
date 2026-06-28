import express, { type Express } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Pool } from "pg";
import pool from "./shared/db";
import { createSessionMiddleware } from "./shared/session";
import { createAuthGuard } from "./shared/auth";
import { csrfTokenHandler, createCsrfProtection } from "./shared/csrf";
import type { ModuleDescriptor } from "./shared/module";
import { createAuthModule } from "./modules/auth";

export interface CreateAppOptions {
  pool?: Pool;
  sessionStore?: session.Store;
  sessionSecret?: string;
}

export function createApp(options: CreateAppOptions = {}): Express {
  const db = options.pool ?? pool;
  const app = express();

  app.use(express.json());

  const store =
    options.sessionStore ??
    new (connectPgSimple(session))({ pool: db, tableName: "sessions" });
  app.use(createSessionMiddleware(store, options.sessionSecret));

  app.get("/health", async (_req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ status: "healthy" });
    } catch {
      res.status(503).json({ status: "unhealthy" });
    }
  });

  app.get("/api/csrf-token", csrfTokenHandler);

  const modules: ModuleDescriptor[] = [createAuthModule(db)];

  const publicRoutes = new Set<string>();
  for (const m of modules) {
    for (const route of m.publicRoutes) {
      publicRoutes.add(route);
    }
  }

  const csrfExcludedPaths = new Set<string>(["GET /api/csrf-token"]);
  app.use("/api", createCsrfProtection(csrfExcludedPaths));

  app.use("/api", createAuthGuard(publicRoutes));

  for (const m of modules) {
    app.use(`/api/${m.name}`, m.router);
  }

  return app;
}

if (require.main === module) {
  const PORT = parseInt(process.env.PORT ?? "3001", 10);
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

export default createApp;
