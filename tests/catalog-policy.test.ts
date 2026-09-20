import test from "node:test";
import assert from "node:assert/strict";
import { makeMeal } from "../server/meal-builder.ts";
import { confirmMeal } from "../server/api/meals.ts";
import { searchFoods } from "../server/api/catalog.ts";
import { initialState } from "../domain/defaults.ts";
import { localDate } from "../domain/meals.ts";
import type { Context } from "../server/context.ts";
import type { Meal } from "../domain/models.ts";
const row = {
  FOOD_CD: "policy-rice",
  FOOD_NM_KR: "쌀밥",
  SERVING_SIZE: "100g",
  AMT_NUM1: "166",
};
function context(demoMode = false) {
  const state = initialState();
  state.onboarded = true;
  state.profile.ageBand = "adult";
  return {
    state,
    config: { demoMode, nutritionKey: "test-nutrition-key" },
    request: new Request("http://localhost/api/meals"),
  } as Context;
}
const draft = () => ({
  raw: "쌀밥",
  source: "search" as const,
  foodId: "mfds:policy-rice",
  amount: 150,
  unit: "g",
  day: localDate(new Date()),
  slot: "lunch" as const,
  timezone: "Asia/Seoul",
  status: "confirmed" as const,
  idempotencyKey: crypto.randomUUID(),
});
test("arbitrary names and non-MFDS IDs cannot be recorded in live or demo mode", async () => {
  for (const demo of [true, false])
    for (const name of ["우라늄", "마약", "임의의 음식"]) {
      for (const input of [
        { ...draft(), raw: name, source: "manual" as const, foodId: null },
        { ...draft(), raw: name, foodId: null },
        { ...draft(), raw: name, foodId: "demo:food" },
      ])
        await assert.rejects(makeMeal(context(demo), input), {
          code: "OFFICIAL_FOOD_REQUIRED",
        });
    }
});
test("food name and ID must match a record supplied by MFDS", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ header: { resultCode: "00" }, body: { items: [row] } }),
  );
  const meal = await makeMeal(context(), draft());
  assert.equal(meal.raw, "쌀밥");
  assert.equal(meal.items[0].nutrition.energy.value, 249);
  for (const patch of [{ raw: "우라늄" }, { foodId: "mfds:invented-id" }])
    await assert.rejects(makeMeal(context(), { ...draft(), ...patch }), {
      code: "FOOD_MISMATCH",
    });
});
test("editing an official meal preserves reference and confirmation while changing day and grams", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ header: { resultCode: "00" }, body: { items: [row] } }),
  );
  const meal = await makeMeal(context(), draft());
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  const edit = await makeMeal(
    context(),
    { ...draft(), amount: 100, slot: "dinner" },
    "existing-id",
    "live",
    meal,
  );
  assert.equal(edit.id, "existing-id");
  assert.equal(edit.slot, "dinner");
  assert.equal(edit.items[0].nutrition.energy.value, 166);
  assert.equal(edit.confirmedAt, meal.confirmedAt);
});
test("MFDS outage never falls back to manual or fixture food", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new Error("offline");
  });
  await assert.rejects(
    makeMeal(context(true), {
      ...draft(),
      foodId: "mfds:not-cached",
      raw: "새 음식",
    }),
    { code: "NUTRITION_UNAVAILABLE" },
  );
});
test("demo food search also uses the official DB", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => {
    assert.equal(new URL(String(url)).hostname, "apis.data.go.kr");
    return Response.json({
      header: { resultCode: "00" },
      body: { items: [row] },
    });
  });
  const result = await searchFoods(context(true), "쌀밥");
  assert.equal(result.mode, "live");
  assert.equal(result.items[0].id, "mfds:policy-rice");
});
test("confirmation cannot bypass official selection using changedText", async () => {
  const c = context();
  c.owner = "owner";
  c.repo = {
    selection: async () => ({
      id: crypto.randomUUID(),
      status: "awaiting_confirmation",
    }),
  } as unknown as Context["repo"];
  for (const action of ["eaten", "changed"])
    await assert.rejects(
      confirmMeal(c, {
        selectionId: crypto.randomUUID(),
        action,
        changedText: "마약",
        timezone: "Asia/Seoul",
      }),
      { code: "OFFICIAL_FOOD_REQUIRED" },
    );
});
test("legacy free-text meal edits must select an official replacement", async () => {
  const old = { items: [{ foodId: null }], raw: "우라늄" } as unknown as Meal;
  await assert.rejects(
    makeMeal(
      context(),
      { ...draft(), raw: old.raw, foodId: null },
      "legacy",
      "live",
      old,
    ),
    { code: "OFFICIAL_FOOD_REQUIRED" },
  );
});
