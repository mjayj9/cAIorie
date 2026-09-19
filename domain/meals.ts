import type {
  HistoryAnalysis,
  Meal,
  MealItem,
  Observation,
  SelectionStatus,
} from "./models.ts";
export function localDate(now: Date, timezone = "Asia/Seoul") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
export function shiftDay(day: string, offset: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
const foods: Record<string, { groups: string[]; cooking: string | null }> = {
  계란: { groups: ["달걀"], cooking: null },
  밥: { groups: ["곡류"], cooking: null },
  김치: { groups: ["채소"], cooking: null },
  비빔밥: { groups: ["곡류"], cooking: null },
  돈가스: { groups: [], cooking: "튀김" },
  돈까스: { groups: [], cooking: "튀김" },
  샐러드: { groups: ["채소"], cooking: null },
  두부: { groups: ["콩류"], cooking: null },
};
export function parseMealText(raw: string): MealItem[] {
  return raw
    .replace(/^(오늘|어제)\s*(아침|점심|저녁|간식)?\s*/, "")
    .split(/[,/\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((text) => {
      const match = text.match(
        /^(.*?)\s*(\d+(?:\.\d+)?|반)\s*(개|공기|g|그램|ml|밀리리터|인분)\s*$/i,
      );
      const name = match?.[1]?.trim() || text,
        tags = foods[name];
      return {
        name,
        amount: match ? (match[2] === "반" ? 0.5 : Number(match[2])) : null,
        unit: match?.[3] ?? null,
        foodId: null,
        foodGroups: tags?.groups ?? [],
        cooking: tags?.cooking ?? null,
        nutrition: {},
        tagBasis: tags
          ? "음식명에 대한 보수적 분류; 실제 성분 확인 아님"
          : null,
      };
    });
}
export function analyzeHistory(meals: Meal[], today: string): HistoryAnalysis {
  const start = shiftDay(today, -6),
    confirmed = meals.filter(
      (m) =>
        m.status === "confirmed" &&
        m.confirmedAt &&
        m.day >= start &&
        m.day <= today,
    );
  const counts = new Map<string, number>(),
    methods = new Map<string, number>(),
    groups = new Set<string>();
  for (const meal of confirmed)
    for (const food of meal.items) {
      counts.set(food.name, (counts.get(food.name) ?? 0) + 1);
      food.foodGroups.forEach((g) => groups.add(g));
      if (food.cooking)
        methods.set(food.cooking, (methods.get(food.cooking) ?? 0) + 1);
    }
  return {
    mealCount: confirmed.length,
    validDays: new Set(confirmed.map((m) => m.day)).size,
    todayCount: confirmed.filter((m) => m.day === today).length,
    dates: Array.from({ length: 7 }, (_, i) => {
      const day = shiftDay(start, i);
      return {
        day,
        count: confirmed.filter((m) => m.day === day).length || null,
      };
    }),
    repetitions: [...counts]
      .filter(([, n]) => n > 1)
      .map(([name, count]) => ({ name, count })),
    foodGroups: [...groups],
    cooking: [...methods].map(([name, count]) => ({ name, count })),
    score: null,
    scoreStatus: confirmed.length
      ? "평가 기준 확인 중"
      : "분석할 기록이 부족해요",
  };
}
export function transitionSelection(
  current: SelectionStatus,
  action: "eaten" | "changed" | "not_eaten" | "later",
  expired = false,
): SelectionStatus {
  if (current !== "awaiting_confirmation") return current;
  if (expired) return "expired_unconfirmed";
  return action === "eaten"
    ? "confirmed_eaten"
    : action === "changed"
      ? "changed_meal"
      : action === "not_eaten"
        ? "explicitly_not_eaten"
        : current;
}
export function nutritionForAmount(
  value: Observation<number>,
  grams: number | null,
): Observation<number> {
  if (value.value === null || grams === null || value.unit !== "per_100g")
    return {
      ...value,
      value: null,
      status: "unknown",
      basis: "섭취량 또는 분량 기준 미확인",
    };
  return {
    ...value,
    value: (value.value * grams) / 100,
    status: value.status === "demo" ? "demo" : "estimated",
    basis: grams + "g 기준 추정",
    unit: "consumed",
  };
}
