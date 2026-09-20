import { z } from "zod";
import type { Context } from "../context.ts";
import { searchNutrition } from "../../providers/nutrition.ts";
import { lookupRegistry } from "../../providers/registry.ts";
import { ProviderError } from "../../providers/http.ts";
import { AppError } from "../errors.ts";

export function requireMealAccess(c: Context) {
  if (
    !c.state.onboarded ||
    c.state.profile.ageBand === "not_provided" ||
    c.state.profile.ageBand === "under14"
  )
    throw new AppError(
      403,
      "AGE_REQUIRED",
      "식사 입력 전 최소 설정을 확인해 주세요.",
    );
}
export async function searchFoods(c: Context, query: string) {
  requireMealAccess(c);
  const q = z
    .string()
    .trim()
    .min(1, "음식 이름을 입력해 주세요.")
    .max(100)
    .parse(query);
  try {
    return {
      mode: "live",
      items: await searchNutrition(c.config, q, c.request.signal),
      notice:
        "식약처 식품영양성분DB 기준값입니다. 실제 식당 메뉴와 재료·조리법·분량이 다를 수 있어요.",
    };
  } catch (error) {
    throw new AppError(
      503,
      "NUTRITION_UNAVAILABLE",
      error instanceof ProviderError && error.code === "unconfigured"
        ? "식약처 DB 연결이 준비되지 않았어요. 연결이 복구된 뒤 검색해 주세요."
        : "식약처 DB를 불러오지 못했어요. 잠시 후 다시 검색해 주세요. 확인되지 않은 음식은 저장할 수 없어요.",
    );
  }
}
export async function registryStatus(c: Context, input: unknown) {
  requireMealAccess(c);
  const place = z
    .object({
      name: z.string().trim().min(1).max(100),
      address: z.string().trim().min(1).max(300),
    })
    .strict()
    .parse(input);
  if (c.config.demoMode)
    throw new AppError(409, "LIVE_ONLY", "실제 음식점에서 확인할 수 있어요.");
  try {
    return await lookupRegistry(c.config, place, c.request.signal);
  } catch {
    throw new AppError(
      503,
      "REGISTRY_UNAVAILABLE",
      "행정정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
    );
  }
}
