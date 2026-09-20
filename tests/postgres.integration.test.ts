import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PostgresDatabase } from "../server/database/postgres.ts";
const enabled = process.env.RUN_POSTGRES_TESTS === "1";
function database() {
  assert.ok(process.env.DATABASE_URL);
  return new PostgresDatabase(process.env.DATABASE_URL);
}
async function withSession(
  work: (db: PostgresDatabase, owner: string) => Promise<void>,
) {
  const db = database(),
    owner = "test_pg_" + randomUUID();
  await db.run({
    sql: "INSERT INTO sessions (id, csrf, state, expires) VALUES (?, ?, ?, ?)",
    args: [owner, "test", "{}", Date.now() + 60000],
  });
  try {
    await work(db, owner);
  } finally {
    await db.run({ sql: "DELETE FROM sessions WHERE id = ?", args: [owner] });
  }
}
test(
  "Postgres preserves bound text and millisecond expiry",
  { skip: !enabled },
  async () => {
    await withSession(async (db, owner) => {
      const text = "한 끼 '?'; --",
        expires = Date.now() + 86400000;
      await db.run({
        sql: "UPDATE sessions SET state = ?, expires = ? WHERE id = ?",
        args: [text, expires, owner],
      });
      assert.deepEqual(
        await db.first({
          sql: "SELECT state, expires FROM sessions WHERE id = ?",
          args: [owner],
        }),
        { state: text, expires },
      );
    });
  },
);
test(
  "Postgres batch rolls back all writes when a later statement fails",
  { skip: !enabled },
  async () => {
    await withSession(async (db, owner) => {
      await assert.rejects(
        db.batch([
          {
            sql: "UPDATE sessions SET state = ? WHERE id = ?",
            args: ['{"changed":true}', owner],
          },
          {
            sql: "INSERT INTO meals (id, owner, day, payload, idempotency_key) VALUES (?, ?, ?, ?, ?)",
            args: [
              randomUUID(),
              "missing_" + owner,
              "2026-09-20",
              "{}",
              "missing",
            ],
          },
        ]),
      );
      assert.deepEqual(
        await db.first({
          sql: "SELECT state FROM sessions WHERE id = ?",
          args: [owner],
        }),
        { state: "{}" },
      );
    });
  },
);
test(
  "Concurrent meal writes are idempotent and session deletion cascades",
  { skip: !enabled },
  async () => {
    await withSession(async (db, owner) => {
      const insert = () =>
        db.run({
          sql: "INSERT INTO meals (id, owner, day, payload, idempotency_key) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
          args: [randomUUID(), owner, "2026-09-20", "{}", "same-meal"],
        });
      const results = await Promise.all([insert(), insert()]);
      assert.equal(
        results.reduce((total, result) => total + result.changes, 0),
        1,
      );
      assert.equal(
        (
          await db.rows({
            sql: "SELECT id FROM meals WHERE owner = ?",
            args: [owner],
          })
        ).length,
        1,
      );
      await db.run({ sql: "DELETE FROM sessions WHERE id = ?", args: [owner] });
      assert.equal(
        (
          await db.rows({
            sql: "SELECT id FROM meals WHERE owner = ?",
            args: [owner],
          })
        ).length,
        0,
      );
    });
  },
);
