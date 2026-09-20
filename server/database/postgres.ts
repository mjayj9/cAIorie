import { neon, types, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Database, SqlStatement } from "./contracts.ts";

// Every int8 column in this schema stores a millisecond timestamp.
types.setTypeParser(20, (value: string) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new Error("Database integer is out of range");
  return number;
});

export class PostgresDatabase implements Database {
  private readonly client: NeonQueryFunction<false, true>;
  constructor(connectionString: string) {
    this.client = neon(connectionString, { fullResults: true });
  }
  private query(statement: SqlStatement) {
    // SQL is fixed application text; user data is always a separate parameter.
    let index = 0;
    const sql = statement.sql.replace(/\?/g, () => "$" + ++index);
    if (index !== statement.args.length)
      throw new Error("SQL parameter count mismatch");
    return this.client.query(sql, statement.args);
  }
  async first<T>(statement: SqlStatement) {
    return (await this.rows<T>(statement))[0] ?? null;
  }
  async rows<T>(statement: SqlStatement) {
    return (await this.query(statement)).rows as T[];
  }
  async run(statement: SqlStatement) {
    return { changes: (await this.query(statement)).rowCount ?? 0 };
  }
  async batch(statements: SqlStatement[]) {
    if (!statements.length) return [];
    const results = await this.client.transaction(
      statements.map((s) => this.query(s)),
    );
    return results.map((result) => ({ changes: result.rowCount ?? 0 }));
  }
}
