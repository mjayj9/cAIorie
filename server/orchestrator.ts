import type {
  Conditions,
  Location,
  Profile,
  Recommendation,
  Settings,
  SessionState,
  Meal,
} from "../domain/models.ts";
import { rankPlaces } from "../domain/place-ranking.ts";
import { menuRelaxations } from "../domain/relaxations.ts";
import { formatDistance } from "../domain/distance.ts";
import { footerNotice } from "../domain/defaults.ts";
import { assertProfilePermission } from "../domain/safety.ts";
import { localDate, shiftDay } from "../domain/meals.ts";
import {
  evaluateCandidate,
  rankCandidates,
  rankGroup,
  type GroupParticipant,
} from "../domain/ranking.ts";
import { demoPlaces, demoEvidence } from "../fixtures/demo.ts";
import type { ProviderConfig, ProviderResult } from "../providers/contracts.ts";
import { searchKakao, searchGoogle } from "../providers/places.ts";
import { ProviderError } from "../providers/http.ts";
export type RecommendInput = {
  profile: Profile;
  conditions: Conditions;
  settings: Settings;
  location: Location | null;
  mode: "demo" | "live";
  skipYesterday: boolean;
  groupId: string | null;
};
export async function recommend(
  input: RecommendInput,
  state: SessionState,
  meals: Meal[],
  config: ProviderConfig,
  participants: GroupParticipant[] = [],
  signal?: AbortSignal,
): Promise<Recommendation> {
  assertProfilePermission(input.profile, state.consents.sensitiveProcessing);
  const result: Recommendation = {
    id: crypto.randomUUID(),
    status: "ready",
    dataMode: input.mode,
    recommendations: [],
    conditionalCandidates: [],
    nearbyPlaces: [],
    placeCandidates: [],
    evidence: [],
    proposals: [],
    question: null,
    notices: [],
    footerNotice,
  };
  const today = localDate(new Date(), input.settings.notifications.timezone);
  const recent = meals.filter(
    (m) =>
      m.dataMode === input.mode &&
      m.status === "confirmed" &&
      m.day >= shiftDay(today, -6) &&
      m.day <= today,
  );
  if (!Object.values(input.settings.weights).some((w) => w > 0))
    return {
      ...result,
      status: "needs_input",
      notices: ["추천 중요도를 한 항목 이상 선택해 주세요."],
    };
  if (
    input.mode === "live" &&
    (!input.location || input.location.origin === "demo")
  )
    return {
      ...result,
      status: "needs_input",
      notices: ["식당을 찾을 실제 위치를 먼저 선택해 주세요."],
    };
  if (
    !input.skipYesterday &&
    !state.yesterdayAsked &&
    recent.length < 3 &&
    !recent.some((m) => m.day === shiftDay(today, -1))
  )
    return {
      ...result,
      status: "needs_input",
      question:
        "최근 식사 기록이 없어요. 어제 점심이나 저녁에 무엇을 드셨나요? 메뉴가 겹치지 않게 참고할게요.",
    };
  let source: ProviderResult;
  if (input.mode === "demo") {
    if (input.conditions.currency !== "KRW")
      return {
        ...result,
        status: "no_match",
        notices: ["데모 가격은 KRW만 지원해요. 통화를 원으로 선택해 주세요."],
      };
    source = {
      places: structuredClone(demoPlaces),
      evidence: demoEvidence,
      notices: [
        "가상의 음식점·가격·좌표로 시연합니다. 실제 영업 정보가 아닙니다.",
      ],
    };
  } else {
    if (config.demoMode)
      return {
        ...result,
        status: "provider_unavailable",
        notices: [
          "현재 서버는 데모 모드예요. 실제 조회에는 서버 설정과 제공자 키가 필요해요.",
        ],
      };
    if (!input.location)
      return {
        ...result,
        status: "needs_input",
        notices: ["위치를 허용하거나 지역·좌표를 직접 선택해 주세요."],
      };
    if (input.location.origin === "demo")
      return {
        ...result,
        status: "needs_input",
        notices: [
          "실제 조회에는 직접 선택하거나 기기에서 확인한 위치가 필요해요.",
        ],
      };
    if (
      (input.location.accuracyMeters !== null &&
        input.location.accuracyMeters > 500) ||
      Date.now() - Date.parse(input.location.capturedAt) > 15 * 60000
    )
      result.notices.push(
        "위치가 오래되었거나 오차가 커요. 새로 확인하면 위치 비교에 도움이 됩니다.",
      );
    try {
      source =
        input.location.country === "KR"
          ? await searchKakao(
              config,
              input.location,
              input.conditions.maxDistance,
              signal,
              input.conditions.craving,
            )
          : await searchGoogle(
              config,
              input.location,
              input.conditions.maxDistance,
              signal,
            );
    } catch (e) {
      if (e instanceof ProviderError && e.code === "aborted") throw e;
      return {
        ...result,
        status: "provider_unavailable",
        notices: [
          "음식점 데이터 제공자에 연결하지 못했어요. 식당이 없다는 뜻은 아니에요. 키·한도·연결 상태를 확인해 주세요.",
        ],
      };
    }
  }
  const people = (conditions: Conditions) =>
    participants.length
      ? participants.map((p) => ({
          ...p,
          conditions: {
            ...p.conditions,
            maxDistance: conditions.maxDistance,
            availableMinutes: conditions.availableMinutes,
            returnTrip: conditions.returnTrip,
            partySize: participants.length,
            serviceMode: conditions.serviceMode,
            craving: conditions.craving || p.conditions.craving,
          },
        }))
      : [{ profile: input.profile, conditions, settings: input.settings }];
  const evaluate = (conditions: Conditions) =>
    participants.length
      ? rankGroup(
          source.places,
          participants.map((p) => ({
            ...p,
            conditions: {
              ...p.conditions,
              maxDistance: conditions.maxDistance,
              availableMinutes: conditions.availableMinutes,
              returnTrip: conditions.returnTrip,
              partySize: participants.length,
              serviceMode: conditions.serviceMode,
              craving: conditions.craving || p.conditions.craving,
            },
          })),
        )
      : source.places.flatMap((p) =>
          p.menus.map((m) =>
            evaluateCandidate(
              p,
              m,
              input.profile,
              conditions,
              input.settings,
              recent,
              state.consents.personalization
                ? state.learning
                : {
                    taste: {},
                    observations: 0,
                    lastProposalAt: null,
                    rejectedUntil: null,
                  },
            ),
          ),
        );
  const raw = evaluate(input.conditions);
  result.recommendations = rankCandidates(
    raw.filter((c) => c.candidateStatus === "eligible"),
  ).slice(0, 3);
  const ids = new Set(result.recommendations.map((c) => c.place.id));
  result.conditionalCandidates = rankCandidates(
    raw.filter(
      (c) => c.candidateStatus === "conditional" && !ids.has(c.place.id),
    ),
  ).slice(0, 3);
  result.placeCandidates = rankPlaces(source.places, people(input.conditions));
  result.nearbyPlaces = result.placeCandidates.map((c) => c.place);
  result.evidence = source.evidence;
  result.notices.push(...source.notices);
  result.status =
    result.recommendations.length >= 3
      ? "ready"
      : result.recommendations.length ||
          result.conditionalCandidates.length ||
          result.nearbyPlaces.length
        ? "partial"
        : "no_match";
  result.proposals = menuRelaxations(
    source.places,
    input.conditions,
    evaluate,
    !participants.length,
  );
  const count =
    result.recommendations.length +
    result.conditionalCandidates.length +
    result.placeCandidates.length;
  if (
    !count &&
    input.mode === "live" &&
    input.location &&
    input.conditions.maxDistance !== null
  ) {
    const before = input.conditions.maxDistance;
    const limit = input.location.country === "KR" ? 20000 : 50000;
    const radius = Math.min(limit, Math.max(1000, Math.ceil(before * 3)));
    if (radius > before) {
      // A second bounded lookup only diagnoses useful expansion. It never changes the user's current radius.
      try {
        const wider =
          input.location.country === "KR"
            ? await searchKakao(
                config,
                input.location,
                radius,
                signal,
                input.conditions.craving,
              )
            : await searchGoogle(config, input.location, radius, signal);
        const candidates = rankPlaces(
          wider.places,
          people({ ...input.conditions, maxDistance: radius }),
        )
          .filter(
            (c) =>
              c.place.distance.value !== null &&
              c.place.distance.value > before,
          )
          .sort((a, b) => a.place.distance.value! - b.place.distance.value!);
        if (candidates.length) {
          const after = Math.min(
            radius,
            Math.ceil(
              candidates[Math.min(2, candidates.length - 1)].place.distance
                .value! / 100,
            ) * 100,
          );
          const additional = candidates.filter(
            (c) => c.place.distance.value! <= after,
          ).length;
          result.proposals.push({
            id: crypto.randomUUID(),
            field: "maxDistance",
            before,
            after,
            verifiedAdditionalCandidates: additional,
            candidateKind: "place",
            requiresConfirmation: true,
          });
        }
      } catch (e) {
        if (e instanceof ProviderError && e.code === "aborted") throw e;
        result.notices.push(
          "반경을 넓혔을 때의 후보는 연결 문제로 확인하지 못했어요.",
        );
      }
    }
  }
  if (!count) {
    if (
      input.conditions.maxDistance !== null &&
      input.conditions.maxDistance < 100
    )
      result.notices.push(
        "현재 반경은 " +
          formatDistance(input.conditions.maxDistance) +
          "예요. 도보 시간이 아니라 미터 단위의 직선거리입니다.",
      );
    if (input.conditions.craving)
      result.notices.push(
        "‘" +
          input.conditions.craving +
          "’ 검색어와 현재 조건에 맞는 후보를 찾지 못했어요. 음식 이름을 바꾸거나 검색 위치를 확인해 주세요.",
      );
    else
      result.notices.push(
        "현재 위치·조건으로 비교할 후보가 없어요. 위치와 이동 반경, 제외한 음식을 확인해 주세요.",
      );
    if (raw.some((c) => c.safety.status === "blocked"))
      result.notices.push(
        "식사 제한 또는 미확인 성분·교차접촉 때문에 제외된 메뉴가 있어요. 이 제한은 자동으로 완화하지 않아요.",
      );
  }
  return result;
}
