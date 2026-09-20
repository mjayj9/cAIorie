"use client";
import { useState } from "react";
import { BookOpen, Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { HistoryAnalysis, Meal } from "@/domain/models";
import { localDate } from "@/domain/meals";
import { Choice, Field } from "./controls";
import { FoodPicker } from "./food-picker";
import { nutritionForGrams, type CatalogFood } from "@/domain/foods";
import { NutritionValues } from "./nutrition";
const slots = {
  breakfast: "아침",
  lunch: "점심",
  dinner: "저녁",
  snack: "간식",
  other: "기타",
};
export function MealHistory({
  meals,
  analysis,
  onNew,
  onEdit,
  onDelete,
}: {
  meals: Meal[];
  analysis: HistoryAnalysis;
  onNew: () => void;
  onEdit: (meal: Meal) => void;
  onDelete: (meal: Meal) => void;
}) {
  const [day, setDay] = useState("");
  const visible = day ? meals.filter((meal) => meal.day === day) : meals;
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MY FOOD JOURNAL</p>
          <h1>나의 식사 기록</h1>
          <p>잘 먹었는지 평가하기보다, 내가 먹은 것을 알아가는 시간.</p>
        </div>
        <button className="primary-button" onClick={onNew}>
          <Plus size={17} />
          식사 기록하기
        </button>
      </div>
      <div className="history-layout">
        <section className="panel">
          <div className="section-heading">
            <h2>최근 7일</h2>
            <span className="pill">
              {analysis.validDays}일 · {analysis.mealCount}끼 기록
            </span>
          </div>
          <div className="week-chart">
            {analysis.dates.map((d) => (
              <div className="day-column" key={d.day}>
                <div className="day-plot">
                  {d.count === null ? (
                    <span className="missing-mark">—</span>
                  ) : (
                    <span
                      className="record-bar"
                      style={{ height: Math.min(100, d.count * 23) + "%" }}
                    >
                      <b>{d.count}</b>
                    </span>
                  )}
                </div>
                <span>
                  {new Intl.DateTimeFormat("ko-KR", {
                    weekday: "short",
                  }).format(new Date(d.day + "T12:00:00"))}
                </span>
                <small>{d.day.slice(5).replace("-", "/")}</small>
              </div>
            ))}
          </div>
          <p className="caption">
            확인된 식사 수를 보여줘요. 미기록일은 결식이나 0점이 아니에요.
          </p>
        </section>
        <section className="panel">
          <span className="eyebrow">BALANCE, NOT A GRADE</span>
          <h2>식습관 균형 지표</h2>
          <div className="assessment-empty">
            <div>
              <small>오늘의 지표</small>
              <strong className="unavailable-score">—</strong>
            </div>
            <div>
              <small>7일 유효 평균</small>
              <strong className="unavailable-score">—</strong>
            </div>
          </div>
          <p>{analysis.scoreStatus}</p>
          <p className="caption">
            연령에 맞는 검증된 평가식이 연결되면 오늘의 상태와 비교 가능한 7일
            평균을 표시해요. 현재 점수는 만들지 않아요.
          </p>
        </section>
      </div>
      <div className="section-heading history-heading">
        <h2>날짜별 식사 일지</h2>
        <span className="caption">실제 식사와 계획을 구분해요</span>
      </div>
      <div className="journal-filter">
        <label>
          기록 날짜{" "}
          <input
            aria-label="기록 날짜 필터"
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <button
          className="outline-button"
          onClick={() => setDay(localDate(new Date()))}
        >
          오늘
        </button>
        <button className="text-button" onClick={() => setDay("")}>
          전체 기록
        </button>
        <small>
          각 기록의 ‘기록 수정’에서 음식·중량·날짜·식사 시점을 바꿀 수 있어요.
        </small>
      </div>
      {!visible.length ? (
        <div className="empty-state panel">
          <BookOpen size={32} />
          <h3>
            {day ? day + "에 기록한 식사가 없어요" : "첫 한 끼를 남겨보세요"}
          </h3>
          <p>
            식약처 DB에서 드신 음식을 선택하세요. 중량을 모르면 비워 두세요.
          </p>
          <button className="primary-button" onClick={onNew}>
            첫 식사 기록
          </button>
        </div>
      ) : (
        <div className="meal-list">
          {visible.map((m) => (
            <article className="meal-row" key={m.id}>
              <span className="meal-slot">{slots[m.slot]}</span>
              <div className="meal-content">
                <div className="meal-heading">
                  <strong>{m.items.map((i) => i.name).join(" · ")}</strong>
                  <span
                    className={
                      "pill " + (m.status === "planned" ? "amber" : "")
                    }
                  >
                    {m.status === "planned" ? "계획 · 분석 제외" : "먹은 식사"}
                  </span>
                </div>
                <p>
                  {m.day} · {m.timezone}
                </p>
                <small>
                  {m.items
                    .map(
                      (i) =>
                        i.name +
                        ": " +
                        (i.amount === null
                          ? "양 미상"
                          : i.amount + " " + i.unit),
                    )
                    .join(" / ")}
                </small>
                {m.items
                  .filter((item) => item.foodReference)
                  .map((item, i) => (
                    <div className="meal-nutrition" key={i}>
                      <small>
                        입력한 중량 기준 추정치 · {item.foodReference!.provider}
                      </small>
                      <NutritionValues nutrition={item.nutrition} />
                      {item.foodReference!.sourceUrl && (
                        <a
                          href={item.foodReference!.sourceUrl!}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          기준 자료 보기 ↗
                        </a>
                      )}
                    </div>
                  ))}
              </div>
              <button
                className="outline-button journal-edit"
                aria-label={m.items[0]?.name + " 기록 수정"}
                onClick={() => onEdit(m)}
              >
                <Pencil size={16} />
                기록 수정
              </button>
              <button
                className="icon-button"
                aria-label={m.items[0]?.name + " 삭제"}
                onClick={() => onDelete(m)}
              >
                <Trash2 size={16} />
              </button>
            </article>
          ))}
        </div>
      )}
      <div className="panel observation-panel">
        <h3>기록에서 보이는 작은 패턴</h3>
        <p>
          {analysis.repetitions.length
            ? analysis.repetitions
                .map((r) => r.name + " " + r.count + "회")
                .join(" · ")
            : "반복을 이야기하기에는 아직 기록이 적어요."}
        </p>
        <p>
          기록된 식품군:{" "}
          {analysis.foodGroups.join(", ") || "분류할 정보가 아직 없어요"}
        </p>
        <p>
          확인된 조리법:{" "}
          {analysis.cooking
            .map((c) => c.name + " " + c.count + "회")
            .join(", ") || "미확인"}
        </p>
        <small>
          음식군·조리법은 기록된 음식명 또는 메뉴 자료에 근거합니다. 영양소
          부족·과잉을 진단하지 않아요.
        </small>
      </div>
    </>
  );
}
export type MealDraft = {
  raw: string;
  day: string;
  slot: Meal["slot"];
  timezone: string;
  status: Meal["status"];
  source: Meal["source"];
  foodId: string | null;
  amount: number | null;
  unit: string | null;
  idempotencyKey: string;
};
export function MealEditor({
  meal,
  initialDay,
  placeName,
  busy,
  onClose,
  onSave,
}: {
  meal: Meal | null;
  initialDay?: string;
  placeName?: string;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: MealDraft, id?: string) => Promise<void>;
}) {
  const existing =
    meal?.items.length === 1 && meal.items[0].foodId?.startsWith("mfds:")
      ? (meal.items[0].foodReference ?? null)
      : null;
  const [selectedFood, setSelectedFood] = useState<CatalogFood | null>(
    existing,
  );
  const [draft, setDraft] = useState<MealDraft>(() => ({
    raw: existing?.name ?? "",
    day: meal?.day ?? initialDay ?? localDate(new Date()),
    slot: meal?.slot ?? "lunch",
    timezone:
      meal?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    status: meal?.status ?? "confirmed",
    source: "search",
    foodId: existing?.id ?? null,
    amount: existing ? meal!.items[0].amount : null,
    unit: existing ? meal!.items[0].unit : null,
    idempotencyKey: crypto.randomUUID(),
  }));
  const set = <K extends keyof MealDraft>(key: K, value: MealDraft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }));
  const selectFood = (food: CatalogFood | null) => {
    setSelectedFood(food);
    setDraft((previous) => ({
      ...previous,
      raw: food?.name ?? "",
      foodId: food?.id ?? null,
      source: "search",
      amount: null,
      unit: null,
    }));
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="flow-dialog wide-dialog">
        <DialogHeader>
          <DialogTitle>
            {meal ? "식사 기록 수정" : "한 끼 기록하기"}
          </DialogTitle>
          <DialogDescription>
            식약처 DB에서 음식 선택 → 드신 중량 입력 → 날짜 확인 → 저장 순서로
            기록해요.
          </DialogDescription>
        </DialogHeader>
        {placeName && (
          <p className="notice-box">
            선택한 식당: {placeName}
            <br />
            실제로 드신 음식을 검색해 주세요.
          </p>
        )}
        {meal && !existing && (
          <p className="notice-box">
            이전 기록: {meal.raw}
            <br />이 기록을 수정하려면 식약처 DB에서 해당 음식을 선택해 주세요.
          </p>
        )}
        <FoodPicker
          selected={selectedFood}
          onSelect={selectFood}
          initialQuery={meal?.raw ?? ""}
          disabled={busy}
        />
        {selectedFood && (
          <section className="food-reference">
            <strong>
              {selectedFood.name} · DB 기준 {selectedFood.basis}
            </strong>
            <Field
              label="드신 중량 (g)"
              hint="중량을 모르면 비워 두세요. 공기·인분을 임의로 환산하지 않아요."
            >
              <input
                aria-label="드신 중량 (g)"
                type="number"
                min="0.1"
                max="10000"
                step="any"
                value={draft.amount ?? ""}
                placeholder="미상"
                disabled={busy}
                onChange={(e) =>
                  setDraft((previous) => ({
                    ...previous,
                    amount: e.target.value ? Number(e.target.value) : null,
                    unit: e.target.value ? "g" : null,
                  }))
                }
              />
            </Field>
            <small>입력한 중량으로 계산한 추정 영양량</small>
            <NutritionValues
              nutrition={nutritionForGrams(selectedFood, draft.amount)}
            />
            <p className="caption">
              식약처 DB 기준값이며, 실제 식당 메뉴의 재료·조리법·분량과 다를 수
              있어요.
            </p>
            {selectedFood.sourceUrl && (
              <a
                href={selectedFood.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                식약처 기준 자료 보기 ↗
              </a>
            )}
          </section>
        )}
        <div className="form-grid">
          <Field label="식사 날짜">
            <input
              aria-label="식사 날짜"
              type="date"
              value={draft.day}
              onChange={(e) => set("day", e.target.value)}
            />
          </Field>
          <Choice
            label="식사 시점"
            value={draft.slot}
            onChange={(v) => set("slot", v as Meal["slot"])}
            options={Object.entries(slots).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Choice
            label="섭취 상태"
            value={draft.status}
            onChange={(v) => set("status", v as Meal["status"])}
            options={[
              { value: "confirmed", label: "실제로 먹었어요" },
              { value: "planned", label: "아직 먹지 않은 계획이에요" },
            ]}
          />
        </div>
        <details>
          <summary>시간대 설정</summary>
          <Field label="현지 시간대">
            <input
              aria-label="현지 시간대"
              value={draft.timezone}
              onChange={(e) => set("timezone", e.target.value)}
            />
          </Field>
        </details>
        <div className="button-row">
          <button className="outline-button" disabled={busy} onClick={onClose}>
            취소
          </button>
          <button
            className="primary-button"
            disabled={
              !selectedFood ||
              !draft.foodId ||
              busy ||
              (draft.amount !== null &&
                (!Number.isFinite(draft.amount) ||
                  draft.amount <= 0 ||
                  draft.amount > 10000))
            }
            onClick={() => void onSave(draft, meal?.id)}
          >
            {busy
              ? "저장 중…"
              : meal
                ? "수정 저장"
                : draft.status === "confirmed"
                  ? "먹은 식사로 기록"
                  : "계획으로 저장"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
