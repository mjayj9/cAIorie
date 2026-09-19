import type {
  Conditions,
  Place,
  RankedCandidate,
  Relaxation,
} from "./models.ts";
/** Offer a single changed constraint only when reevaluation produces additional usable places. */
export function menuRelaxations(
  places: Place[],
  conditions: Conditions,
  evaluate: (conditions: Conditions) => RankedCandidate[],
  allowBudget = true,
): Relaxation[] {
  const count = (c: Conditions) =>
    new Set(
      evaluate(c)
        .filter(
          (x) =>
            x.candidateStatus !== "excluded" &&
            (c.budget === null || x.menu.price.value !== null) &&
            (!x.groupMenus || x.groupMenus.every((m) => m.price !== null)),
        )
        .map((x) => x.place.id),
    ).size;
  const beforeCount = count(conditions);
  if (beforeCount >= 3) return [];
  const values: Record<Relaxation["field"], number[]> = {
    budget: allowBudget
      ? places.flatMap((p) =>
          p.menus.flatMap((m) =>
            m.price.value === null ||
            (m.price.unit && m.price.unit !== conditions.currency)
              ? []
              : [m.price.value],
          ),
        )
      : [],
    maxDistance: places.flatMap((p) =>
      p.distance.value === null
        ? []
        : [Math.ceil(p.distance.value / 100) * 100],
    ),
    minRating: places.flatMap((p) =>
      p.rating.value === null
        ? []
        : [Math.floor((p.rating.value / p.ratingScale) * 50) / 10],
    ),
  };
  return (Object.keys(values) as Relaxation["field"][]).flatMap((field) => {
    const before = conditions[field];
    if (before === null) return [];
    const options = [...new Set(values[field])]
      .filter((v) => (field === "minRating" ? v < before : v > before))
      .filter((v) => field !== "maxDistance" || v <= 50000)
      .sort((a, b) => (field === "minRating" ? b - a : a - b));
    let chosen: { after: number; extra: number } | null = null;
    for (const after of options) {
      const n = count({ ...conditions, [field]: after });
      if (n > beforeCount && (!chosen || n - beforeCount > chosen.extra))
        chosen = { after, extra: n - beforeCount };
      if (n >= 3) break;
    }
    return chosen
      ? [
          {
            id: crypto.randomUUID(),
            field,
            before,
            after: chosen.after,
            verifiedAdditionalCandidates: chosen.extra,
            candidateKind: "menu" as const,
            requiresConfirmation: true as const,
          },
        ]
      : [];
  });
}
