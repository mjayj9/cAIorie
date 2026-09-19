"use client";
import { useState } from "react";
import { BookOpen, Plus, Pencil, Trash2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HistoryAnalysis, Meal } from "@/domain/models";
import { localDate } from "@/domain/meals";
import { Choice, Field } from "./controls";
import { getJson } from "./api";
import { nutritionForGrams, type CatalogFood } from "@/domain/foods";
import type { MealParseResult } from "@/providers/ai";
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
        <h2>기록한 식사</h2>
        <span className="caption">실제 식사와 계획을 구분해요</span>
      </div>
      {!meals.length ? (
        <div className="empty-state panel">
          <BookOpen size={32} />
          <h3>첫 한 끼를 남겨보세요</h3>
          <p>음식 이름만 입력해도 괜찮아요. 양을 모르면 미상으로 남겨요.</p>
          <button className="primary-button" onClick={onNew}>
            첫 식사 기록
          </button>
        </div>
      ) : (
        <div className="meal-list">
          {meals.map((m) => (
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
                className="icon-button"
                aria-label={m.items[0]?.name + " 수정"}
                onClick={() => onEdit(m)}
              >
                <Pencil size={16} />
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
  onParse,
}: {
  meal: Meal | null;
  initialDay?: string;
  placeName?: string;
  busy: boolean;
  onClose: () => void;
  onSave: (draft: MealDraft, id?: string) => Promise<void>;
  onParse: (text: string) => Promise<MealParseResult>;
}) {
  const [draft, setDraft] = useState<MealDraft>({
    raw: meal?.raw ?? "",
    day: meal?.day ?? initialDay ?? localDate(new Date()),
    slot: meal?.slot ?? "lunch",
    timezone:
      meal?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    status: meal?.status ?? "confirmed",
    source: meal?.source ?? "manual",
    foodId: meal?.items.length === 1 ? meal.items[0].foodId : null,
    amount: meal?.items.length === 1 ? meal.items[0].amount : null,
    unit: meal?.items.length === 1 ? meal.items[0].unit : null,
    idempotencyKey: crypto.randomUUID(),
  });
  const [mode, setMode] = useState("manual"),
    [query, setQuery] = useState(""),
    [foods, setFoods] = useState<CatalogFood[]>([]),
    [selectedFood, setSelectedFood] = useState<CatalogFood | null>(
      meal?.items[0]?.foodReference ?? null,
    ),
    [searchNotice, setSearchNotice] = useState(
      "음식 이름으로 검색하면 자료의 출처와 기준량을 표시해요.",
    ),
    [parsed, setParsed] = useState<MealParseResult | null>(null),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const set = <K extends keyof MealDraft>(k: K, v: MealDraft[K]) =>
    setDraft({ ...draft, [k]: v });
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="flow-dialog wide-dialog">
        <DialogHeader>
          <DialogTitle>
            {meal ? "식사 기록 수정" : "한 끼 기록하기"}
          </DialogTitle>
          <DialogDescription>
            음식명과 드신 양을 적어주세요. 사진 분석은 지원하지 않아요.
          </DialogDescription>
        </DialogHeader>
        {placeName && (
          <p className="notice-box">
            선택한 식당: {placeName}
            <br />
            실제로 드신 음식을 입력해 주세요. 식당을 선택한 것만으로 식사가
            기록되지는 않아요.
          </p>
        )}
        <Tabs value={mode} onValueChange={setMode}>
          <TabsList>
            <TabsTrigger value="manual">직접 입력</TabsTrigger>
            <TabsTrigger value="search">메뉴 검색</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === "search" && (
          <>
            <Field label="음식 검색">
              <div className="button-row">
                <input
                  aria-label="음식 검색"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button
                  className="outline-button"
                  disabled={pending || !query.trim()}
                  onClick={async () => {
                    setPending(true);
                    try {
                      const d = await getJson<{
                        items: typeof foods;
                        notice: string;
                      }>("foods?q=" + encodeURIComponent(query));
                      setFoods(d.items);
                      setSearchNotice(d.notice);
                      setError(
                        d.items.length
                          ? ""
                          : "검색 결과가 없어요. 직접 입력으로 기록할 수 있어요.",
                      );
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  <Search size={16} />
                  검색
                </button>
              </div>
            </Field>
            <p className="caption">{searchNotice}</p>
            <div className="food-search-results">
              {foods.map((f) => (
                <button
                  className="search-item"
                  key={f.id}
                  aria-pressed={draft.foodId === f.id}
                  onClick={() => {
                    setDraft({
                      ...draft,
                      raw: f.name,
                      source: "search",
                      foodId: f.id,
                      amount: null,
                      unit: null,
                    });
                    setParsed(null);
                    setSelectedFood(f);
                    setFoods([]);
                  }}
                >
                  <span>
                    {f.name}
                    <small>
                      {f.provider} · DB 기준 {f.basis}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
        <Field
          label="먹은 음식"
          hint="예: 계란 2개, 밥 반 공기, 김치 조금. 쉼표로 구분하면 더 잘 나눌 수 있어요."
        >
          <textarea
            aria-label="먹은 음식"
            rows={3}
            maxLength={2000}
            value={draft.raw}
            onChange={(e) => {
              setDraft({
                ...draft,
                raw: e.target.value,
                source: "manual",
                foodId: null,
                amount: null,
                unit: null,
              });
              setParsed(null);
              setSelectedFood(null);
            }}
            placeholder="무엇을 드셨나요?"
          />
        </Field>
        {selectedFood && (
          <section className="food-reference">
            <strong>
              {selectedFood.name} · DB 기준 {selectedFood.basis}
            </strong>
            <NutritionValues nutrition={selectedFood.nutrition} />
            <p className="caption">
              위 수치는 DB 기준량의 값이며, 실제로 드신 양이 아니에요.
            </p>
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
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    amount: e.target.value ? Number(e.target.value) : null,
                    unit: e.target.value ? "g" : null,
                  })
                }
              />
            </Field>
            <small>입력한 중량으로 계산한 추정 영양량</small>
            <NutritionValues
              nutrition={nutritionForGrams(selectedFood, draft.amount)}
            />
            {selectedFood.sourceUrl && (
              <a
                href={selectedFood.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {selectedFood.provider} ·{" "}
                {selectedFood.updatedAt ?? "갱신일 미확인"} ↗
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
          <Field label="현지 시간대">
            <input
              aria-label="현지 시간대"
              value={draft.timezone}
              onChange={(e) => set("timezone", e.target.value)}
            />
          </Field>
        </div>
        {parsed && (
          <div className="parse-preview">
            <strong>입력에서 구분한 음식</strong>
            <p className="caption">{parsed.notice}</p>
            {parsed.items.map((p, i) => (
              <p key={i}>
                {p.name} ·{" "}
                {p.amount === null ? "양 미상" : p.amount + " " + p.unit}
              </p>
            ))}
            {parsed.normalizedText && (
              <button
                className="outline-button"
                onClick={() => {
                  setDraft({
                    ...draft,
                    raw: parsed.normalizedText!,
                    foodId: null,
                    source: "manual",
                    amount: null,
                    unit: null,
                  });
                  setSelectedFood(null);
                  setParsed(null);
                }}
              >
                구분한 내용 적용
              </button>
            )}
            <small>
              재료·알레르기 성분은 이름만으로 추정하지 않았어요. 위 입력을
              수정할 수 있어요.
            </small>
          </div>
        )}
        {error && (
          <p role="alert" className="warning">
            {error}
          </p>
        )}
        <div className="button-row">
          <button
            className="outline-button"
            disabled={!draft.raw.trim() || busy || pending || !!draft.foodId}
            onClick={async () => {
              setPending(true);
              try {
                setParsed(await onParse(draft.raw));
                setError("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "확인 중…" : "입력 내용 미리 확인"}
          </button>
          <button
            className="primary-button"
            disabled={!draft.raw.trim() || busy || pending}
            onClick={() => onSave(draft, meal?.id)}
          >
            {meal
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
