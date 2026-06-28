import { v4 as uuidv4 } from "uuid";
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

export async function createUserWithOrganization(
  db: Pool,
  email: string,
  passwordHash: string,
): Promise<UserRow> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    const orgId = uuidv4();
    await client.query(
      "INSERT INTO organizations (id, name, credits) VALUES ($1, $2, $3)",
      [orgId, `${email}'s workspace`, 10],
    );

    const userId = uuidv4();
    const result = await client.query(
      "INSERT INTO users (id, email, password_hash, org_id) VALUES ($1, $2, $3, $4) RETURNING id, email, password_hash, org_id",
      [userId, email, passwordHash, orgId],
    );

    await client.query("COMMIT");
    return result.rows[0] as UserRow;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
