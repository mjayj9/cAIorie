"use client";
import { useState } from "react";
import type { Conditions, Profile } from "@/domain/models";
import {
  profile as defaultProfile,
  conditions as defaultConditions,
} from "@/domain/defaults";
import { Check, Choice, Field, NumberField, splitList } from "./controls";
export function GuestForm({
  busy,
  onAdd,
}: {
  busy: boolean;
  onAdd: (label: string, profile: Profile, conditions: Conditions) => void;
}) {
  const [label, setLabel] = useState("동행인"),
    [age, setAge] = useState<Profile["ageBand"]>("not_provided"),
    [budget, setBudget] = useState<number | null>(null),
    [likes, setLikes] = useState(""),
    [excluded, setExcluded] = useState(""),
    [consent, setConsent] = useState(false);
  return (
    <details className="guest-form">
      <summary>동행인의 동의를 받아 간단히 입력</summary>
      <p className="caption section-intro">
        상세 건강정보는 초대 링크에서 각자 입력하도록 안내해 주세요. 입력한
        동행인 정보는 이 모임에서만 사용하고 24시간 이내 만료됩니다.
      </p>
      <div className="form-grid">
        <Field label="동행인 임시 이름">
          <input
            aria-label="동행인 임시 이름"
            value={label}
            maxLength={20}
            onChange={(e) => setLabel(e.target.value)}
          />
        </Field>
        <Choice
          label="동행인 연령 구간"
          value={age}
          onChange={(v) => setAge(v as Profile["ageBand"])}
          options={[
            { value: "not_provided", label: "확인해 주세요" },
            { value: "teen", label: "만 14~18세" },
            { value: "adult", label: "만 19세 이상" },
          ]}
        />
        <NumberField
          label="동행인 1인 예산"
          value={budget}
          onChange={setBudget}
          unit="KRW"
        />
        <Field label="동행인 선호 음식">
          <input
            aria-label="동행인 선호 음식"
            value={likes}
            onChange={(e) => setLikes(e.target.value)}
            placeholder="쉼표로 구분"
          />
        </Field>
        <Field label="동행인 절대 제외 음식">
          <input
            aria-label="동행인 절대 제외 음식"
            value={excluded}
            onChange={(e) => setExcluded(e.target.value)}
          />
        </Field>
      </div>
      <Check
        label="당사자가 이 조건의 임시 공유에 동의했어요"
        checked={consent}
        onChange={setConsent}
        hint="만 14세 미만의 개인정보는 이 경로에서도 받지 않습니다. 알레르기는 확인되지 않은 상태로 안내합니다."
      />
      <button
        className="outline-button"
        disabled={busy || !consent || age === "not_provided" || !label.trim()}
        onClick={() =>
          onAdd(
            label,
            {
              ...defaultProfile,
              ageBand: age,
              likes: splitList(likes),
              excluded: splitList(excluded),
            },
            { ...defaultConditions, budget },
          )
        }
      >
        동행인 조건 추가
      </button>
    </details>
  );
}
