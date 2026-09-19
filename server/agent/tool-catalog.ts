// Only implemented capabilities may be disclosed to a future runtime model.
// Recommendation orchestration is deterministic. Meal parsing uses optional, consented AI.
export const agentToolCatalog = [
  {
    name: "read_session_context",
    effect: "read",
    implementation: "server/context.ts",
  },
  {
    name: "read_confirmed_meals",
    effect: "read",
    implementation: "server/repository.ts",
  },
  {
    name: "parse_meal_text",
    effect: "consented_external_read",
    implementation: "server/api/meals.ts",
  },
  {
    name: "search_food_database",
    effect: "read",
    implementation: "server/api/catalog.ts",
    mode: "configured",
  },
  {
    name: "get_guideline",
    effect: "read",
    implementation: "domain/guidelines.ts",
  },
  {
    name: "search_restaurants",
    effect: "external_read",
    implementation: "providers/places.ts",
  },
  {
    name: "analyze_meal_history",
    effect: "compute",
    implementation: "domain/meals.ts",
  },
  {
    name: "evaluate_safety",
    effect: "compute",
    implementation: "domain/safety.ts",
  },
  {
    name: "rank_candidates",
    effect: "compute",
    implementation: "domain/ranking.ts",
  },
  {
    name: "propose_constraint_change",
    effect: "stage_only",
    implementation: "server/orchestrator.ts",
  },
  {
    name: "apply_approved_constraint_change",
    effect: "approved_write",
    implementation: "server/api/recommendations.ts",
  },
  {
    name: "save_confirmed_meal",
    effect: "confirmed_write",
    implementation: "server/api/meals.ts",
  },
  {
    name: "save_feedback",
    effect: "submitted_write",
    implementation: "server/api/meals.ts",
  },
  {
    name: "update_learning_state",
    effect: "consented_write",
    implementation: "server/learning-service.ts",
  },
] as const;
export const disabledAgentTools = [
  "get_place_details",
  "collect_menu_evidence",
  "search_additional_evidence",
  "get_route",
  "propose_preference_change",
  "apply_approved_change",
] as const;
