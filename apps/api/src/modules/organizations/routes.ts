import { Router } from "express";
import type { Pool } from "pg";
import { findOrgById } from "./repository";

export function createOrganizationsRouter(db: Pool): Router {
  const router = Router();

  router.get("/me", async (req, res) => {
    const orgId = req.session.orgId;

    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const org = await findOrgById(db, orgId);

      if (!org) {
        return res.status(404).json({ error: "Organization not found" });
      }

      return res.json({ name: org.name, credits: org.credits });
    } catch {
      return res.status(500).json({ error: "Failed to get organization" });
    }
  });

  return router;
}
