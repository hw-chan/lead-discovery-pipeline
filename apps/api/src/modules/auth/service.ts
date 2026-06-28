import bcrypt from "bcrypt";
import type { Pool } from "pg";
import { findUserByEmail, createUserWithOrganization } from "./repository";
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

export async function registerUser(
  db: Pool,
  email: string,
  password: string,
): Promise<SessionPayload> {
  const existing = await findUserByEmail(db, email);
  if (existing) {
    const error = new Error("Email already registered");
    error.name = "DuplicateEmailError";
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await createUserWithOrganization(db, email, passwordHash);

  return { userId: user.id, orgId: user.org_id, email: user.email };
}
