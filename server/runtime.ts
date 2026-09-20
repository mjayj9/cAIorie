import { PostgresDatabase } from "./database/postgres.ts";
import { AppError } from "./errors.ts";

let database: PostgresDatabase | undefined;
export function getRuntime() {
  const connection = process.env.DATABASE_URL;
  if (!connection || connection === "[SENSITIVE]") {
    throw new AppError(
      503,
      "DATABASE_REQUIRED",
      "데이터 저장소를 준비 중이에요. 잠시 후 다시 시도해 주세요.",
    );
  }
  database ??= new PostgresDatabase(connection);
  return { database, bindings: process.env };
}
