import { initialState } from "../domain/defaults.ts";
import { learnTaste } from "../domain/learning.ts";
import type { Feedback, Meal, SessionState } from "../domain/models.ts";
import type { Repository } from "./repository.ts";
export async function rebuildLearning(c: {
  repo: Repository;
  owner: string;
  state: SessionState;
}) {
  let result = {
    ...initialState().learning,
    lastProposalAt: c.state.learning.lastProposalAt,
    rejectedUntil: c.state.learning.rejectedUntil,
  };
  if (c.state.consents.personalization && c.state.consents.saveMeals) {
    const entries = await c.repo.rows<{ payload: string; meal: string }>(
      "SELECT feedback.payload, meals.payload AS meal FROM feedback JOIN meals ON meals.id = feedback.meal_id WHERE feedback.owner = ? AND meals.owner = ? ORDER BY meals.day",
      c.owner,
      c.owner,
    );
    for (const entry of entries) {
      const feedback = JSON.parse(entry.payload) as Feedback,
        meal = JSON.parse(entry.meal) as Meal;
      const cuisine = meal.items.some(
        (i) => i.name.includes("돈가스") || i.name.includes("소바"),
      )
        ? "일식"
        : meal.items.some(
              (i) => i.name.includes("비빔밥") || i.name.includes("두부"),
            )
          ? "한식"
          : "기타";
      result = learnTaste(result, feedback, meal, cuisine, true);
    }
  }
  c.state.learning = result;
  await c.repo.saveState(c.owner, c.state);
  return result;
}
