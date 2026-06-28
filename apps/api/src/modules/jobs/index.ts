import type { Pool } from "pg";
import { createJobsRouter } from "./routes";
import type { ModuleDescriptor } from "../../shared/module";

export function createJobsModule(db: Pool): ModuleDescriptor {
  return {
    name: "jobs",
    router: createJobsRouter(db),
    publicRoutes: [],
  };
}
