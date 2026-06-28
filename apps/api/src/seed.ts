import bcrypt from "bcrypt";
import pool from "./db";
import { getSeedAdminPassword } from "./seedConfig";

const SEED_ORGS = [
  { id: "a0000000-0000-0000-0000-000000000001", name: "Igo", credits: 10 },
  { id: "a0000000-0000-0000-0000-000000000002", name: "Ego", credits: 5 },
];

const SEED_USERS = [
  { email: "admin@igo.com", orgId: SEED_ORGS[0].id },
  { email: "admin@ego.com", orgId: SEED_ORGS[1].id },
];

async function seed() {
  const seedAdminPassword = getSeedAdminPassword();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const org of SEED_ORGS) {
      await client.query(
        `INSERT INTO organizations (id, name, credits)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [org.id, org.name, org.credits],
      );
      console.log(`Organization "${org.name}" seeded.`);
    }

    for (const user of SEED_USERS) {
      const hash = await bcrypt.hash(seedAdminPassword, 10);
      await client.query(
        `INSERT INTO users (id, email, password_hash, org_id)
         VALUES (gen_random_uuid(), $1, $2, $3)
         ON CONFLICT (email) DO NOTHING`,
        [user.email, hash, user.orgId],
      );
      console.log(`User "${user.email}" seeded.`);
    }

    await client.query("COMMIT");
    console.log("Seed completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed, rolling back.", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
