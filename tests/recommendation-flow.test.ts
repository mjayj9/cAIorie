import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../domain/defaults.ts";
import { DEMO_CENTER } from "../fixtures/demo.ts";
import { recommend, type RecommendInput } from "../server/orchestrator.ts";
import {
  geocodeKakao,
  normalizeKakao,
  searchGoogle,
} from "../providers/places.ts";
import { rankPlaces } from "../domain/place-ranking.ts";
import type { ProviderConfig } from "../providers/contracts.ts";
const config: ProviderConfig = {
  demoMode: false,
  kakaoKey: "test-only-key",
  googleKey: "test-only-key",
  encryptionKey: "",
  aiKey: "",
  aiProvider: "",
  aiModel: "",
};
const fresh = (): RecommendInput => {
  const s = initialState();
  return {
    profile: { ...s.profile, ageBand: "adult", allergyStatus: "none" },
    conditions: s.settings.conditions,
    settings: s.settings,
    mode: "live",
    location: {
      ...DEMO_CENTER,
      origin: "user_selected",
      capturedAt: new Date().toISOString(),
    },
    skipYesterday: true,
    groupId: null,
  };
};
const places = [250, 420, 620].map((distance, i) => ({
  id: "test-" + i,
  place_name: "한식 식당 " + i,
  address_name: "서울 중구",
  road_address_name: "서울 중구 시험길 " + i,
  x: "126.978",
  y: "37.5665",
  distance: String(distance),
  place_url: "https://place.map.kakao.com/" + i,
  category_name: "음식점 > 한식",
  phone: "02-123-4567",
}));

test("screenshot regression: 15 metres offers a useful radius without an irrelevant budget increase", async () => {
  const input = fresh();
  input.mode = "demo";
  input.conditions = {
    ...input.conditions,
    budget: 25000,
    maxDistance: 15,
    availableMinutes: 60,
    returnTrip: true,
    serviceMode: "takeout",
  };
  const result = await recommend(input, initialState(), [], config);
  assert.equal(result.status, "no_match");
  assert.deepEqual(
    result.proposals.map((p) => p.field),
    ["maxDistance"],
  );
  const proposal = result.proposals[0];
  assert.equal(proposal.before, 15);
  assert.equal(proposal.after, 700);
  assert.equal(proposal.verifiedAdditionalCandidates, 3);
  const next = await recommend(
    {
      ...input,
      conditions: { ...input.conditions, maxDistance: proposal.after },
    },
    initialState(),
    [],
    config,
  );
  assert.equal(next.conditionalCandidates.length, 3);
  assert.equal(next.status, "partial");
  assert.equal(input.conditions.maxDistance, 15);
});

test("two simultaneous blockers produce no false one-click improvement", async () => {
  const input = fresh();
  input.mode = "demo";
  input.conditions = { ...input.conditions, budget: 100, maxDistance: 15 };
  const result = await recommend(input, initialState(), [], config);
  assert.equal(result.proposals.length, 0);
});

test("real food search returns actionable places without inventing menus, prices or safety", async (t) => {
  const requests: URL[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    requests.push(new URL(url));
    return Response.json({ documents: places });
  });
  const input = fresh();
  input.conditions = {
    ...input.conditions,
    budget: 15000,
    maxDistance: 1000,
    craving: "한식",
    serviceMode: "takeout",
  };
  const result = await recommend(input, initialState(), [], config);
  assert.equal(requests[0].pathname, "/v2/local/search/keyword.json");
  assert.equal(requests[0].searchParams.get("query"), "한식");
  assert.equal(requests[0].searchParams.get("category_group_code"), "FD6");
  assert.equal(result.placeCandidates.length, 3);
  assert.equal(result.recommendations.length, 0);
  assert.equal(result.proposals.length, 0);
  assert.equal(result.status, "partial");
  assert.ok(
    result.placeCandidates.every(
      (c) =>
        c.place.menus.length === 0 &&
        c.checks.includes("1인 예산 이내의 메뉴") &&
        c.checks.includes("포장 가능 여부"),
    ),
  );
  assert.deepEqual(
    result.placeCandidates.map((c) => c.place.distance.value),
    [250, 420, 620],
  );
});

test("empty narrow live search probes once and offers only verified additional places", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async (url: string) => {
    calls++;
    const radius = Number(new URL(url).searchParams.get("radius"));
    return Response.json({
      documents: places.filter((p) => Number(p.distance) <= radius),
    });
  });
  const input = fresh();
  input.conditions = { ...input.conditions, maxDistance: 15, budget: 25000 };
  const result = await recommend(input, initialState(), [], config);
  assert.equal(calls, 2);
  assert.equal(result.nearbyPlaces.length, 0);
  assert.equal(result.placeCandidates.length, 0);
  assert.equal(result.proposals.length, 1);
  assert.equal(result.proposals[0].after, 700);
  assert.equal(result.proposals[0].verifiedAdditionalCandidates, 3);
  const next = await recommend(
    { ...input, conditions: { ...input.conditions, maxDistance: 700 } },
    initialState(),
    [],
    config,
  );
  assert.equal(next.placeCandidates.length, 3);
});

test("unknown prices alone never produce budget relaxation and empty expanded search never invents counts", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ documents: [] }),
  );
  const input = fresh();
  input.conditions = { ...input.conditions, budget: 25000, maxDistance: 15 };
  const result = await recommend(input, initialState(), [], config);
  assert.equal(result.status, "no_match");
  assert.equal(result.proposals.length, 0);
});

test("real location is requested before optional meal history, without a provider call", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("should not call");
  });
  const result = await recommend(
    { ...fresh(), location: DEMO_CENTER, skipYesterday: false },
    initialState(),
    [],
    config,
  );
  assert.equal(result.status, "needs_input");
  assert.equal(result.question, null);
  assert.equal(fetch.mock.calls.length, 0);
});

test("restaurant discovery respects group exclusions and labels severe restrictions as inquiry only", () => {
  const input = fresh();
  const source = normalizeKakao({ documents: places }).places;
  const host = {
    profile: input.profile,
    conditions: input.conditions,
    settings: input.settings,
  };
  assert.equal(
    rankPlaces(source, [
      host,
      { ...host, profile: { ...host.profile, excluded: ["한식"] } },
    ]).length,
    0,
  );
  const restricted = {
    ...host,
    profile: {
      ...host.profile,
      allergyStatus: "provided" as const,
      restrictions: [
        {
          kind: "food_allergy" as const,
          value: "땅콩",
          history: "severe_or_trace_sensitive" as const,
        },
      ],
    },
  };
  const result = rankPlaces(source, [restricted]);
  assert.equal(result.length, 3);
  assert.ok(result.every((c) => c.inquiryOnly && c.warnings.length > 0));
});

test("known closed or out-of-radius restaurants are filtered, never shown as valid choices", () => {
  const input = fresh();
  const source = normalizeKakao({ documents: places }).places;
  source[0].operatingStatus.value = "closed";
  const result = rankPlaces(source, [
    {
      profile: input.profile,
      conditions: { ...input.conditions, maxDistance: 500 },
      settings: input.settings,
    },
  ]);
  assert.deepEqual(
    result.map((c) => c.place.id),
    ["kakao:test-1"],
  );
});

test("station names fall back to keyword location lookup and return a human-readable label", async (t) => {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    requests.push(new URL(url).pathname);
    return Response.json({
      documents: url.includes("address.json")
        ? []
        : [
            {
              place_name: "서울역",
              address_name: "서울 용산구",
              x: "126.97",
              y: "37.55",
            },
          ],
    });
  });
  const result = await geocodeKakao(config, "서울역");
  assert.equal(requests.length, 2);
  assert.ok(requests[1].endsWith("keyword.json"));
  assert.equal(result[0].name, "서울역 · 서울 용산구");
});

test("Google coordinates produce labelled straight-line distance, not an invented travel time", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      places: [
        {
          id: "test",
          displayName: { text: "restaurant" },
          location: { latitude: 37.5675, longitude: 126.978 },
        },
      ],
    }),
  );
  const result = await searchGoogle(config, fresh().location!, 1000);
  assert.ok(
    result.places[0].distance.value! >= 110 &&
      result.places[0].distance.value! <= 112,
  );
  assert.equal(result.places[0].distance.status, "estimated");
  assert.equal(result.places[0].travelMinutes.value, null);
});
