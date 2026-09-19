"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Conditions } from "@/domain/models";
import { Check, Choice, Field, NumberField } from "./controls";
import { DistanceInput } from "./distance-input";
import { conditionsSchema } from "@/domain/schemas";
export { LocationDialog } from "./location-dialog";
export function ConditionsForm({
  value,
  onChange,
}: {
  value: Conditions;
  onChange: (v: Conditions) => void;
}) {
  const set = <K extends keyof Conditions>(key: K, v: Conditions[K]) =>
    onChange({ ...value, [key]: v });
  return (
    <div className="form-grid">
      <NumberField
        label="1인 예산"
        value={value.budget}
        onChange={(v) => set("budget", v)}
        unit={value.currency}
      />
      <DistanceInput
        value={value.maxDistance}
        onChange={(v) => set("maxDistance", v)}
      />
      <NumberField
        label="식사 가능 시간"
        value={value.availableMinutes}
        onChange={(v) => set("availableMinutes", v)}
        unit="분"
        min={1}
        max={600}
      />
      <NumberField
        label="동행 인원"
        value={value.partySize}
        onChange={(v) => set("partySize", v ?? 1)}
        unit="명"
        min={1}
        max={20}
      />
      <Choice
        label="식사 방식"
        value={value.serviceMode}
        onChange={(v) => set("serviceMode", v as Conditions["serviceMode"])}
        options={[
          { value: "dine_in", label: "매장에서 먹어요" },
          { value: "takeout", label: "포장할게요" },
        ]}
      />
      <Choice
        label="통화"
        value={value.currency}
        onChange={(v) => set("currency", v)}
        options={[
          { value: "KRW", label: "KRW · 대한민국 원" },
          { value: "JPY", label: "JPY · 일본 엔" },
          { value: "USD", label: "USD · 미국 달러" },
        ]}
      />
      <Field label="오늘 먹고 싶은 음식">
        <input
          aria-label="오늘 먹고 싶은 음식"
          value={value.craving}
          maxLength={100}
          placeholder="예: 돈가스, 한식"
          onChange={(e) => set("craving", e.target.value)}
        />
      </Field>
      <Check
        label="복귀 이동시간도 포함"
        checked={value.returnTrip}
        onChange={(v) => set("returnTrip", v)}
        hint="이동·대기·식사 시간이 확인된 경우에만 비교해요."
      />
    </div>
  );
}
export function ConditionsDialog({
  value,
  onSave,
  onClose,
}: {
  value: Conditions;
  onSave: (v: Conditions, asDefault: boolean) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(value),
    [saveDefault, setSaveDefault] = useState(false),
    [error, setError] = useState("");
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="flow-dialog wide-dialog">
        <DialogHeader>
          <DialogTitle>오늘만 조건 변경</DialogTitle>
          <DialogDescription>
            비워 둔 항목은 제한하지 않아요. 이동 반경은 직선거리 기준이며 실제
            경로와 달라요.
          </DialogDescription>
        </DialogHeader>
        <ConditionsForm value={draft} onChange={setDraft} />
        {error && (
          <p className="warning" role="alert">
            {error}
          </p>
        )}
        <Check
          label="평소 기본값으로도 저장"
          checked={saveDefault}
          onChange={setSaveDefault}
        />
        <button
          className="primary-button"
          onClick={() => {
            const checked = conditionsSchema.safeParse(draft);
            if (!checked.success) {
              setError(
                "입력 범위를 확인해 주세요. 반경은 0보다 크고 50km 이하, 시간은 1~600분, 인원은 1~20명이에요.",
              );
              return;
            }
            onSave(checked.data, saveDefault);
          }}
        >
          조건 적용하기
        </button>
      </DialogContent>
    </Dialog>
  );
}
