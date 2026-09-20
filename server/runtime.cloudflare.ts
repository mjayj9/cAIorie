import { env } from "cloudflare:workers";
import { CloudflareDatabase } from "./database/cloudflare.ts";
import { AppError } from "./errors.ts";

export function getRuntime() {
  if (!env.DB)
    throw new AppError(
      503,
      "DATABASE_REQUIRED",
      "데이터 저장소를 준비 중이에요. 잠시 후 다시 시도해 주세요.",
    );
  return {
    database: new CloudflareDatabase(env.DB),
    bindings: env as unknown as Record<string, string | undefined>,
  };
}
