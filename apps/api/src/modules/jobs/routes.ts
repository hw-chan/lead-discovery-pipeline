import { Router } from "express";
import type { Pool } from "pg";
import { validate } from "../../shared/validate";
import { createJobSchema } from "./schemas";
import {
  deductCreditAndCreateJob,
  findJobsByOrg,
  findJobById,
  findLeadsByJobId,
} from "./repository";

export function createJobsRouter(db: Pool): Router {
  const router = Router();

  router.post("/", validate(createJobSchema), async (req, res) => {
    const orgId = req.session.orgId;
    const userId = req.session.userId;

    if (!orgId || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const jobId = await deductCreditAndCreateJob(
        db,
        orgId,
        userId,
        req.body,
      );

      if (jobId === null) {
        return res.status(402).json({ error: "Payment Required" });
      }

      return res.status(200).json({ job_id: jobId });
    } catch {
      return res.status(500).json({ error: "Failed to create job" });
    }
  });

  router.get("/", async (req, res) => {
    const orgId = req.session.orgId;

    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const jobs = await findJobsByOrg(db, orgId);
      return res.json({ jobs });
    } catch {
      return res.status(500).json({ error: "Failed to list jobs" });
    }
  });

  router.get("/:id", async (req, res) => {
    const orgId = req.session.orgId;

    if (!orgId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const job = await findJobById(db, req.params.id, orgId);

      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      const leads = await findLeadsByJobId(db, job.id, orgId);
      return res.json({ job, leads });
    } catch {
      return res.status(500).json({ error: "Failed to get job" });
    }
  });

  return router;
}
