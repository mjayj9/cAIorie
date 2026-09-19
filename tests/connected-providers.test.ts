import test from "node:test";
import assert from "node:assert/strict";
import { normalizeFood, nutrientNumber } from "../providers/nutrition.ts";
import { nutritionForGrams } from "../domain/foods.ts";
import { publicDataItems } from "../providers/public-data.ts";
import { matchRegistryRecord } from "../providers/registry.ts";
import { parseWithOpenRouter, validateFragments } from "../providers/ai.ts";
import { parse } from "../server/api/meals.ts";
import { initialState } from "../domain/defaults.ts";
import type { Context } from "../server/context.ts";

const food = () =>
  normalizeFood({
    FOOD_CD: "test-rice",
    FOOD_NM_KR: "쌀밥",
    SERVING_SIZE: "100g",
    AMT_NUM1: "166.000",
    AMT_NUM2: "58.90",
    AMT_NUM3: "3.36",
    AMT_NUM4: "0.32",
    AMT_NUM6: "37.1",
    AMT_NUM7: null,
    AMT_NUM13: "0.00",
    UPDATE_DATE: "2025-01-23",
  })!;
test("MFDS fields preserve true zero, missing data, and protein versus water", () => {
  const f = food();
  assert.equal(f.nutrition.protein.value, 3.36);
  assert.equal(f.nutrition.sodium.value, 0);
  assert.equal(f.nutrition.sodium.unit, "mg");
  assert.equal(f.nutrition.sugars.value, null);
  for (const missing of ["", null, undefined, "Tr", "-", "-1", NaN, Infinity])
    assert.equal(nutrientNumber(missing), null);
});
test("nutrition is scaled only by explicit grams and documented reference weight", () => {
  assert.equal(nutritionForGrams(food(), 150).energy.value, 249);
  assert.equal(nutritionForGrams(food(), 150).energy.status, "estimated");
  assert.equal(nutritionForGrams(food(), 150).energy.unit, "kcal");
  assert.equal(nutritionForGrams(food(), null).energy.value, null);
  assert.equal(
    nutritionForGrams({ ...food(), basisGrams: null }, 150).energy.value,
    null,
  );
  assert.equal(nutritionForGrams(food(), 150).sugars.value, null);
  assert.equal(nutritionForGrams(food(), 150).sodium.value, 0);
  assert.equal(
    normalizeFood({
      FOOD_CD: "milk",
      FOOD_NM_KR: "우유",
      SERVING_SIZE: "100ml",
    })!.basisGrams,
    null,
  );
});
test("public data accepts both authenticated envelopes and rejects HTTP 200 logical errors", () => {
  const row = { FOOD_CD: "example" };
  assert.deepEqual(
    publicDataItems({ header: { resultCode: "00" }, body: { items: [row] } }),
    [row],
  );
  assert.deepEqual(
    publicDataItems({
      response: { header: { resultCode: "0" }, body: { items: { item: row } } },
    }),
    [row],
  );
  assert.deepEqual(
    publicDataItems({ header: { resultCode: "00" }, body: { items: "" } }),
    [],
  );
  assert.throws(() =>
    publicDataItems({ header: { resultCode: "30" }, body: { items: [row] } }),
  );
  assert.throws(() => publicDataItems({ body: { items: [row] } }));
});
const place = { name: "샘플 식당", address: "서울 중구 샘플로 10, 2층" };
const record = {
  MNG_NO: "record-1",
  BPLC_NM: "샘플식당",
  ROAD_NM_ADDR: "서울특별시 중구 샘플로 10, 2층",
  SALS_STTS_NM: "영업/정상",
};
test("registry requires exact branch identity, including address and floor", () => {
  assert.equal(
    matchRegistryRecord(place, [record]).administrativeStatus,
    "active",
  );
  assert.equal(
    matchRegistryRecord({ ...place, address: "서울 중구 샘플로 10, 1층" }, [
      record,
    ]).matched,
    false,
  );
  assert.equal(
    matchRegistryRecord({ ...place, name: "샘플 식당 다른지점" }, [record])
      .matched,
    false,
  );
  assert.equal(
    matchRegistryRecord(place, [record, { ...record, MNG_NO: "record-2" }])
      .matched,
    false,
  );
  assert.equal(
    matchRegistryRecord(place, [{ ...record, SALS_STTS_NM: "폐업" }])
      .administrativeStatus,
    "closed",
  );
  assert.equal(matchRegistryRecord(place, []).administrativeStatus, "unknown");
});
test("AI fragments cannot add, rewrite, overlap or reorder the user's text", () => {
  const input = "쌀밥 100g 그리고 두부 50g";
  assert.deepEqual(
    validateFragments(input, { fragments: ["쌀밥 100g", "두부 50g"] }),
    ["쌀밥 100g", "두부 50g"],
  );
  for (const fragments of [
    ["쌀밥 200g"],
    ["김치"],
    ["두부 50g", "쌀밥 100g"],
    ["쌀밥", "쌀밥"],
    [],
  ])
    assert.throws(() => validateFragments(input, { fragments }));
  assert.throws(() =>
    validateFragments(input, { fragments: ["쌀밥"], nutrition: 999 }),
  );
});
const config = {
  demoMode: false,
  kakaoKey: "",
  googleKey: "",
  encryptionKey: "",
  aiProvider: "openrouter",
  aiKey: "test-ai-key",
  aiBaseUrl: "https://openrouter.ai/api/v1",
  aiModel: "openrouter/free",
};
test("external AI request is restricted to the approved host, free model and current text", async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(init?.redirect, "manual");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "openrouter/free");
    assert.equal(body.messages.length, 2);
    assert.equal(body.messages[1].content, "쌀밥 100g 그리고 두부 50g");
    assert.deepEqual(body.provider, {
      require_parameters: true,
      data_collection: "deny",
    });
    assert.equal("profile" in body, false);
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify({ fragments: ["쌀밥 100g", "두부 50g"] }),
          },
        },
      ],
    });
  };
  try {
    const result = await parseWithOpenRouter(
      config,
      "쌀밥 100g 그리고 두부 50g",
    );
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].amount, 100);
    assert.deepEqual(result.items[0].nutrition, {});
  } finally {
    globalThis.fetch = previous;
  }
});
test("absent AI consent and teenage profiles never trigger an external request", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error("unexpected");
  };
  try {
    for (const [ageBand, externalAi] of [
      ["adult", false],
      ["teen", true],
    ] as const) {
      const state = initialState();
      state.onboarded = true;
      state.profile.ageBand = ageBand;
      state.consents.externalAi = externalAi;
      const result = await parse(
        { state, config, request: new Request("http://localhost") } as Context,
        { text: "밥, 두부" },
      );
      assert.equal(result.method, "conservative_rules");
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = previous;
  }
});
