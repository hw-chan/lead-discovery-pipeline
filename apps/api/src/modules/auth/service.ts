import bcrypt from "bcrypt";
import type { Pool } from "pg";
import { findUserByEmail } from "./repository";
import type { SessionPayload } from "./types";

export async function authenticateUser(
  db: Pool,
  email: string,
  password: string,
): Promise<SessionPayload | null> {
  const user = await findUserByEmail(db, email);
  if (!user || !user.password_hash) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  return { userId: user.id, orgId: user.org_id, email: user.email };
}
