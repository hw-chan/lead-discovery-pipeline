import "express-session";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    orgId?: string;
    email?: string;
    csrfToken?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      orgId?: string;
    }
  }
}
