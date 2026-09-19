import type {
  Conditions,
  Place,
  PlaceCandidate,
  Profile,
  Settings,
} from "./models.ts";
import { formatDistance } from "./distance.ts";
const normalize = (s: string) =>
  s
    .replace(/돈까스/g, "돈가스")
    .replace(/\s/g, "")
    .toLowerCase();
type Person = { profile: Profile; conditions: Conditions; settings: Settings };
/** Place discovery has no menu, price or ingredient evidence. Keep it distinct from menu eligibility. */
export function rankPlaces(
  places: Place[],
  people: Person[],
): PlaceCandidate[] {
  return places
    .flatMap((place) => {
      if (
        place.menus.length ||
        ["closed", "suspended"].includes(place.administrativeStatus) ||
        ["closed", "break"].includes(place.operatingStatus.value ?? "")
      )
        return [];
      const text = normalize(place.name + " " + (place.category ?? ""));
      const reasons = new Set<string>();
      const checks = new Set<string>(["현재 메뉴·가격", "지금 영업 여부"]);
      const warnings = new Set<string>();
      let inquiryOnly = false,
        score = 0;
      for (const { profile, conditions: c, settings } of people) {
        if (profile.excluded.some((word) => text.includes(normalize(word))))
          return [];
        if (
          c.maxDistance !== null &&
          place.distance.value !== null &&
          place.distance.value > c.maxDistance
        )
          return [];
        if (
          c.minRating !== null &&
          place.rating.value !== null &&
          (place.rating.value / place.ratingScale) * 5 < c.minRating
        )
          return [];
        if (
          c.minReviews !== null &&
          place.reviewCount.value !== null &&
          place.reviewCount.value < c.minReviews
        )
          return [];
        if (c.serviceMode === "takeout" && place.takeout.value === false)
          return [];
        if (
          place.partyCapacity.value !== null &&
          place.partyCapacity.value < c.partySize
        )
          return [];
        const times = [
          place.travelMinutes.value,
          place.waitMinutes.value,
          place.mealMinutes.value,
        ];
        if (
          c.availableMinutes !== null &&
          times.every((v) => v !== null) &&
          times[0]! * (c.returnTrip ? 2 : 1) + times[1]! + times[2]! >
            c.availableMinutes
        )
          return [];
        if (c.craving) {
          if (normalize(place.matchedQuery ?? "") === normalize(c.craving))
            reasons.add(
              "‘" +
                c.craving +
                "’ 음식점 검색 결과예요. 실제 판매 메뉴는 확인해 주세요.",
            );
          else if (text.includes(normalize(c.craving)))
            reasons.add("이름·업종에 ‘" + c.craving + "’이 포함돼요.");
          else return [];
        }
        if (profile.likes.some((word) => text.includes(normalize(word)))) {
          score += 100 * settings.weights.taste;
          reasons.add("이름·업종이 설정한 선호 음식과 맞아요.");
        }
        if (profile.dislikes.some((word) => text.includes(normalize(word))))
          score -= 100 * settings.weights.taste;
        if (place.distance.value !== null)
          score +=
            (100 / (1 + place.distance.value / 500)) *
            settings.weights.distance;
        else checks.add("이동 거리");
        if (place.rating.value !== null)
          score +=
            (place.rating.value / place.ratingScale) *
            100 *
            settings.weights.rating;
        if (c.minRating !== null && place.rating.value === null)
          checks.add("평점 하한 충족 여부");
        if (c.minReviews !== null && place.reviewCount.value === null)
          checks.add("리뷰 수 하한 충족 여부");
        if (c.budget !== null) checks.add("1인 예산 이내의 메뉴");
        if (c.availableMinutes !== null) checks.add("이동·대기·식사 시간");
        if (c.serviceMode === "takeout" && place.takeout.value === null)
          checks.add("포장 가능 여부");
        if (c.partySize > 1 && place.partyCapacity.value === null)
          checks.add("동행 인원 수용");
        if (profile.excluded.length || profile.restrictions.length) {
          warnings.add(
            "성분·조리 정보가 없어 식사 제한 충족 여부는 확인하지 못했어요. 주문 전 식당에 확인해 주세요.",
          );
          checks.add("제외 음식·알레르기·조리 방식");
        }
        if (
          profile.restrictions.some(
            (r) => r.history === "severe_or_trace_sensitive",
          )
        )
          inquiryOnly = true;
        if (["unknown", "declined"].includes(profile.allergyStatus))
          warnings.add(
            "알레르기 정보를 입력하지 않아 개인 제한은 비교하지 않았어요.",
          );
      }
      if (place.distance.value !== null)
        reasons.add(
          "선택한 위치에서 직선 " + formatDistance(place.distance.value),
        );
      if (people.length > 1) checks.add("동행자별 메뉴·예산·식사 제한");
      return [
        {
          candidate: {
            place,
            reasons: [...reasons],
            checks: [...checks],
            warnings: [...warnings],
            inquiryOnly,
          },
          score,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.candidate.place.distance.value ?? Infinity) -
          (b.candidate.place.distance.value ?? Infinity) ||
        a.candidate.place.id.localeCompare(b.candidate.place.id),
    )
    .map(({ candidate }) => candidate);
}
