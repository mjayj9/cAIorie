export type SqlStatement = { sql: string; args: unknown[] };
export type WriteResult = { changes: number };
export interface Database {
  first<T>(statement: SqlStatement): Promise<T | null>;
  rows<T>(statement: SqlStatement): Promise<T[]>;
  run(statement: SqlStatement): Promise<WriteResult>;
  batch(statements: SqlStatement[]): Promise<WriteResult[]>;
}
