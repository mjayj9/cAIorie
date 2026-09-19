import type { Feedback, Learning, Meal, Settings } from "./models.ts";
import { rankingPolicy } from "./defaults.ts";
export function learnTaste(
  state: Learning,
  feedback: Feedback,
  meal: Meal,
  cuisine: string,
  consented: boolean,
): Learning {
  if (
    !consented ||
    meal.status !== "confirmed" ||
    !feedback.reasons.includes("맛")
  )
    return state;
  return {
    ...state,
    observations: state.observations + 1,
    taste: {
      ...state.taste,
      [cuisine]: Math.max(
        -rankingPolicy.maxTasteLearning,
        Math.min(
          rankingPolicy.maxTasteLearning,
          (state.taste[cuisine] ?? 0) + (feedback.rating - 3) * 0.5,
        ),
      ),
    },
  };
}
export function canProposeChange(state: Learning, now: Date) {
  return (
    state.observations >= rankingPolicy.minObservations &&
    (!state.rejectedUntil || new Date(state.rejectedUntil) <= now) &&
    (!state.lastProposalAt ||
      now.getTime() - Date.parse(state.lastProposalAt) >=
        rankingPolicy.proposalIntervalDays * 86400000)
  );
}
export function applyApprovedWeight(
  settings: Settings,
  criterion: keyof Settings["weights"],
  value: number,
  approved: boolean,
): Settings {
  if (!approved || value < 0 || value > 1)
    throw new Error("승인된 범위를 확인할 수 없어요.");
  return { ...settings, weights: { ...settings.weights, [criterion]: value } };
}
