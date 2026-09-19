import type { Meal, Profile } from "./models.ts";
export type GuidelineVersion = {
  id: string;
  version: string;
  organization: string;
  title: string;
  sourceUrl: string;
  publishedAt: string | null;
  correctionDate: string | null;
  targetAge: string;
  requiredInputs: string[];
  analysisPeriod: string;
  formula: string | null;
  units: string[];
  licenseVerified: boolean;
  validation: "pending" | "validated";
  validatedBy: string | null;
  validatedAt: string | null;
  kind: "official_reference" | "official_method" | "app_indicator";
};
export const guidelineRegistry: GuidelineVersion[] = [
  {
    id: "kr-dri",
    version: "2025",
    organization: "보건복지부",
    title: "2025 한국인 영양소 섭취기준",
    sourceUrl:
      "https://www.mohw.go.kr/board.es?act=view&bid=0027&list_no=1488441&mid=a10503010100",
    publishedAt: "2025-12-31",
    correctionDate: null,
    targetAge: "영양소별 연령·성별 표 검증 필요",
    requiredInputs: ["적용 연령", "기준 성별", "섭취량", "음식 성분"],
    analysisPeriod: "기준별 검증 필요",
    formula: null,
    units: [],
    licenseVerified: false,
    validation: "pending",
    validatedBy: null,
    validatedAt: null,
    kind: "official_reference",
  },
  {
    id: "kr-khei",
    version: "pending",
    organization: "질병관리청",
    title: "성인 식생활평가지수",
    sourceUrl: "https://knhanes.kdca.go.kr/knhanes/",
    publishedAt: null,
    correctionDate: null,
    targetAge: "19세 이상 성인; 원 계산식·필수 입력 확보 전 미사용",
    requiredInputs: ["식품군", "섭취량", "식사 빈도", "원 계산식"],
    analysisPeriod: "원 방법론 검증 필요",
    formula: null,
    units: [],
    licenseVerified: false,
    validation: "pending",
    validatedBy: null,
    validatedAt: null,
    kind: "official_method",
  },
];
export function getApplicableGuideline(
  profile: Profile,
): GuidelineVersion | null {
  return (
    guidelineRegistry.find(
      (g) =>
        g.validation === "validated" &&
        g.formula !== null &&
        profile.ageBand === "adult" &&
        profile.nutritionCountry === "KR",
    ) ?? null
  );
}
export function assessMeals(profile: Profile, meals: Meal[]) {
  const guideline = getApplicableGuideline(profile);
  return {
    score: null,
    average7Days: null,
    validAssessmentDays: 0,
    status: guideline
      ? "required_inputs_missing"
      : meals.some((m) => m.status === "confirmed")
        ? "method_not_validated"
        : "insufficient_records",
    guidelineId: guideline?.id ?? null,
  };
}
