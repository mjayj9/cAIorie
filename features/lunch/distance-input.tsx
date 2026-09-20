"use client";
import { useState } from "react";
import { formatDistance, formatDistanceRange } from "@/domain/distance";
import { Field } from "./controls";
export function DistanceInput({
  value,
  minimum = 0,
  onChange,
}: {
  value: number | null;
  minimum: number;
  onChange: (maximum: number | null, minimum: number) => void;
}) {
  const [unit, setUnit] = useState<"m" | "km">(
    (value ?? minimum) >= 1000 ? "km" : "m",
  );
  const scale = unit === "km" ? 1000 : 1;
  const parse = (text: string) =>
    Math.round(Number(text) * scale * 1000) / 1000;
  const invalid = value !== null && minimum > value;
  return (
    <Field
      label="이동 거리 범위 · 직선거리"
      hint="예: 0.5km ~ 2km. 실제 걷는 거리와 다르며 국내 식당 조회는 최대 20km까지 지원해요."
    >
      <div className="distance-input-row distance-range-row">
        <label>
          최소
          <input
            aria-label="최소 이동 거리"
            type="number"
            min={0}
            max={50000 / scale}
            step="any"
            value={Number((minimum / scale).toFixed(3))}
            onChange={(e) =>
              onChange(value, e.target.value === "" ? 0 : parse(e.target.value))
            }
          />
        </label>
        <span aria-hidden="true">~</span>
        <label>
          최대
          <input
            aria-label="최대 이동 거리"
            type="number"
            min={1 / scale}
            max={50000 / scale}
            step="any"
            placeholder="상한 없음"
            value={value === null ? "" : Number((value / scale).toFixed(3))}
            onChange={(e) =>
              onChange(
                e.target.value === "" ? null : parse(e.target.value),
                minimum,
              )
            }
          />
        </label>
        <select
          aria-label="거리 단위"
          value={unit}
          onChange={(e) => setUnit(e.target.value as "m" | "km")}
        >
          <option value="m">m</option>
          <option value="km">km</option>
        </select>
      </div>
      <p className="caption" aria-live="polite">
        {formatDistanceRange(minimum, value)}
      </p>
      {invalid && (
        <p className="warning" role="alert">
          최소 거리는 최대 거리보다 클 수 없어요.
        </p>
      )}
      <div className="distance-presets" aria-label="거리 범위 빠른 선택">
        {[500, 1000, 2000, 5000].map((m) => (
          <button
            type="button"
            key={m}
            aria-pressed={minimum === 0 && value === m}
            onClick={() => {
              setUnit(m >= 1000 ? "km" : "m");
              onChange(m, 0);
            }}
          >
            {formatDistance(m)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={minimum === 0 && value === null}
          onClick={() => onChange(null, 0)}
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
