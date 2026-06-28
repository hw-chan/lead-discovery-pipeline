import type { RequestHandler } from "express";

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.orgId = req.session.orgId;
  next();
};

export function createAuthGuard(publicRoutes: Set<string>): RequestHandler {
  return (req, res, next) => {
    const pathWithoutQuery = req.originalUrl.split("?")[0];
    const routeKey = `${req.method} ${pathWithoutQuery}`;
    if (publicRoutes.has(routeKey)) {
      return next();
    }
    return requireAuth(req, res, next);
  };
}
