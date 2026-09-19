import type {
  Capability,
  Evidence,
  Location,
  Place,
  Menu,
  Observation,
} from "../domain/models.ts";
export type ProviderResult = {
  places: Place[];
  evidence: Evidence[];
  notices: string[];
};
export type ProviderConfig = {
  demoMode: boolean;
  kakaoKey: string;
  googleKey: string;
  encryptionKey: string;
  aiKey: string;
  aiProvider: string;
  aiModel: string;
  aiBaseUrl?: string;
  nutritionKey?: string;
  registryKey?: string;
};
export interface PlaceProvider {
  metadata: Capability;
  search(
    location: Location,
    radius: number | null,
    signal?: AbortSignal,
  ): Promise<ProviderResult>;
}
export interface RestaurantRegistryProvider {
  lookup(place: Place): Promise<{
    administrativeStatus: Place["administrativeStatus"];
    evidence: Evidence[];
  }>;
}
export interface MenuEvidenceProvider {
  collect(place: Place): Promise<Menu[]>;
}
export interface RouteProvider {
  route(
    from: Location,
    to: Place,
  ): Promise<{ meters: Observation<number>; minutes: Observation<number> }>;
}
export interface NutritionProvider {
  search(query: string): Promise<unknown[]>;
}
export interface GuidelineProvider {
  getApplicable(ageBand: string, country: string): Promise<unknown | null>;
}
export interface WebSearchProvider {
  search(query: string): Promise<Evidence[]>;
}
export interface AIProvider {
  parse(text: string): Promise<unknown>;
}
export interface NotificationProvider {
  schedule(
    consented: boolean,
    timezone: string,
  ): Promise<{ supported: boolean }>;
}
export const isUsableKey = (key: string) =>
  !!key && !/^(sk-000000|YOUR_|placeholder)/i.test(key);
export function aiConfigured(c: ProviderConfig) {
  return (
    c.aiProvider === "openrouter" &&
    isUsableKey(c.aiKey) &&
    (!c.aiBaseUrl ||
      c.aiBaseUrl.replace(/\/$/, "") === "https://openrouter.ai/api/v1") &&
    (!c.aiModel ||
      c.aiModel === "openrouter/free" ||
      /^[a-z0-9._/-]+:free$/i.test(c.aiModel))
  );
}
export function capabilities(c: ProviderConfig): Capability[] {
  return [
    {
      id: "demo",
      name: "데모 음식점·메뉴",
      configured: true,
      mode: "demo",
      capabilities: ["nearby_search", "menu", "exact_menu_price"],
      detail: "가상의 6곳. 실제 정보와 섞지 않습니다.",
      lastContractVerifiedAt: null,
    },
    {
      id: "kakao",
      name: "Kakao Local",
      configured: isUsableKey(c.kakaoKey),
      mode: isUsableKey(c.kakaoKey) ? "live" : "disabled",
      capabilities: ["nearby_search", "geocoding"],
      detail: "장소·주소·좌표 검색. 메뉴·가격·평점·경로는 제공하지 않습니다.",
      lastContractVerifiedAt: "2026-09-19",
    },
    {
      id: "google",
      name: "Google Places",
      configured: isUsableKey(c.googleKey),
      mode: isUsableKey(c.googleKey) ? "live" : "disabled",
      capabilities: ["nearby_search", "opening_hours", "ratings"],
      detail:
        "해외 장소 탐색. 메뉴별 가격·전체 리뷰는 확인할 수 없습니다. Google Maps 출처 링크를 사용합니다.",
      lastContractVerifiedAt: "2026-09-19",
    },
    {
      id: "registry",
      name: "행정안전부 일반음식점",
      configured: isUsableKey(c.registryKey ?? ""),
      mode: isUsableKey(c.registryKey ?? "") ? "live" : "disabled",
      capabilities: ["administrative_status"],
      detail:
        "주변 식당에서 행정정보 확인. 이름·주소가 모두 일치한 지점만 표시하며, 지금 영업 중인지는 별도 확인이 필요합니다.",
      lastContractVerifiedAt: "2026-09-19",
    },
    {
      id: "nutrition",
      name: "식약처 식품영양성분DB",
      configured: isUsableKey(c.nutritionKey ?? ""),
      mode: isUsableKey(c.nutritionKey ?? "") ? "live" : "disabled",
      capabilities: ["food_search", "nutrition_reference"],
      detail:
        "식사 기록의 음식 검색에서 공식 기준값을 조회합니다. 중량을 입력하면 추정 영양량을 계산합니다. 음식점 메뉴 성분·건강 점수는 별도입니다.",
      lastContractVerifiedAt: "2026-09-19",
    },
    {
      id: "ai",
      name: "OpenRouter 무료 AI",
      configured: aiConfigured(c),
      mode: aiConfigured(c) ? "live" : "disabled",
      capabilities: ["meal_text_parsing"],
      detail:
        "성인 사용자가 외부 AI 전송에 동의하면 입력한 식사 문장만 구분합니다. 기본 OFF이며 무료 모델 실패 시 규칙 기반으로 처리합니다.",
      lastContractVerifiedAt: "2026-09-19",
    },
    {
      id: "push",
      name: "앱 종료 후 알림",
      configured: false,
      mode: "disabled",
      capabilities: [],
      detail:
        "푸시·서버 스케줄러 미연결. 알림 기본 OFF, 앱 내부 확인 카드 제공.",
      lastContractVerifiedAt: null,
    },
    {
      id: "account",
      name: "계정·보호자 확인",
      configured: false,
      mode: "disabled",
      capabilities: [],
      detail:
        "비회원 세션·임시 초대만 지원. 계정 동기화와 아동 개인정보 수집은 비활성화.",
      lastContractVerifiedAt: null,
    },
  ];
}
