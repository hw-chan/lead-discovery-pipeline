import type { Router } from "express";

export interface ModuleDescriptor {
  name: string;
  router: Router;
  publicRoutes: string[];
}
