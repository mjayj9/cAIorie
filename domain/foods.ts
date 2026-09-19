import type { MealItem, Observation } from "./models.ts";

export type CatalogFood = {
  id: string;
  name: string;
  provider: string;
  basis: string;
  basisGrams: number | null;
  category: string | null;
  sourceUrl: string | null;
  updatedAt: string | null;
  nutrition: Record<string, Observation<number>>;
};
export const nutrientLabels: Record<string, string> = {
  energy: "열량",
  protein: "단백질",
  fat: "지방",
  carbohydrate: "탄수화물",
  sugars: "당류",
  sodium: "나트륨",
};
/** A database reference is not a measurement of the user's actual meal. */
export function nutritionForGrams(
  food: CatalogFood,
  grams: number | null,
): MealItem["nutrition"] {
  const valid =
    grams !== null &&
    Number.isFinite(grams) &&
    grams > 0 &&
    food.basisGrams !== null &&
    food.basisGrams > 0;
  return Object.fromEntries(
    Object.entries(food.nutrition).map(([key, nutrient]) => {
      const value =
        valid && nutrient.value !== null
          ? Math.round(((nutrient.value * grams!) / food.basisGrams!) * 100) /
            100
          : null;
      return [
        key,
        {
          ...nutrient,
          value,
          status: value === null ? "unknown" : "estimated",
          basis: valid
            ? food.name +
              " DB 기준 " +
              food.basis +
              "에서 " +
              grams +
              "g으로 환산한 추정치"
            : "중량 또는 DB 기준량 미확인",
        },
      ];
    }),
  );
}
export type RegistryLookup = {
  matched: boolean;
  administrativeStatus: "active" | "closed" | "suspended" | "unknown";
  label: string;
  sourceUrl: string;
  checkedAt: string;
  updatedAt: string | null;
  notice: string;
};
