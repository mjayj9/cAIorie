import fs from "node:fs";
import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL || process.env.DATABASE_URL === "[SENSITIVE]") {
  throw new Error("DATABASE_URL must be configured before migration.");
}
const sql = neon(process.env.DATABASE_URL);
await sql.query(
  "CREATE TABLE IF NOT EXISTS lunch_migrations (id text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
);
const directory = new URL("../db/postgres/", import.meta.url);
for (const filename of fs
  .readdirSync(directory)
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort()) {
  const source = fs.readFileSync(new URL(filename, directory), "utf8");
  const checksum = createHash("sha256").update(source).digest("hex");
  const existing = await sql.query(
    "SELECT checksum FROM lunch_migrations WHERE id = $1",
    [filename],
  );
  if (existing.length) {
    if (existing[0].checksum !== checksum)
      throw new Error("Applied migration has changed: " + filename);
    console.log("Already applied: " + filename);
    continue;
  }
  const statements = source
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  await sql.transaction([
    sql.query("SELECT pg_advisory_xact_lock(72849315)"),
    ...statements.map((statement) => sql.query(statement)),
    sql.query(
      "INSERT INTO lunch_migrations (id, checksum) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [filename, checksum],
    ),
  ]);
  console.log("Applied: " + filename);
}
