import type { Database, SqlStatement } from "./contracts.ts";
export class CloudflareDatabase implements Database {
  constructor(private readonly binding: D1Database) {}
  private query(statement: SqlStatement) {
    return this.binding.prepare(statement.sql).bind(...statement.args);
  }
  async first<T>(statement: SqlStatement) {
    return this.query(statement).first<T>();
  }
  async rows<T>(statement: SqlStatement) {
    return (await this.query(statement).all<T>()).results;
  }
  async run(statement: SqlStatement) {
    return { changes: (await this.query(statement).run()).meta.changes };
  }
  async batch(statements: SqlStatement[]) {
    if (!statements.length) return [];
    const results = await this.binding.batch(
      statements.map((s) => this.query(s)),
    );
    return results.map((result) => ({ changes: result.meta.changes }));
  }
}
