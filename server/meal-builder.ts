import type { z } from "zod";
import type { Meal, Mode } from "../domain/models.ts";
import type { mealDraftSchema } from "../domain/schemas.ts";
import { localDate } from "../domain/meals.ts";
import { nutritionForGrams } from "../domain/foods.ts";
import { resolveFood } from "../providers/nutrition.ts";
import type { Context } from "./context.ts";
import { AppError } from "./errors.ts";

/** All writes, including edits and recommendation confirmations, use this gate. */
export async function makeMeal(
  c: Context,
  data: z.infer<typeof mealDraftSchema>,
  id = crypto.randomUUID(),
  mode: Mode = c.config.demoMode ? "demo" : "live",
  old?: Meal,
): Promise<Meal> {
  if (
    data.status === "confirmed" &&
    data.day > localDate(new Date(), data.timezone)
  )
    throw new AppError(
      400,
      "FUTURE_MEAL",
      "아직 먹지 않은 식사는 계획으로 저장해 주세요.",
    );
  if (data.source !== "search" || !data.foodId?.startsWith("mfds:"))
    throw new AppError(
      400,
      "OFFICIAL_FOOD_REQUIRED",
      "식약처 식품영양성분DB에서 음식을 검색하고 항목을 선택해 주세요. 직접 입력한 이름은 저장할 수 없어요.",
    );
  const prior =
    old?.items.length === 1 ? old.items[0].foodReference : undefined;
  let food =
    prior?.id === data.foodId && prior.name === data.raw ? prior : null;
  if (!food) {
    try {
      food = await resolveFood(
        c.config,
        data.foodId,
        data.raw,
        c.request.signal,
      );
    } catch {
      throw new AppError(
        503,
        "NUTRITION_UNAVAILABLE",
        "식약처 DB에서 선택한 식품을 확인하지 못했어요. 입력은 유지돼요. 잠시 후 다시 시도해 주세요.",
      );
    }
  }
  if (!food)
    throw new AppError(
      400,
      "FOOD_MISMATCH",
      "선택한 식약처 식품과 이름이 일치하지 않아요. 다시 검색해 주세요.",
    );
  if (data.amount !== null && data.unit !== "g")
    throw new AppError(
      400,
      "GRAMS_REQUIRED",
      "영양량 계산에는 g 단위 중량을 입력해 주세요.",
    );
  return {
    id,
    day: data.day,
    slot: data.slot,
    timezone: data.timezone,
    raw: food.name,
    items: [
      {
        name: food.name,
        foodId: food.id,
        foodReference: food,
        amount: data.amount,
        unit: data.amount === null ? null : "g",
        nutrition: nutritionForGrams(food, data.amount),
        foodGroups: [],
        cooking: null,
        tagBasis: food.provider + " · " + (food.category ?? "분류 미확인"),
      },
    ],
    status: data.status,
    source: "search",
    confirmedAt:
      data.status === "confirmed"
        ? (old?.confirmedAt ?? new Date().toISOString())
        : null,
    visit: null,
    dataMode: mode,
  };
}
