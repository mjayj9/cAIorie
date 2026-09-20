"use client";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import type { CatalogFood } from "@/domain/foods";
import { Field } from "./controls";
import { getJson } from "./api";
export function FoodPicker({
  selected,
  onSelect,
  initialQuery = "",
  disabled = false,
}: {
  selected: CatalogFood | null;
  onSelect: (food: CatalogFood | null) => void;
  initialQuery?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(selected?.name ?? initialQuery);
  const [foods, setFoods] = useState<CatalogFood[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function search() {
    if (!query.trim() || disabled) return;
    request.current?.abort();
    const current = new AbortController();
    request.current = current;
    setPending(true);
    setError("");
    setMessage("");
    setFoods([]);
    try {
      const data = await getJson<{ items: CatalogFood[]; notice: string }>(
        "foods?q=" + encodeURIComponent(query.trim()),
        current.signal,
      );
      if (current.signal.aborted) return;
      setFoods(data.items);
      setMessage(
        data.items.length
          ? data.notice
          : "식약처 DB에 검색 결과가 없어요. 다른 음식명으로 검색해 주세요. 검색 결과에서 선택한 음식만 기록할 수 있어요.",
      );
    } catch (e) {
      if (!current.signal.aborted) setError((e as Error).message);
    } finally {
      if (request.current === current) setPending(false);
    }
  }
  return (
    <div className="official-food-picker">
      <Field
        label="음식 검색"
        hint="식약처 식품영양성분DB에서 검색한 음식만 기록할 수 있어요. 예: 쌀밥, 두부, 비빔밥"
      >
        <div className="button-row">
          <input
            aria-label="음식 검색"
            value={query}
            maxLength={100}
            disabled={disabled}
            placeholder="음식 이름을 검색해 주세요"
            onChange={(e) => {
              request.current?.abort();
              setPending(false);
              setFoods([]);
              setMessage("");
              setError("");
              setQuery(e.target.value);
              onSelect(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void search();
              }
            }}
          />
          <button
            type="button"
            className="outline-button"
            disabled={disabled || pending || !query.trim()}
            onClick={() => void search()}
          >
            <Search size={16} />
            {pending ? "검색 중…" : "검색"}
          </button>
        </div>
      </Field>
      {message && (
        <p className="caption" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="warning" role="alert">
          {error}
        </p>
      )}
      <div className="food-search-results" aria-label="식약처 음식 검색 결과">
        {foods.map((food) => (
          <button
            type="button"
            className="search-item"
            key={food.id}
            disabled={disabled}
            aria-pressed={selected?.id === food.id}
            onClick={() => {
              onSelect(food);
              setFoods([]);
              setMessage("");
              setQuery(food.name);
            }}
          >
            <span>
              {food.name}
              <small>
                {food.provider} · DB 기준 {food.basis}
                {food.category ? " · " + food.category : ""}
              </small>
            </span>
          </button>
        ))}
      </div>
      {selected && (
        <p className="selected-food" role="status">
          <strong>선택한 음식: {selected.name}</strong>
          <br />
          <small>
            {selected.provider} · 다른 음식을 기록하려면 다시 검색해 주세요.
          </small>
        </p>
      )}
    </div>
  );
}
