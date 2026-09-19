import type { Observation } from "@/domain/models";
import { nutrientLabels } from "@/domain/foods";
export function NutritionValues({
  nutrition,
}: {
  nutrition: Record<string, Observation<number>>;
}) {
  return (
    <div className="nutrition-values">
      {Object.entries(nutrition).map(([id, n]) => (
        <span key={id}>
          {nutrientLabels[id] ?? id}{" "}
          <strong>
            {n.value === null
              ? "미확인"
              : n.value.toLocaleString("ko-KR", { maximumFractionDigits: 2 }) +
                " " +
                (n.unit ?? "")}
          </strong>
        </span>
      ))}
    </div>
  );
}
