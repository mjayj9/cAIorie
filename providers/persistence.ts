import type { Recommendation } from "../domain/models.ts";

/** Store workflow identifiers without retaining provider data whose contract forbids storage. */
export function recommendationForCache(result: Recommendation): Recommendation {
  if (
    result.dataMode === "demo" ||
    result.evidence.every((e) => e.storageAllowed)
  )
    return result;
  return {
    ...result,
    recommendations: [],
    conditionalCandidates: [],
    nearbyPlaces: [],
    placeCandidates: [],
    evidence: [],
  };
}
