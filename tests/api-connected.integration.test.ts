import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../domain/defaults.ts";
import { localDate } from "../domain/meals.ts";
import type { CatalogFood, RegistryLookup } from "../domain/foods.ts";
import type { Meal, SessionState } from "../domain/models.ts";
import type { MealParseResult } from "../providers/ai.ts";
const active = process.env.RUN_CONNECTED_API_TESTS === "1";
const base = process.env.TEST_BASE_URL ?? "http://localhost:5173";
async function client() {
  let cookie = "",
    csrf = "";
  async function send<T>(path: string, data?: unknown) {
    const r = await fetch(base + "/api/" + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        Cookie: cookie,
        ...(data === undefined
          ? {}
          : {
              Origin: base,
              "Content-Type": "application/json",
              "X-CSRF-Token": csrf,
            }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    const body = (await r.json()) as T & { csrf?: string; code?: string };
    if (body.csrf) csrf = body.csrf;
    return { status: r.status, body };
  }
  await send("state");
  const state = initialState();
  state.profile.ageBand = "adult";
  state.profile.allergyStatus = "none";
  state.consents.saveMeals = true;
  state.consents.savePreferences = true;
  const setup = await send("settings", {
    profile: state.profile,
    settings: state.settings,
    consents: state.consents,
  });
  assert.equal(setup.status, 200);
  return {
    send,
    state,
    async clean() {
      assert.equal((await send("privacy/delete", {})).status, 200);
    },
  };
}
test(
  "LIVE integrations: official food search, verified server-side reference, nutrition storage and edit",
  { skip: !active, timeout: 60000 },
  async () => {
    const c = await client();
    try {
      const search = await c.send<{ mode: string; items: CatalogFood[] }>(
        "foods?q=" + encodeURIComponent("쌀밥"),
      );
      assert.equal(search.status, 200);
      assert.equal(search.body.mode, "live");
      const food = search.body.items.find(
        (f) => f.name === "쌀밥" && f.basisGrams === 100,
      );
      assert.ok(food);
      const draft = {
        raw: food.name,
        foodId: food.id,
        amount: 150,
        unit: "g",
        source: "search",
        day: localDate(new Date()),
        slot: "lunch",
        timezone: "Asia/Seoul",
        status: "confirmed",
        idempotencyKey: crypto.randomUUID(),
      };
      const save = await c.send<{ meal: Meal; stored: boolean }>(
        "meals",
        draft,
      );
      assert.equal(save.status, 200);
      assert.equal(save.body.stored, true);
      assert.equal(
        save.body.meal.items[0].nutrition.energy.value,
        Math.round(food.nutrition.energy.value! * 1.5 * 100) / 100,
      );
      assert.equal(
        save.body.meal.items[0].nutrition.energy.status,
        "estimated",
      );
      assert.equal(
        save.body.meal.items[0].foodReference?.sourceUrl,
        food.sourceUrl,
      );
      const repeat = await c.send<{ meal: Meal }>("meals", draft);
      assert.equal(repeat.body.meal.id, save.body.meal.id);
      const edit = await c.send<{ meal: Meal }>("meals/edit", {
        id: save.body.meal.id,
        draft: { ...draft, amount: null, unit: null },
      });
      assert.equal(edit.status, 200);
      assert.equal(edit.body.meal.items[0].nutrition.energy.value, null);
      const invalid = await c.send("meals", {
        ...draft,
        foodId: "mfds:not-a-real-food",
        idempotencyKey: crypto.randomUUID(),
      });
      assert.equal(invalid.status, 400);
      assert.equal(invalid.body.code, "FOOD_MISMATCH");
      const unsupported = await c.send("meals", {
        ...draft,
        unit: "공기",
        idempotencyKey: crypto.randomUUID(),
      });
      assert.equal(unsupported.status, 400);
      const injection = await c.send("meals", {
        ...draft,
        nutrition: { energy: 1 },
      });
      assert.equal(injection.status, 400);
    } finally {
      await c.clean();
    }
  },
);
test(
  "LIVE integrations: OpenRouter requires consent and generates valid meal fragments",
  { skip: !active, timeout: 60000 },
  async () => {
    const c = await client();
    try {
      const text = "쌀밥 100g 그리고 두부 50g";
      const before = await c.send<MealParseResult>("meals/parse", { text });
      assert.equal(before.body.method, "conservative_rules");
      c.state.consents.externalAi = true;
      assert.equal(
        (
          await c.send("settings", {
            profile: c.state.profile,
            settings: c.state.settings,
            consents: c.state.consents,
          })
        ).status,
        200,
      );
      const saved = await c.send<{ state: SessionState }>("state");
      assert.equal(saved.body.state.consents.externalAi, true);
      const parsed = await c.send<MealParseResult>("meals/parse", { text });
      assert.equal(parsed.status, 200);
      assert.equal(parsed.body.method, "openrouter");
      assert.deepEqual(
        parsed.body.items.map((i) => [i.name, i.amount, i.unit]),
        [
          ["쌀밥", 100, "g"],
          ["두부", 50, "g"],
        ],
      );
      assert.ok(
        parsed.body.items.every((i) => Object.keys(i.nutrition).length === 0),
      );
      const teen = await c.send("settings", {
        profile: { ...c.state.profile, ageBand: "teen" },
        settings: c.state.settings,
        consents: c.state.consents,
      });
      assert.equal(teen.status, 409);
    } finally {
      await c.clean();
    }
  },
);
test(
  "LIVE integrations: registry authentication and exact public branch match",
  { skip: !active, timeout: 40000 },
  async () => {
    const c = await client();
    try {
      const response = await c.send<RegistryLookup>("places/registry", {
        name: "이자카야아카리",
        address: "제주특별자치도 제주시 북성로 65, 1층 (삼도이동)",
      });
      assert.equal(response.status, 200);
      assert.equal(response.body.matched, true);
      assert.equal(response.body.administrativeStatus, "active");
      assert.equal(
        response.body.sourceUrl,
        "https://www.data.go.kr/data/15154916/openapi.do",
      );
      assert.match(response.body.notice, /현재 영업시간/);
    } finally {
      await c.clean();
    }
  },
);

test(
  "LIVE integrations: only official foods can be saved or edited and revisions persist",
  { skip: !active, timeout: 60000 },
  async () => {
    const c = await client();
    try {
      const base = {
        raw: "우라늄",
        foodId: null,
        source: "manual",
        amount: null,
        unit: null,
        day: localDate(new Date()),
        slot: "lunch",
        timezone: "Asia/Seoul",
        status: "confirmed",
        idempotencyKey: crypto.randomUUID(),
      };
      for (const raw of ["우라늄", "마약"]) {
        const response = await c.send("meals", { ...base, raw });
        assert.equal(response.status, 400);
        assert.equal(response.body.code, "OFFICIAL_FOOD_REQUIRED");
      }
      const search = await c.send<{ items: CatalogFood[] }>(
        "foods?q=" + encodeURIComponent("쌀밥"),
      );
      const food = search.body.items.find((f) => f.name === "쌀밥")!;
      assert.ok(food);
      const official = {
        ...base,
        raw: food.name,
        foodId: food.id,
        source: "search",
        amount: 100,
        unit: "g",
      };
      const tampered = await c.send("meals", { ...official, raw: "우라늄" });
      assert.equal(tampered.status, 400);
      assert.equal(tampered.body.code, "FOOD_MISMATCH");
      const saved = await c.send<{ meal: Meal }>("meals", official);
      assert.equal(saved.status, 200);
      const forgedEdit = await c.send("meals/edit", {
        id: saved.body.meal.id,
        draft: { ...base, raw: "마약" },
      });
      assert.equal(forgedEdit.status, 400);
      const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(
        "en-CA",
        { timeZone: "Asia/Seoul" },
      );
      const edited = await c.send("meals/edit", {
        id: saved.body.meal.id,
        draft: { ...official, day: yesterday, slot: "dinner", amount: 200 },
      });
      assert.equal(edited.status, 200);
      const fresh = await c.send<{ meals: Meal[] }>("state");
      assert.equal(fresh.body.meals.length, 1);
      assert.equal(fresh.body.meals[0].raw, food.name);
      assert.equal(fresh.body.meals[0].items[0].amount, 200);
      assert.equal(fresh.body.meals[0].day, yesterday);
      assert.equal(fresh.body.meals[0].slot, "dinner");
    } finally {
      await c.clean();
    }
  },
);
