import type {
  Conditions,
  Learning,
  Meal,
  Place,
  Profile,
  RankedCandidate,
  Settings,
  Menu,
} from "./models.ts";
import { rankingPolicy } from "./defaults.ts";
import { evaluateSafety } from "./safety.ts";
import { boundedScore, weightedScore } from "./scoring.ts";
export function evaluateCandidate(
  place: Place,
  menu: Menu,
  profile: Profile,
  conditions: Conditions,
  settings: Settings,
  meals: Meal[],
  learning: Learning,
): RankedCandidate {
  const safety = evaluateSafety(menu, profile),
    missing: string[] = [],
    reasons: string[] = [];
  let status: RankedCandidate["candidateStatus"] =
    safety.status === "blocked"
      ? "excluded"
      : safety.status === "needs_confirmation"
        ? "conditional"
        : "eligible";
  const exclude = (message: string) => {
    status = "excluded";
    reasons.push(message);
  };
  const conditional = (message: string) => {
    if (status !== "excluded") status = "conditional";
    missing.push(message);
  };
  if (menu.placeId !== place.id) exclude("지점과 메뉴가 일치하지 않아요.");
  if (["closed", "suspended"].includes(place.administrativeStatus))
    exclude("행정상 휴·폐업 상태예요.");
  if (
    place.operatingStatus.value === "closed" ||
    place.operatingStatus.value === "break"
  )
    exclude("현재 운영시간 조건에 맞지 않아요.");
  if (place.operatingStatus.value === null) conditional("현재 운영 여부");
  const normalize = (s: string) => s.replace(/돈까스/g, "돈가스").toLowerCase();
  if (
    conditions.craving &&
    !normalize(menu.name + " " + menu.cuisine).includes(
      normalize(conditions.craving),
    )
  )
    exclude("오늘 먹고 싶은 음식과 다른 메뉴예요.");
  if (conditions.budget !== null) {
    if (menu.price.value === null) conditional("메뉴 가격");
    else if (menu.price.value > conditions.budget)
      exclude("1인 예산을 초과해요.");
  }
  if ((conditions.minDistance ?? 0) > 0 || conditions.maxDistance !== null) {
    if (place.distance.value === null) conditional("거리");
    else if (place.distance.value < (conditions.minDistance ?? 0))
      exclude("최소 이동 거리보다 가까워요.");
    else if (
      conditions.maxDistance !== null &&
      place.distance.value > conditions.maxDistance
    )
      exclude("최대 이동 거리를 초과해요.");
  }
  if (conditions.availableMinutes !== null) {
    const d = [
      place.travelMinutes.value,
      place.waitMinutes.value,
      place.mealMinutes.value,
    ];
    if (d.some((x) => x === null)) conditional("이동·대기·식사 시간");
    else if (
      d[0]! * (conditions.returnTrip ? 2 : 1) + d[1]! + d[2]! >
      conditions.availableMinutes
    )
      exclude("식사 가능 시간을 초과해요.");
  }
  if (conditions.serviceMode === "takeout") {
    if (place.takeout.value === null) conditional("포장 가능 여부");
    else if (!place.takeout.value) exclude("포장을 지원하지 않아요.");
  }
  if (conditions.partySize > 1) {
    if (place.partyCapacity.value === null) conditional("동행 인원 수용");
    else if (place.partyCapacity.value < conditions.partySize)
      exclude("확인된 수용 인원을 초과해요.");
  }
  if (conditions.minRating !== null) {
    if (place.rating.value === null) conditional("평점");
    else if (
      (place.rating.value / place.ratingScale) * 5 <
      conditions.minRating
    )
      exclude("설정한 평점 하한에 미달해요.");
  }
  if (conditions.minReviews !== null) {
    if (place.reviewCount.value === null) conditional("리뷰 수");
    else if (place.reviewCount.value < conditions.minReviews)
      exclude("설정한 리뷰 수 하한에 미달해요.");
  }
  const liked = profile.likes.some((p) =>
      (menu.name + " " + menu.cuisine).includes(p),
    ),
    disliked = profile.dislikes.some((p) =>
      (menu.name + " " + menu.cuisine).includes(p),
    );
  const repeats = meals
    .filter((m) => m.status === "confirmed")
    .flatMap((m) => m.items)
    .filter((i) => i.name === menu.name).length;
  const taste = Math.max(
    0,
    Math.min(
      100,
      60 +
        (liked ? 22 : 0) -
        (disliked ? 40 : 0) +
        (learning.taste[menu.cuisine] ?? 0) -
        (conditions.craving
          ? 0
          : Math.min(repeats, 2) * rankingPolicy.repetitionPenalty),
    ),
  );
  if (liked) reasons.push("설정한 선호 음식과 어울려요.");
  if (repeats && !conditions.craving)
    reasons.push(
      "기록에 같은 메뉴가 있어 취향 항목에서만 반복을 가볍게 반영했어요.",
    );
  const parts = {
    rating:
      place.rating.value === null
        ? null
        : (place.rating.value / place.ratingScale) * 100,
    count:
      place.reviewCount.value === null
        ? null
        : Math.min(100, Math.log10(place.reviewCount.value + 1) * 33.3),
    recency: place.recentReview.value,
    menuPraise: menu.popularity.value,
    consistency: place.reviewConsistency.value,
  };
  const keys = (Object.keys(parts) as (keyof typeof parts)[]).filter(
      (k) => parts[k] !== null && settings.ratingWeights[k] > 0,
    ),
    rw = keys.reduce((a, k) => a + settings.ratingWeights[k], 0);
  const rating = rw
    ? keys.reduce((a, k) => a + parts[k]! * settings.ratingWeights[k], 0) / rw
    : null;
  const criteria = {
    health: null,
    taste,
    price:
      conditions.budget !== null && menu.price.value !== null
        ? boundedScore(menu.price.value, conditions.budget)
        : null,
    distance:
      conditions.maxDistance !== null && place.distance.value !== null
        ? boundedScore(place.distance.value, conditions.maxDistance)
        : null,
    rating,
  };
  if (menu.price.value === null) missing.push("메뉴 가격");
  missing.push("검증된 건강 적합도");
  if (conditions.budget === null)
    reasons.push("예산 미설정: 가격으로 제한하지 않았어요.");
  if (conditions.maxDistance === null && !(conditions.minDistance > 0))
    reasons.push("이동 반경 미설정: 거리로 제한하지 않았어요.");
  if (!reasons.length)
    reasons.push("확인된 정보와 나의 중요도를 함께 반영했어요.");
  return {
    place,
    menu,
    safety,
    candidateStatus: status,
    ...weightedScore(criteria, settings.weights),
    reasons,
    missingFields: [...new Set(missing)],
  };
}
export function rankCandidates(
  candidates: RankedCandidate[],
): RankedCandidate[] {
  const priority = { eligible: 0, conditional: 1, excluded: 2 };
  const sorted = [...candidates].sort(
    (a, b) =>
      priority[a.candidateStatus] - priority[b.candidateStatus] ||
      (b.comparisonRange?.lower ?? -1) - (a.comparisonRange?.lower ?? -1) ||
      b.coverage - a.coverage ||
      a.place.id.localeCompare(b.place.id),
  );
  const seen = new Set<string>();
  return sorted.filter((c) => {
    if (seen.has(c.place.id)) return false;
    seen.add(c.place.id);
    return true;
  });
}
export type GroupParticipant = {
  label: string;
  profile: Profile;
  conditions: Conditions;
  settings: Settings;
  learning: Learning;
};
export function rankGroup(
  places: Place[],
  participants: GroupParticipant[],
): RankedCandidate[] {
  if (!participants.length) return [];
  return places.flatMap((place) => {
    const chosen = participants.map(
      (p) =>
        rankCandidates(
          place.menus
            .map((m) =>
              evaluateCandidate(
                place,
                m,
                p.profile,
                {
                  ...p.conditions,
                  partySize: Math.max(
                    participants.length,
                    p.conditions.partySize,
                  ),
                },
                p.settings,
                [],
                p.learning,
              ),
            )
            .filter((c) => c.candidateStatus !== "excluded"),
        )[0],
    );
    if (chosen.some((c) => !c)) return [];
    const cs = chosen as RankedCandidate[],
      incomplete = cs.some((c) => c.observedScore === null);
    const penalty =
      rankingPolicy.groupProtection *
      Math.max(
        ...cs.map((c) =>
          Math.max(
            0,
            rankingPolicy.groupDislikeThreshold -
              (c.criteria.taste ?? rankingPolicy.groupDislikeThreshold),
          ),
        ),
      );
    const score = incomplete
      ? null
      : cs.reduce((a, c) => a + c.observedScore!, 0) / cs.length - penalty;
    const lower = incomplete
      ? null
      : cs.reduce((a, c) => a + (c.comparisonRange?.lower ?? 0), 0) /
          cs.length -
        penalty;
    return [
      {
        ...cs[0],
        candidateStatus: cs.some((c) => c.candidateStatus === "conditional")
          ? ("conditional" as const)
          : ("eligible" as const),
        observedScore: score,
        comparisonRange:
          lower === null ? null : { lower: Math.max(0, lower), upper: 100 },
        coverage: cs.reduce((a, c) => a + c.coverage, 0) / cs.length,
        reasons: [
          "참여자마다 먹을 수 있는 메뉴와 각자의 예산을 확인했어요.",
          "평균 적합도와 강한 비선호 보호를 함께 반영했어요.",
        ],
        safety: {
          status: cs.some((c) => c.safety.status !== "reviewed")
            ? ("needs_confirmation" as const)
            : ("reviewed" as const),
          reasons: [],
          evidenceIds: [],
          mustShowWarnings: cs.some((c) => c.safety.mustShowWarnings.length)
            ? [
                "일부 참여자의 제한을 반영했어요. 각자 주문 전 성분과 조리를 확인해 주세요.",
              ]
            : [],
        },
        groupMenus: cs.map((c, i) => ({
          label: participants[i].label,
          menuName: c.menu.name,
          price: c.menu.price.value,
        })),
      },
    ];
  });
}
