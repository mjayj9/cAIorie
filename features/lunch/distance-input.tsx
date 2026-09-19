"use client";
import { useState } from "react";
import { formatDistance } from "@/domain/distance";
import { Field } from "./controls";
export function DistanceInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (metres: number | null) => void;
}) {
  const [unit, setUnit] = useState<"m" | "km">(
    value !== null && value >= 1000 ? "km" : "m",
  );
  const scale = unit === "km" ? 1000 : 1;
  return (
    <Field
      label="이동 반경 · 직선거리"
      hint="도보 시간이 아닌 거리예요. 비우면 반경 조건을 두지 않아요."
    >
      <div className="distance-input-row">
        <input
          aria-label="이동 반경"
          type="number"
          min={1 / scale}
          max={50000 / scale}
          step="any"
          placeholder="제한 없음"
          value={value === null ? "" : Number((value / scale).toFixed(3))}
          onChange={(e) =>
            onChange(
              e.target.value === ""
                ? null
                : Math.round(Number(e.target.value) * scale * 1000) / 1000,
            )
          }
        />
        <select
          aria-label="거리 단위"
          value={unit}
          onChange={(e) => setUnit(e.target.value as "m" | "km")}
        >
          <option value="m">m · 미터</option>
          <option value="km">km · 킬로미터</option>
        </select>
      </div>
      <div className="distance-presets" aria-label="반경 빠른 선택">
        {[500, 1000, 2000, 5000].map((m) => (
          <button
            type="button"
            key={m}
            aria-pressed={value === m}
            onClick={() => {
              setUnit(m >= 1000 ? "km" : "m");
              onChange(m);
            }}
          >
            {formatDistance(m)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
        >
          제한 없음
        </button>
      </div>
      {value !== null && value > 0 && value < 100 && (
        <p className="warning" role="status">
          현재 {formatDistance(value)}는 매우 좁은 범위예요. 주변 식당을
          찾으려면 500m나 1km를 선택해 보세요.
        </p>
      )}
    </Field>
  );
}
