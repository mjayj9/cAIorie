import type { CatalogFood } from "../domain/foods.ts";
import type { Observation } from "../domain/models.ts";
import { fetchPublicData, publicText } from "./public-data.ts";
import { isUsableKey, type ProviderConfig } from "./contracts.ts";
import { ProviderError } from "./http.ts";

export const nutritionSource =
  "https://www.data.go.kr/data/15127578/openapi.do";
const nutrientFields = {
  energy: ["AMT_NUM1", "kcal"],
  protein: ["AMT_NUM3", "g"],
  fat: ["AMT_NUM4", "g"],
  carbohydrate: ["AMT_NUM6", "g"],
  sugars: ["AMT_NUM7", "g"],
  sodium: ["AMT_NUM13", "mg"],
} as const;
export function nutrientNumber(raw: unknown): number | null {
  if (
    (typeof raw !== "string" && typeof raw !== "number") ||
    String(raw).trim() === ""
  )
    return null;
  const text = String(raw).trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function normalizeFood(
  row: Record<string, unknown>,
  checkedAt = new Date().toISOString(),
): CatalogFood | null {
  const code = publicText(row.FOOD_CD),
    name = publicText(row.FOOD_NM_KR);
  if (!code || code.length > 70 || !name) return null;
  const basis = publicText(row.SERVING_SIZE) ?? "기준량 미확인";
  const match = basis.match(/^(\d+(?:\.\d+)?)\s*g$/i);
  const basisGrams = match && Number(match[1]) > 0 ? Number(match[1]) : null;
  const nutrition: Record<string, Observation<number>> = {};
  for (const [nutrient, [field, unit]] of Object.entries(nutrientFields)) {
    const value = nutrientNumber(row[field]);
    nutrition[nutrient] = {
      value,
      unit,
      status: value === null ? "unknown" : "verified",
      evidenceIds: ["mfds:" + code],
      basis: name + " DB 기준 " + basis,
      checkedAt,
    };
  }
  return {
    id: "mfds:" + code,
    name,
    provider: "식품의약품안전처 식품영양성분DB",
    basis,
    basisGrams,
    category: publicText(row.FOOD_CAT1_NM),
    sourceUrl: nutritionSource,
    updatedAt: publicText(row.UPDATE_DATE),
    nutrition,
  };
}
// This bounded cache contains public catalog records only, never meals or profiles.
const catalog = new Map<string, { food: CatalogFood; expires: number }>();
export async function searchNutrition(
  c: ProviderConfig,
  query: string,
  signal?: AbortSignal,
) {
  if (!isUsableKey(c.nutritionKey ?? ""))
    throw new ProviderError("unconfigured");
  const rows = await fetchPublicData(
    "nutrition",
    c.nutritionKey!,
    { FOOD_NM_KR: query },
    signal,
  );
  const items = rows
    .map((row) => normalizeFood(row))
    .filter((item): item is CatalogFood => item !== null);
  for (const food of items)
    catalog.set(food.id, { food, expires: Date.now() + 15 * 60000 });
  while (catalog.size > 500) catalog.delete(catalog.keys().next().value!);
  return items;
}
export async function resolveFood(
  c: ProviderConfig,
  id: string,
  name: string,
  signal?: AbortSignal,
) {
  const cached = catalog.get(id);
  if (cached && cached.expires > Date.now() && cached.food.name === name)
    return cached.food;
  return (
    (await searchNutrition(c, name, signal)).find(
      (food) => food.id === id && food.name === name,
    ) ?? null
  );
}
