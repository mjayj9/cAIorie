import type { Evidence, Menu, Observation, Place } from "../domain/models.ts";
export const DEMO_CENTER = {
  latitude: 37.5665,
  longitude: 126.978,
  accuracyMeters: null,
  capturedAt: "2026-09-19T00:00:00Z",
  origin: "demo" as const,
  country: "KR",
};
export function demoValue<T>(
  value: T | null,
  evidenceId: string,
  unit?: string,
): Observation<T> {
  return {
    value,
    status: value === null ? "unknown" : "demo",
    evidenceIds: value === null ? [] : [evidenceId],
    unit,
    checkedAt: "2026-09-19T00:00:00Z",
    basis: "가상 데이터 · 실제 음식점 정보 아님",
  };
}
type Row = {
  id: string;
  name: string;
  distance: number;
  rating: number | null;
  reviews: number | null;
  price: number | null;
  menu: string;
  cuisine: string;
  ingredients: string[] | null;
  cooking: string | null;
  image: string | null;
};
const rows: Row[] = [
  {
    id: "d1",
    name: "초록식탁",
    distance: 250,
    rating: 4.7,
    reviews: 124,
    price: 9600,
    menu: "비빔밥",
    cuisine: "한식",
    ingredients: ["쌀", "달걀", "대두", "소고기"],
    cooking: "비빔",
    image: "/images/lunch-bibimbap.png",
  },
  {
    id: "d2",
    name: "소담한 그릇",
    distance: 420,
    rating: 4.5,
    reviews: 82,
    price: 11000,
    menu: "두부 버섯 덮밥",
    cuisine: "한식",
    ingredients: ["쌀", "대두", "버섯"],
    cooking: "볶음",
    image: null,
  },
  {
    id: "d3",
    name: "오후의 면",
    distance: 620,
    rating: 4.6,
    reviews: 213,
    price: 10000,
    menu: "온소바",
    cuisine: "일식",
    ingredients: ["메밀", "밀", "대두", "생선"],
    cooking: "삶음",
    image: null,
  },
  {
    id: "d4",
    name: "바삭한 하루",
    distance: 800,
    rating: 4.4,
    reviews: 63,
    price: 12000,
    menu: "등심 돈가스",
    cuisine: "일식",
    ingredients: ["돼지고기", "밀", "달걀", "우유"],
    cooking: "튀김",
    image: null,
  },
  {
    id: "d5",
    name: "담백한 부엌",
    distance: 1100,
    rating: 4.3,
    reviews: 37,
    price: 13000,
    menu: "닭구이와 밥",
    cuisine: "한식",
    ingredients: ["닭고기", "쌀"],
    cooking: "구이",
    image: null,
  },
  {
    id: "d6",
    name: "작은 점심",
    distance: 720,
    rating: null,
    reviews: null,
    price: null,
    menu: "오늘의 카레",
    cuisine: "기타",
    ingredients: null,
    cooking: null,
    image: null,
  },
];
export const demoEvidence: Evidence[] = rows.map((r) => ({
  id: "ev-" + r.id,
  providerId: "demo-fixture",
  sourceUrl: null,
  retrievedAt: "2026-09-19T00:00:00Z",
  appliesToPlaceId: r.id,
  appliesToMenuId: null,
  attribution: "한끼로그 가상 시연 자료",
  storageAllowed: true,
}));
export const demoPlaces: Place[] = rows.map((r, index) => {
  const ev = "ev-" + r.id,
    o = <T>(v: T | null, unit?: string) => demoValue(v, ev, unit),
    allergens: Menu["allergens"] = {};
  for (const a of [
    "땅콩",
    "우유",
    "달걀",
    "밀",
    "대두",
    "메밀",
    "생선",
    "새우",
    "돼지고기",
    "닭고기",
  ])
    allergens[a] = r.ingredients?.includes(a)
      ? "contains"
      : r.id === "d2" || r.id === "d5"
        ? "documented_handling"
        : "unknown";
  const menu: Menu = {
    id: r.id + "-m1",
    placeId: r.id,
    name: r.menu,
    cuisine: r.cuisine,
    ingredients: r.ingredients,
    foodGroups: r.ingredients?.includes("쌀") ? ["곡류"] : [],
    cooking: r.cooking,
    price: o<number>(r.price, "KRW"),
    allergens,
    nutrition: {},
    evidenceIds: [ev],
    image: r.image,
    popularity: o<number>(null),
  };
  return {
    id: r.id,
    name: r.name,
    address: "한끼동 시연길 " + (12 + index * 9),
    latitude:
      DEMO_CENTER.latitude +
      [0.002, -0.001, 0.004, -0.005, 0.007, 0.003][index],
    longitude:
      DEMO_CENTER.longitude +
      [0.002, -0.004, 0.006, 0.005, -0.007, -0.006][index],
    providerId: "demo-fixture",
    administrativeStatus: "active",
    operatingStatus: o<"open" | "closed" | "break">(
      r.id === "d6" ? null : "open",
    ),
    rating: o<number>(r.rating),
    ratingScale: 5,
    reviewCount: o<number>(r.reviews),
    recentReview: o<number>(null),
    reviewConsistency: o<number>(null),
    distance: o<number>(r.distance, "m"),
    distanceType: "straight_line",
    travelMinutes: o<number>(null, "min"),
    waitMinutes: o<number>(null, "min"),
    mealMinutes: o<number>(null, "min"),
    takeout: o<boolean>(true),
    partyCapacity: o<number>(r.id === "d3" ? 2 : 6),
    menus: [menu],
    url: null,
    directionsUrl: null,
    evidenceIds: [ev],
  };
});
demoPlaces[0].menus.push({
  ...demoPlaces[0].menus[0],
  id: "d1-m2",
  name: "버섯 비빔밥",
  ingredients: ["쌀", "대두", "버섯"],
  price: demoValue(9000, "ev-d1", "KRW"),
  image: null,
  allergens: { 대두: "contains" },
});
export const demoFoodCatalog = ["밥", "계란", "비빔밥", "돈가스", "샐러드"].map(
  (name, i) => ({
    id: "demo-food-" + (i + 1),
    name,
    kind: "general",
    basis: "분량 미상",
    provider: "데모 식품 카탈로그",
    nutrition: {},
  }),
);
