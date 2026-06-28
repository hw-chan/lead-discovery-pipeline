import fs from "fs";
import path from "path";
import { Client } from "pg";
import pool from "./shared/db";

function parseDbName(): string {
  try {
    const u = new URL(
      process.env.DATABASE_URL ?? "postgres://localhost:5432/lead_discovery",
    );
    return u.pathname.replace(/^\//, "") || "lead_discovery";
  } catch {
    return "lead_discovery";
  }
}

async function ensureDatabase(dbName: string) {
  const url = process.env.DATABASE_URL ?? "postgres://localhost:5432/lead_discovery";
  const maintenanceUrl = url.replace(new RegExp(`/${dbName}(\\?|$)`), "/postgres$1");

  const client = new Client({ connectionString: maintenanceUrl });
  try {
    await client.connect();
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (res.rows.length === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created.`);
    }
  } finally {
    await client.end();
  }
}

async function migrate() {
  await ensureDatabase(parseDbName());

  const sqlDir = path.resolve(__dirname, "migrations", "sql");
  const files = fs
    .readdirSync(sqlDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("No migration files found.");
    await pool.end();
    return;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const file of files) {
      const sql = fs.readFileSync(path.join(sqlDir, file), "utf-8");
      console.log(`Applying ${file}...`);
      await client.query(sql);
    }

    await client.query("COMMIT");
    console.log("All migrations applied successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed, rolling back.", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
