import type { Pool } from "pg";
import type { OrganizationRow } from "./types";

export async function findOrgById(
  db: Pool,
  orgId: string,
): Promise<OrganizationRow | null> {
  const result = await db.query<OrganizationRow>(
    "SELECT id, name, credits, created_at FROM organizations WHERE id = $1",
    [orgId],
  );
  return (result.rows[0] as OrganizationRow | undefined) ?? null;
}
