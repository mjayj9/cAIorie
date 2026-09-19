import { CRITERIA, type Criterion, type Score } from "./models.ts";
export function weightedScore(
  criteria: Record<Criterion, number | null>,
  weights: Record<Criterion, number>,
): Score {
  const total = CRITERIA.reduce((s, k) => s + Math.max(0, weights[k]), 0);
  const observed = CRITERIA.filter(
    (k) =>
      criteria[k] !== null && Number.isFinite(criteria[k]) && weights[k] > 0,
  );
  const known = observed.reduce((s, k) => s + weights[k], 0);
  if (!total || !known)
    return {
      criteria,
      observedScore: null,
      coverage: 0,
      comparisonRange: null,
    };
  const score =
    observed.reduce(
      (s, k) => s + weights[k] * Math.min(100, Math.max(0, criteria[k]!)),
      0,
    ) / known;
  const coverage = known / total;
  return {
    criteria,
    observedScore: score,
    coverage,
    comparisonRange: {
      lower: coverage * score,
      upper: coverage * score + 100 * (1 - coverage),
    },
  };
}
export function displayWeight(normalized: number, scale: 5 | 10) {
  return normalized * scale;
}
export function normalizedWeight(display: number, scale: 5 | 10) {
  return Math.min(1, Math.max(0, display / scale));
}
export function boundedScore(value: number, limit: number) {
  return limit === 0
    ? value === 0
      ? 100
      : 0
    : Math.max(0, 100 - (50 * value) / limit);
}
