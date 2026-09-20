import { ProviderError } from "../../providers/http.ts";
import { rebuildLearning } from "../learning-service.ts";
import { z } from "zod";
import {
  mealDraftSchema,
  feedbackSchema,
  timezoneSchema,
} from "../../domain/schemas.ts";
import {
  localDate,
  parseMealText,
  transitionSelection,
} from "../../domain/meals.ts";
import type { Meal, Mode } from "../../domain/models.ts";
import { nutritionForGrams } from "../../domain/foods.ts";
import { resolveFood } from "../../providers/nutrition.ts";
import { aiConfigured } from "../../providers/contracts.ts";
import {
  parseWithOpenRouter,
  type MealParseResult,
} from "../../providers/ai.ts";
import { demoCatalog, requireMealAccess } from "./catalog.ts";
import type { Context } from "../context.ts";
import { AppError, requireValue } from "../errors.ts";
const errorFuture = () =>
  new AppError(
    400,
    "FUTURE_MEAL",
    "아직 먹지 않은 식사는 계획으로 저장해 주세요.",
  );
async function makeMeal(
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
    throw errorFuture();
  let items = parseMealText(data.raw);
  if (!items.length)
    throw new AppError(400, "EMPTY_MEAL", "음식 이름을 입력해 주세요.");
  if (data.foodId) {
    if (data.source !== "search")
      throw new AppError(
        400,
        "FOOD_MISMATCH",
        "검색한 음식을 다시 선택해 주세요.",
      );
    // An existing reference comes only from this owner's server-stored meal.
    const prior =
      old?.items.length === 1 ? old.items[0].foodReference : undefined;
    let food =
      prior?.id === data.foodId && prior.name === data.raw ? prior : null;
    if (!food) {
      try {
        food = c.config.demoMode
          ? (demoCatalog.find(
              (f) => f.id === data.foodId && f.name === data.raw,
            ) ?? null)
          : data.foodId.startsWith("mfds:")
            ? await resolveFood(
                c.config,
                data.foodId,
                data.raw,
                c.request.signal,
              )
            : null;
      } catch {
        throw new AppError(
          503,
          "NUTRITION_UNAVAILABLE",
          "선택한 식품을 확인하지 못했어요. 입력은 유지되며 다시 검색할 수 있어요.",
        );
      }
    }
    if (!food)
      throw new AppError(
        400,
        "FOOD_MISMATCH",
        "선택한 공식 식품과 입력이 일치하지 않아요. 다시 검색해 주세요.",
      );
    if (data.amount !== null && data.unit !== "g")
      throw new AppError(
        400,
        "GRAMS_REQUIRED",
        "공식 영양량 환산에는 g 단위 중량을 입력해 주세요.",
      );
    items = [
      {
        ...items[0],
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
    ];
  } else if (data.amount !== null && items.length === 1) {
    items[0].amount = data.amount;
    items[0].unit = data.unit;
  }
  return {
    id,
    day: data.day,
    slot: data.slot,
    timezone: data.timezone,
    raw: data.raw,
    items,
    status: data.status,
    source: data.source,
    confirmedAt: data.status === "confirmed" ? new Date().toISOString() : null,
    visit: null,
    dataMode: mode,
  };
}
export async function parse(
  c: Context,
  input: unknown,
): Promise<MealParseResult> {
  requireMealAccess(c);
  const { text } = z
    .object({ text: z.string().trim().min(1).max(2000) })
    .strict()
    .parse(input);
  const fallback: MealParseResult = {
    items: parseMealText(text),
    method: "conservative_rules",
    notice:
      "규칙 기반으로 음식과 명시된 양을 구분했어요. 외부 AI에는 전송하지 않았어요.",
  };
  if (
    !c.state.consents.externalAi ||
    c.state.profile.ageBand !== "adult" ||
    !aiConfigured(c.config)
  )
    return fallback;
  try {
    return await parseWithOpenRouter(c.config, text, c.request.signal);
  } catch (error) {
    console.warn(
      "Meal AI fallback:",
      error instanceof ProviderError ? error.code : "unavailable",
    );
    return {
      ...fallback,
      notice:
        "외부 AI 처리에 실패해 규칙 기반 결과를 표시해요. 빠진 음식과 양을 확인해 주세요.",
    };
  }
}
export async function saveMeal(c: Context, input: unknown) {
  requireMealAccess(c);
  const data = mealDraftSchema.parse(input),
    meal = await makeMeal(
      c,
      data,
      crypto.randomUUID(),
      c.config.demoMode ? "demo" : "live",
    );
  if (
    c.state.profile.ageBand === "not_provided" ||
    c.state.profile.ageBand === "under14"
  )
    throw new AppError(
      403,
      "AGE_REQUIRED",
      "식사 입력 전 연령 구간을 확인해 주세요.",
    );
  if (!c.state.onboarded)
    throw new AppError(
      409,
      "SETUP_REQUIRED",
      "먼저 최소 설정을 확인해 주세요.",
    );
  if (!c.state.consents.saveMeals)
    return {
      meal,
      stored: false,
      message: "섭취를 확인했어요. 기록 보관 동의가 없어 저장하지 않았어요.",
    };
  if ((await c.repo.getMeals(c.owner)).length >= 500)
    throw new AppError(
      409,
      "RECORD_LIMIT",
      "이 프로토타입은 최대 500개 기록을 보관해요. 내보내기 후 이전 기록을 삭제해 주세요.",
    );
  return {
    meal: await c.repo.insertMeal(c.owner, meal, data.idempotencyKey),
    stored: true,
  };
}
export async function editMeal(c: Context, input: unknown) {
  const { id, draft } = z
    .object({ id: z.string().uuid(), draft: mealDraftSchema })
    .parse(input);
  requireMealAccess(c);
  const old = requireValue(await c.repo.getMeal(c.owner, id)),
    meal = {
      ...(await makeMeal(c, draft, id, old.dataMode, old)),
      visit: old.visit,
      dataMode: old.dataMode,
    };
  await c.repo.run(
    "UPDATE meals SET day = ?, payload = ? WHERE id = ? AND owner = ?",
    meal.day,
    JSON.stringify(meal),
    id,
    c.owner,
  );
  await rebuildLearning(c);
  await c.repo.invalidate(c.owner);
  return { meal };
}
export async function deleteMeals(c: Context, input: unknown) {
  const data = z
    .object({
      id: z.string().uuid().optional(),
      before: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    })
    .strict()
    .refine(
      (d) => !!d.id !== !!d.before,
      "삭제할 기록 또는 날짜를 선택해 주세요.",
    )
    .parse(input);
  if (data.id)
    await c.repo.run(
      "DELETE FROM meals WHERE id = ? AND owner = ?",
      data.id,
      c.owner,
    );
  else
    await c.repo.run(
      "DELETE FROM meals WHERE owner = ? AND day <= ?",
      c.owner,
      data.before!,
    );
  await rebuildLearning(c);
  await c.repo.invalidate(c.owner);
  return { deleted: true };
}
export async function confirmMeal(c: Context, input: unknown) {
  const data = z
    .object({
      selectionId: z.string().uuid(),
      action: z.enum(["eaten", "changed", "not_eaten", "later"]),
      changedText: z.string().trim().max(2000).optional(),
      timezone: timezoneSchema,
      amount: z.number().positive().max(10000).nullable().optional(),
      unit: z.string().max(20).nullable().optional(),
    })
    .strict()
    .parse(input);
  const selection = requireValue(
    await c.repo.selection(c.owner, data.selectionId),
  );
  if (selection.status !== "awaiting_confirmation")
    return {
      selection,
      meal: selection.mealId
        ? await c.repo.getMeal(c.owner, selection.mealId)
        : null,
      stored: !!selection.mealId,
    };
  const status = transitionSelection(selection.status, data.action);
  if (status === "awaiting_confirmation")
    return { selection, meal: null, stored: false };
  let meal: Meal | null = null;
  if (status === "confirmed_eaten" || status === "changed_meal") {
    if (status === "changed_meal" && !data.changedText)
      throw new AppError(
        400,
        "ACTUAL_MEAL_REQUIRED",
        "실제로 드신 음식을 입력해 주세요.",
      );
    const raw =
      status === "changed_meal" ? data.changedText! : selection.menu.name;
    const draft = mealDraftSchema.parse({
      raw,
      day: localDate(new Date(), data.timezone),
      slot: "lunch",
      timezone: data.timezone,
      status: "confirmed",
      source: status === "changed_meal" ? "manual" : "selection",
      foodId: null,
      amount: data.amount ?? null,
      unit: data.unit ?? null,
      idempotencyKey: selection.id,
    });
    meal = await makeMeal(c, draft, selection.id, selection.dataMode);
    if (status === "confirmed_eaten") {
      meal.items[0].foodGroups = selection.menu.foodGroups;
      meal.items[0].cooking = selection.menu.cooking;
    }
    if (c.state.consents.saveVisits && status === "confirmed_eaten")
      meal.visit = { placeId: selection.placeId, menuId: selection.menu.id };
  }
  const stored = !!meal && c.state.consents.saveMeals;
  const updated = await c.repo.confirm(
    c.owner,
    selection,
    stored ? meal : null,
    status,
    c.state.consents.saveVisits,
  );
  return {
    selection: updated,
    meal: stored ? await c.repo.getMeal(c.owner, selection.id) : meal,
    stored,
    message: stored
      ? "식사를 기록했어요."
      : "섭취 상태만 확인했어요. 보관 동의가 없어 식사 기록은 저장하지 않았어요.",
  };
}
export async function saveFeedback(c: Context, input: unknown) {
  const data = feedbackSchema.parse(input),
    meal = requireValue(await c.repo.getMeal(c.owner, data.mealId));
  if (meal.status !== "confirmed")
    throw new AppError(
      409,
      "NOT_EATEN",
      "확인된 식사에만 식후 만족도를 남길 수 있어요.",
    );
  if (data.mode === "B") {
    data.reasons = [];
    data.comment = "";
  }
  await c.repo.feedback(c.owner, data);
  return { saved: true, learning: await rebuildLearning(c) };
}
