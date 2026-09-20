import type {
  Conditions,
  Consents,
  Profile,
  SessionState,
  Settings,
  Learning,
} from "./models.ts";
export const POLICY_VERSION = "2026-09-19.v1";
export const conditions: Conditions = {
  budget: null,
  minDistance: 0,
  maxDistance: null,
  availableMinutes: null,
  returnTrip: false,
  partySize: 1,
  serviceMode: "dine_in",
  craving: "",
  currency: "KRW",
  minRating: null,
  minReviews: null,
};
export const profile: Profile = {
  ageBand: "not_provided",
  allergyStatus: "unknown",
  restrictions: [],
  excluded: [],
  likes: [],
  dislikes: [],
  sex: "unspecified",
  heightCm: null,
  weightKg: null,
  nutritionCountry: "KR",
};
export const consents: Consents = {
  sensitiveProcessing: false,
  saveSensitive: false,
  saveMeals: false,
  savePreferences: false,
  saveVisits: false,
  personalization: false,
  externalAi: false,
  groupSharing: false,
};
export const settings: Settings = {
  conditions,
  weights: { health: 0.6, taste: 0.6, price: 0.6, distance: 0.6, rating: 0.6 },
  scale: 5,
  displayMode: "normal",
  feedbackMode: "C",
  ratingWeights: {
    rating: 1,
    count: 1,
    recency: 1,
    menuPraise: 1,
    consistency: 1,
  },
  retentionDays: 30,
  interests: ["다양성"],
  guidance: "normal",
  notifications: {
    enabled: false,
    time: "11:30",
    days: [1, 2, 3, 4, 5],
    timezone: "Asia/Seoul",
  },
};
export const learning: Learning = {
  taste: {},
  observations: 0,
  lastProposalAt: null,
  rejectedUntil: null,
};
export function initialState(): SessionState {
  return structuredClone({
    onboarded: false,
    consents,
    profile,
    settings,
    learning,
    yesterdayAsked: false,
  });
}
export const rankingPolicy = {
  version: "1.0",
  repetitionPenalty: 6,
  maxTasteLearning: 8,
  groupDislikeThreshold: 35,
  groupProtection: 0.35,
  minObservations: 10,
  proposalIntervalDays: 14,
  rejectCooldownDays: 30,
} as const;
export const footerNotice =
  "AI 분석과 영양정보에는 추정이 포함될 수 있습니다. 실제 메뉴·가격·조리법은 식당에 확인하고, 중요한 건강 정보는 공식 자료나 전문가와 재확인하세요.";
