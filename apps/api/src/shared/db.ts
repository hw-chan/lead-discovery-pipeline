import "dotenv/config";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL ?? "postgres://localhost:5432/lead_discovery";

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

export default pool;
