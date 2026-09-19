import { z } from "zod";
import type { Context } from "../context.ts";
import type { CatalogFood } from "../../domain/foods.ts";
import { demoFoodCatalog } from "../../fixtures/demo.ts";
import { searchNutrition } from "../../providers/nutrition.ts";
import { lookupRegistry } from "../../providers/registry.ts";
import { ProviderError } from "../../providers/http.ts";
import { AppError } from "../errors.ts";

export const demoCatalog: CatalogFood[] = demoFoodCatalog.map((food) => ({
  ...food,
  basisGrams: null,
  category: null,
  sourceUrl: null,
  updatedAt: null,
}));
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
  if (c.config.demoMode)
    return {
      mode: "demo",
      items: demoCatalog.filter((food) => food.name.includes(q)),
      notice: "데모 음식 카탈로그입니다. 실제 영양값을 제공하지 않습니다.",
    };
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
        ? "식약처 API 키 설정을 확인해 주세요. 직접 입력으로 기록할 수 있어요."
        : "공식 영양 DB를 불러오지 못했어요. 잠시 후 다시 검색하거나 직접 입력해 주세요.",
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
