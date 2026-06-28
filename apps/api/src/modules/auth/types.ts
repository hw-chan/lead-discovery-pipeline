export interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  org_id: string;
}

export interface SessionPayload {
  userId: string;
  orgId: string;
  email: string;
}
