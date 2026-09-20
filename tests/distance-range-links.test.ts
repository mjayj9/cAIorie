import test from "node:test";
import assert from "node:assert/strict";
import { conditionsSchema } from "../domain/schemas.ts";
import { initialState } from "../domain/defaults.ts";
import { rankPlaces } from "../domain/place-ranking.ts";
import { evaluateCandidate } from "../domain/ranking.ts";
import { normalizeKakao, searchKakao } from "../providers/places.ts";
import { kakaoDirections, telephoneHref } from "../domain/place-links.ts";
import { demoPlaces, DEMO_CENTER } from "../fixtures/demo.ts";
const origin = {
  ...DEMO_CENTER,
  origin: "user_selected" as const,
  label: "출발, 서울역",
};
const documents = [999, 1000, 1500, 2000, 2001].map((distance, i) => ({
  id: String(i + 1),
  place_name: "식당 " + i,
  address_name: "서울",
  road_address_name: "서울",
  x: "126.98",
  y: "37.56",
  distance: String(distance),
  place_url: "http://place.map.kakao.com/" + (i + 1),
}));
test("range validation rejects reversed bounds and upgrades old maximum-only settings", () => {
  const c = initialState().settings.conditions;
  assert.equal(
    conditionsSchema.safeParse({ ...c, minDistance: 2000, maxDistance: 1000 })
      .success,
    false,
  );
  assert.equal(
    conditionsSchema.safeParse({ ...c, minDistance: 1000, maxDistance: 1000 })
      .success,
    true,
  );
  const { minDistance: unused, ...old } = c;
  void unused;
  assert.equal(conditionsSchema.parse(old).minDistance, 0);
});
test("restaurant and menu filters enforce inclusive lower and upper bounds", () => {
  const s = initialState();
  s.profile.allergyStatus = "none";
  const conditions = {
    ...s.settings.conditions,
    minDistance: 1000,
    maxDistance: 2000,
  };
  const source = normalizeKakao({ documents }).places;
  assert.deepEqual(
    rankPlaces(source, [
      { profile: s.profile, conditions, settings: s.settings },
    ]).map((c) => c.place.distance.value),
    [1000, 1500, 2000],
  );
  for (const distance of [999, 2001]) {
    const place = structuredClone(demoPlaces[0]);
    place.distance.value = distance;
    const result = evaluateCandidate(
      place,
      place.menus[0],
      s.profile,
      conditions,
      s.settings,
      [],
      s.learning,
    );
    assert.equal(result.candidateStatus, "excluded");
  }
});
test("range discovery searches outer rectangles and deduplicates in-range restaurants", async (t) => {
  const calls: URL[] = [];
  t.mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => {
    calls.push(new URL(String(url)));
    return Response.json({ documents, meta: { is_end: true } });
  });
  const result = await searchKakao(
    {
      demoMode: false,
      kakaoKey: "test-kakao-key",
      googleKey: "",
      encryptionKey: "",
      aiKey: "",
      aiProvider: "",
      aiModel: "",
    },
    origin,
    2000,
    undefined,
    "",
    1000,
  );
  assert.equal(calls.length, 4);
  assert.ok(
    calls.every(
      (u) => u.searchParams.has("rect") && !u.searchParams.has("radius"),
    ),
  );
  assert.deepEqual(
    result.places.map((p) => p.distance.value),
    [1000, 1500, 2000],
  );
});
test("Kakao directions preserve the selected origin, destination and encoded names", () => {
  const place = normalizeKakao({ documents }, origin).places[0];
  const url = new URL(place.directionsUrl!);
  assert.equal(url.origin, "https://map.kakao.com");
  const sections = url.pathname.split("/");
  assert.equal(sections[2], "from");
  assert.equal(sections[4], "to");
  assert.equal(
    decodeURIComponent(sections[3]),
    origin.label + "," + origin.latitude + "," + origin.longitude,
  );
  assert.equal(
    decodeURIComponent(sections[5]),
    place.name + "," + place.latitude + "," + place.longitude,
  );
  assert.ok(kakaoDirections(place)?.includes("/link/to/"));
  assert.ok(place.url?.startsWith("https://place.map.kakao.com/"));
});
test("telephone links accept real numbers without allowing arbitrary URI content", () => {
  assert.equal(telephoneHref("02-123-4567"), "tel:021234567");
  assert.equal(telephoneHref("+82 (2) 1234-5678"), "tel:+82212345678");
  for (const invalid of [
    undefined,
    "",
    "javascript:alert(1)",
    "123",
    "02-123-4567?x=1",
  ])
    assert.equal(telephoneHref(invalid), null);
});
