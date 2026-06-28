import type { Pool } from "pg";
import type { UserRow } from "./types";

export async function findUserByEmail(
  db: Pool,
  email: string,
): Promise<UserRow | null> {
  const result = await db.query(
    "SELECT id, email, password_hash, org_id FROM users WHERE email = $1",
    [email],
  );
  return (result.rows[0] as UserRow | undefined) ?? null;
}
