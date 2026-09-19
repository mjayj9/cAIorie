"use client";
import { useState } from "react";
import { Check, Clock, Star, Utensils } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  Meal,
  Selection,
  Feedback,
  RankedCandidate,
} from "@/domain/models";
import { Check as CheckField, Choice, Field, money } from "./controls";
export function PendingMeal({
  selection,
  busy,
  onConfirm,
}: {
  selection: Selection;
  busy: boolean;
  onConfirm: (
    action: "eaten" | "changed" | "not_eaten" | "later",
    text?: string,
  ) => void;
}) {
  const [changed, setChanged] = useState(false),
    [text, setText] = useState(""),
    [hidden, setHidden] = useState(false);
  if (hidden)
    return (
      <button
        className="text-button pending-reopen"
        onClick={() => setHidden(false)}
      >
        <Clock size={15} />
        선택한 식사 확인하기
      </button>
    );
  return (
    <section className="pending-meal">
      <span className="mini-icon mint">
        <Utensils />
      </span>
      <div>
        <span className="eyebrow">선택은 기록이 아니에요</span>
        <h3>{selection.menu.name}, 실제로 드셨나요?</h3>
        <p>{selection.placeName} · 아직 식사 기록에 반영되지 않았어요.</p>
        {changed && (
          <Field label="실제로 먹은 음식">
            <input
              aria-label="실제로 먹은 음식"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="실제 드신 메뉴를 적어주세요"
            />
          </Field>
        )}
        <div className="button-row">
          {changed ? (
            <button
              className="primary-button"
              disabled={busy || !text.trim()}
              onClick={() => onConfirm("changed", text)}
            >
              이 식사로 확인
            </button>
          ) : (
            <>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() => onConfirm("eaten")}
              >
                <Check size={16} />
                먹었어요
              </button>
              <button
                className="outline-button"
                disabled={busy}
                onClick={() => setChanged(true)}
              >
                다른 걸 먹었어요
              </button>
            </>
          )}
          <button
            className="outline-button"
            disabled={busy}
            onClick={() => onConfirm("not_eaten")}
          >
            먹지 않았어요
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setHidden(true);
              onConfirm("later");
            }}
          >
            나중에
          </button>
        </div>
      </div>
    </section>
  );
}
export function SelectionDialog({
  candidate: c,
  busy,
  onClose,
  onConfirm,
}: {
  candidate: RankedCandidate;
  busy: boolean;
  onClose: () => void;
  onConfirm: (ack: boolean, reason: string | null) => void;
}) {
  const [ack, setAck] = useState(false),
    [reason, setReason] = useState("none");
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="flow-dialog">
        <DialogHeader>
          <DialogTitle>이 점심으로 골라볼까요?</DialogTitle>
          <DialogDescription>
            선택만으로 먹은 식사를 기록하지 않아요.
          </DialogDescription>
        </DialogHeader>
        <div className="selection-summary">
          <span className="pill">{c.place.name}</span>
          <h2>{c.menu.name}</h2>
          <strong>{money(c.menu.price.value)}</strong>
        </div>
        {c.safety.mustShowWarnings.map((w, i) => (
          <p className="safety-note" key={i}>
            {w}
          </p>
        ))}
        {c.candidateStatus === "conditional" && (
          <CheckField
            label="미확인 가격·시간·운영 조건은 식당에 확인할게요"
            checked={ack}
            onChange={setAck}
            hint={c.missingFields.join(", ")}
          />
        )}
        <Choice
          label="선택 이유 · 선택사항"
          value={reason}
          onChange={setReason}
          options={[
            { value: "none", label: "건너뛰기" },
            ...["맛", "가격", "거리", "동행", "기타"].map((x) => ({
              value: x,
              label: x,
            })),
          ]}
        />
        <button
          className="primary-button full"
          disabled={
            busy ||
            (c.candidateStatus === "conditional" && !ack) ||
            c.safety.status !== "reviewed"
          }
          onClick={() => onConfirm(ack, reason === "none" ? null : reason)}
        >
          이 메뉴 선택하기
        </button>
      </DialogContent>
    </Dialog>
  );
}
export function FeedbackDialog({
  meal,
  mode,
  busy,
  onClose,
  onSave,
}: {
  meal: Meal;
  mode: "B" | "C";
  busy: boolean;
  onClose: () => void;
  onSave: (f: Feedback) => void;
}) {
  const [rating, setRating] = useState(0),
    [reasons, setReasons] = useState<string[]>([]),
    [comment, setComment] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="flow-dialog">
        <DialogHeader>
          <DialogTitle>오늘의 한 끼, 어떠셨나요?</DialogTitle>
          <DialogDescription>
            {meal.items.map((i) => i.name).join(", ")} · 별점만 남겨도 충분해요.
          </DialogDescription>
        </DialogHeader>
        <div className="star-picker" role="group" aria-label="식사 만족도">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              aria-label={n + "점"}
              aria-pressed={rating === n}
              onClick={() => setRating(n)}
            >
              <Star
                size={35}
                fill={n <= rating ? "#c3a349" : "none"}
                color={n <= rating ? "#a68b40" : "#c8d2ca"}
              />
            </button>
          ))}
        </div>
        {mode === "C" && (
          <>
            <p className="caption">식후 평가 이유 · 선택사항</p>
            <div className="feedback-reasons">
              {[
                "맛",
                "가격",
                "거리",
                "양",
                "대기",
                "식사 균형",
                "동행",
                "기타",
              ].map((r) => (
                <CheckField
                  label={r}
                  checked={reasons.includes(r)}
                  key={r}
                  onChange={(v) =>
                    setReasons(
                      v ? [...reasons, r] : reasons.filter((x) => x !== r),
                    )
                  }
                />
              ))}
            </div>
            <Field label="자유 의견 · 선택">
              <textarea
                aria-label="자유 의견"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={500}
                rows={2}
              />
            </Field>
          </>
        )}
        <div className="button-row">
          <button className="outline-button" onClick={onClose}>
            건너뛰기
          </button>
          <button
            className="primary-button"
            disabled={!rating || busy}
            onClick={() =>
              onSave({
                mealId: meal.id,
                rating,
                reasons,
                comment,
                selectionReason: null,
                mode,
              })
            }
          >
            평가 마치기
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
