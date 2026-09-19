import type { Meal, Menu, Observation, Selection } from "./models.ts";

/** Keep the idempotency result without turning a choice into a visit log. */
export function archiveSelection(
  selection: Selection,
  status: Selection["status"],
  meal: Meal | null,
  saveVisits: boolean,
): Selection {
  const result = { ...selection, status, mealId: meal?.id ?? null };
  if (saveVisits && meal) return result;
  const missing: Observation<number> = {
    value: null,
    status: "unknown",
    evidenceIds: [],
    checkedAt: null,
  };
  const menu: Menu = {
    id: "",
    placeId: "",
    name: meal?.raw ?? "",
    cuisine: "",
    ingredients: null,
    foodGroups: [],
    cooking: null,
    price: missing,
    allergens: {},
    nutrition: {},
    evidenceIds: [],
    image: null,
    popularity: missing,
  };
  return { ...result, placeId: "", placeName: "", selectionReason: null, menu };
}
