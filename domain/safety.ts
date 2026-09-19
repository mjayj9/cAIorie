import type { Menu, Profile, SafetyResult } from "./models.ts";
const normalize = (s: string) => s.toLowerCase().replace(/\s/g, "");
export function evaluateSafety(menu: Menu, profile: Profile): SafetyResult {
  const result: SafetyResult = {
    status: "reviewed",
    reasons: [],
    mustShowWarnings: [],
    evidenceIds: [...menu.evidenceIds],
  };
  const mark = (blocked: boolean, message: string) => {
    if (blocked || result.status !== "blocked")
      result.status = blocked ? "blocked" : "needs_confirmation";
    result.reasons.push(message);
    result.mustShowWarnings.push(message);
  };
  for (const excluded of profile.excluded) {
    const token = normalize(excluded);
    if (
      normalize(menu.name).includes(token) ||
      menu.ingredients?.some((i) => normalize(i).includes(token))
    )
      mark(true, "명시적으로 제외한 음식이 포함되어 있어요.");
    else if (menu.ingredients === null)
      mark(false, "제외 음식의 포함 여부를 확인할 수 없어요.");
  }
  for (const restriction of profile.restrictions) {
    const evidence = menu.allergens[restriction.value] ?? "unknown";
    const present = menu.ingredients?.some((i) =>
      normalize(i).includes(normalize(restriction.value)),
    );
    if (present || evidence === "contains") {
      mark(true, "입력한 식사 제한에 해당하는 성분이 포함되어 있어요.");
      continue;
    }
    if (evidence === "potential_cross_contact" || evidence === "conflicting") {
      mark(
        true,
        "교차접촉 위험 또는 상충하는 정보가 있어 일반 추천에서 제외했어요.",
      );
      continue;
    }
    if (evidence !== "documented_handling")
      mark(
        restriction.history === "severe_or_trace_sensitive",
        "알레르기·식사 제한 관련 성분과 조리 정보가 확인되지 않았어요. 식당에 확인이 필요해요.",
      );
    else
      result.mustShowWarnings.push(
        "조리 관련 근거가 있지만 안전을 보장하지 않아요. 주문 전 식당에 제한사항을 다시 확인해 주세요.",
      );
  }
  if (
    profile.allergyStatus === "unknown" ||
    profile.allergyStatus === "declined"
  )
    result.mustShowWarnings.push(
      "알레르기 정보가 입력되지 않아 개인 알레르기 제한은 확인하지 못했어요.",
    );
  return result;
}
export function hasSensitiveProfile(p: Profile) {
  return (
    p.restrictions.length > 0 ||
    p.heightCm !== null ||
    p.weightKg !== null ||
    p.sex !== "unspecified" ||
    p.allergyStatus === "provided"
  );
}
export function assertProfilePermission(p: Profile, allowed: boolean) {
  if (p.ageBand === "under14") throw new Error("CHILD_DEMO_ONLY");
  if (p.ageBand === "not_provided" && hasSensitiveProfile(p))
    throw new Error("AGE_REQUIRED");
  if (hasSensitiveProfile(p) && !allowed)
    throw new Error("SENSITIVE_CONSENT_REQUIRED");
}
