import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function csrfTokenHandler(req: Request, res: Response): void {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateToken();
  }
  res.json({ csrfToken: req.session.csrfToken });
}

export function createCsrfProtection(
  excludedPaths: Set<string>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const routeKey = `${req.method} ${req.path}`;
    if (excludedPaths.has(routeKey)) return next();

    const headerToken = req.headers["x-csrf-token"] as string | undefined;
    const sessionToken = req.session.csrfToken as string | undefined;

    if (
      !headerToken ||
      !sessionToken ||
      headerToken.length !== sessionToken.length ||
      !crypto.timingSafeEqual(Buffer.from(headerToken), Buffer.from(sessionToken))
    ) {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }

    next();
  };
}
