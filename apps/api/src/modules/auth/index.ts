import type { Pool } from "pg";
import { createAuthRouter } from "./routes";
import type { ModuleDescriptor } from "../../shared/module";

export function createAuthModule(db: Pool): ModuleDescriptor {
  return {
    name: "auth",
    router: createAuthRouter(db),
    publicRoutes: ["POST /api/auth/login", "POST /api/auth/register"],
  };
}
