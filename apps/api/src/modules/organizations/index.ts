import type { Pool } from "pg";
import { createOrganizationsRouter } from "./routes";
import type { ModuleDescriptor } from "../../shared/module";

export function createOrganizationsModule(db: Pool): ModuleDescriptor {
  return {
    name: "organizations",
    router: createOrganizationsRouter(db),
    publicRoutes: [],
  };
}
