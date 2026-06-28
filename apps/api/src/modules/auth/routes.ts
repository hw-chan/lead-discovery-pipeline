import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { Pool } from "pg";
import { authenticateUser } from "./service";
import { validate } from "../../shared/validate";
import { loginSchema } from "./schemas";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many login attempts. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export function createAuthRouter(db: Pool): Router {
  const router = Router();

  router.post("/login", loginLimiter, validate(loginSchema), async (req, res) => {
    const { email, password } = req.body;

    try {
      const payload = await authenticateUser(db, email, password);
      if (!payload) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      req.session.regenerate((err) => {
        if (err) {
          return res.status(500).json({ error: "Login failed" });
        }

        req.session.userId = payload.userId;
        req.session.orgId = payload.orgId;
        req.session.email = payload.email;

        return res.json(payload);
      });
    } catch {
      return res.status(500).json({ error: "Login failed" });
    }
  });

  router.get("/me", (req, res) => {
    return res.json({
      userId: req.session.userId,
      email: req.session.email,
      orgId: req.session.orgId,
    });
  });

  router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to destroy session" });
      }
      res.clearCookie("lead.sid");
      return res.json({ success: true });
    });
  });

  return router;
}
