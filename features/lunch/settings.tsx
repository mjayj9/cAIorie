"use client";
import { useState } from "react";
import { Save, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Profile, SessionState } from "@/domain/models";
import { CRITERIA } from "@/domain/models";
import { displayWeight, normalizedWeight } from "@/domain/scoring";
import { ConditionsForm } from "./conditions";
import {
  Check,
  Choice,
  Field,
  NumberField,
  Toggle,
  ListInput,
  NamedSlider,
} from "./controls";
const criterionLabels = {
  health: "건강 관련 적합도",
  taste: "나의 취향",
  price: "가격",
  distance: "거리",
  rating: "평점·평가",
};

export function SettingsView({
  state,
  busy,
  sensitiveStorageAvailable,
  onSave,
  onReset,
}: {
  state: SessionState;
  busy: boolean;
  sensitiveStorageAvailable: boolean;
  onSave: (s: SessionState) => Promise<void>;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(state)),
    s = draft.settings,
    p = draft.profile,
    c = draft.consents;
  const settings = (patch: Partial<typeof s>) =>
    setDraft({ ...draft, settings: { ...s, ...patch } });
  const profile = (patch: Partial<Profile>) =>
    setDraft({ ...draft, profile: { ...p, ...patch } });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR LUNCH, YOUR RULES</p>
          <h1>내 기준으로 고르는 점심</h1>
          <p>직접 정한 중요도와 학습된 취향을 따로 관리해요.</p>
        </div>
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => onSave(draft)}
        >
          <Save size={17} />
          설정 저장
        </button>
      </div>
      <Tabs defaultValue="recommend">
        <TabsList className="settings-tabs">
          <TabsTrigger value="recommend">추천 기준</TabsTrigger>
          <TabsTrigger value="profile">나의 프로필</TabsTrigger>
          <TabsTrigger value="learning">학습·알림</TabsTrigger>
        </TabsList>
        <TabsContent value="recommend">
          <div className="settings-grid">
            <section className="panel">
              <div className="section-heading">
                <h2>무엇이 더 중요한가요?</h2>
                <SlidersHorizontal size={20} />
              </div>
              <Choice
                label="중요도 표시 척도"
                value={String(s.scale)}
                onChange={(v) => settings({ scale: Number(v) as 5 | 10 })}
                options={[
                  { value: "5", label: "5점 보기" },
                  { value: "10", label: "10점 보기" },
                ]}
              />
              <p className="caption">
                척도는 표현만 바꾸고 추천 순위는 유지해요. 0은 ‘고려 안
                함’이에요.
              </p>
              {CRITERIA.map((k) => (
                <div className="weight-row" key={k}>
                  <div>
                    <label>{criterionLabels[k]}</label>
                    <strong>
                      {displayWeight(s.weights[k], s.scale).toFixed(1)}{" "}
                      <small>/ {s.scale}</small>
                    </strong>
                  </div>
                  <NamedSlider
                    label={criterionLabels[k] + " 중요도"}
                    value={[displayWeight(s.weights[k], s.scale)]}
                    max={s.scale}
                    min={0}
                    step={s.scale === 5 ? 0.5 : 1}
                    onValueChange={(v) =>
                      settings({
                        weights: {
                          ...s.weights,
                          [k]: normalizedWeight(v[0], s.scale),
                        },
                      })
                    }
                  />
                </div>
              ))}
              <div className="notice-box">
                <ShieldCheck size={18} />
                <p>
                  알레르기·의료상 제한은 중요도를 낮춰도 유지돼요. 검증되지 않은
                  건강 적합도는 미확인으로 남겨요.
                </p>
              </div>
              <Choice
                label="기본 결과 화면"
                value={s.displayMode}
                onChange={(v) =>
                  settings({ displayMode: v as typeof s.displayMode })
                }
                options={[
                  { value: "normal", label: "일반 · 근거와 정보 함께" },
                  { value: "simple", label: "간단 · 핵심만 보기" },
                ]}
              />
            </section>
            <section className="panel">
              <h2>평소 점심 조건</h2>
              <p className="caption section-intro">
                미설정이면 제한하지 않아요. 오늘만 변경한 조건과 구분해요.
              </p>
              <ConditionsForm
                value={s.conditions}
                onChange={(v) => settings({ conditions: v })}
              />
              <Toggle
                label="기본 조건·취향 보관"
                checked={c.savePreferences}
                onChange={(v) =>
                  setDraft({ ...draft, consents: { ...c, savePreferences: v } })
                }
                hint="끄면 새로고침 후 기본 상태로 돌아가요."
              />
            </section>
          </div>
          <section className="panel section-space">
            <h2>나만의 맛집 기준</h2>
            <p className="caption section-intro">
              평점 항목 안에서만 반영해요. 없는 리뷰 정보를 만들어내지 않아요.
            </p>
            <div className="rating-settings">
              {Object.entries({
                rating: "평점",
                count: "리뷰 수",
                recency: "최근 리뷰",
                menuPraise: "메뉴 호평 근거",
                consistency: "출처 간 일관성",
              }).map(([k, label]) => (
                <div className="weight-row" key={k}>
                  <div>
                    <label>{label}</label>
                    <strong>
                      {s.ratingWeights[k as keyof typeof s.ratingWeights]}
                    </strong>
                  </div>
                  <NamedSlider
                    label={label + " 중요도"}
                    min={0}
                    max={5}
                    step={1}
                    value={[s.ratingWeights[k as keyof typeof s.ratingWeights]]}
                    onValueChange={(v) =>
                      settings({
                        ratingWeights: { ...s.ratingWeights, [k]: v[0] },
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="form-grid">
              <NumberField
                label="평점 하한 · 5점 기준"
                value={s.conditions.minRating}
                onChange={(v) =>
                  settings({ conditions: { ...s.conditions, minRating: v } })
                }
                unit="점"
                max={5}
              />
              <NumberField
                label="리뷰 수 하한"
                value={s.conditions.minReviews}
                onChange={(v) =>
                  settings({ conditions: { ...s.conditions, minReviews: v } })
                }
                unit="개"
                max={100000}
              />
            </div>
          </section>
        </TabsContent>
        <TabsContent value="profile">
          <section className="panel profile-panel">
            <h2>필요한 정보만 추가하세요</h2>
            <p className="caption section-intro">
              추가 조건을 추천에 반영할 수 있어요. 선택 정보 없이도 일반 추천을
              사용할 수 있어요.
            </p>
            <div className="form-grid">
              <Choice
                label="연령 구간"
                value={p.ageBand}
                onChange={(v) => profile({ ageBand: v as Profile["ageBand"] })}
                options={[
                  { value: "not_provided", label: "미입력" },
                  {
                    value: "under14",
                    label: "만 14세 미만 · 개인정보 없는 데모",
                  },
                  { value: "teen", label: "만 14~18세" },
                  { value: "adult", label: "만 19세 이상" },
                ]}
              />
              <Field label="영양 기준 국가">
                <input
                  aria-label="영양 기준 국가"
                  value={p.nutritionCountry}
                  maxLength={2}
                  onChange={(e) =>
                    profile({ nutritionCountry: e.target.value.toUpperCase() })
                  }
                />
              </Field>
              <ListInput
                label="좋아하는 음식·문화권"
                values={p.likes}
                onChange={(likes) => profile({ likes })}
                hint="쉼표로 구분 · 예: 한식, 돈가스"
              />
              <ListInput
                label="단순히 선호하지 않는 음식"
                values={p.dislikes}
                onChange={(dislikes) => profile({ dislikes })}
              />
              <ListInput
                label="절대 제외 음식"
                values={p.excluded}
                onChange={(excluded) => profile({ excluded })}
              />
            </div>
            <div className="section-divider" />
            <h3>알레르기·건강 관련 정보</h3>
            <Toggle
              label="민감정보를 현재 추천에 사용"
              checked={c.sensitiveProcessing}
              onChange={(v) => {
                const base = {
                  ...draft,
                  consents: {
                    ...c,
                    sensitiveProcessing: v,
                    saveSensitive: v && c.saveSensitive,
                  },
                };
                if (!v)
                  base.profile = {
                    ...p,
                    allergyStatus: "declined",
                    restrictions: [],
                    sex: "unspecified",
                    heightCm: null,
                    weightKg: null,
                  };
                setDraft(base);
              }}
              hint="알레르기·의료진 제한·신체 정보의 일시적 처리에 별도로 동의해요."
            />
            <div className="form-grid">
              <Choice
                label="알레르기 정보 상태"
                value={p.allergyStatus}
                onChange={(v) =>
                  profile({
                    allergyStatus: v as Profile["allergyStatus"],
                    restrictions:
                      v === "provided"
                        ? p.restrictions
                        : p.restrictions.filter(
                            (r) => r.kind !== "food_allergy",
                          ),
                  })
                }
                options={[
                  { value: "unknown", label: "잘 모름" },
                  { value: "none", label: "없음" },
                  { value: "provided", label: "알레르기 있음" },
                  { value: "declined", label: "입력하지 않음" },
                ]}
              />
              {p.allergyStatus === "provided" && (
                <ListInput
                  label="알레르기 유발 식품"
                  values={p.restrictions
                    .filter((r) => r.kind === "food_allergy")
                    .map((r) => r.value)}
                  disabled={!c.sensitiveProcessing}
                  onChange={(values) =>
                    profile({
                      restrictions: [
                        ...p.restrictions.filter(
                          (r) => r.kind !== "food_allergy",
                        ),
                        ...values.map((value) => ({
                          kind: "food_allergy" as const,
                          value,
                          history: "unspecified" as const,
                        })),
                      ],
                    })
                  }
                />
              )}
              <ListInput
                label="의료진이 명시한 제외 원재료"
                values={p.restrictions
                  .filter((r) => r.kind === "clinician_restriction")
                  .map((r) => r.value)}
                disabled={!c.sensitiveProcessing}
                onChange={(values) =>
                  profile({
                    restrictions: [
                      ...p.restrictions.filter(
                        (r) => r.kind !== "clinician_restriction",
                      ),
                      ...values.map((value) => ({
                        kind: "clinician_restriction" as const,
                        value,
                        history: "unspecified" as const,
                      })),
                    ],
                  })
                }
                hint="질환명으로 치료식을 추정하지 않아요."
              />
            </div>
            <Check
              label="심한 반응·미량 반응 이력이 있어요"
              checked={p.restrictions.some(
                (r) => r.history === "severe_or_trace_sensitive",
              )}
              disabled={!c.sensitiveProcessing}
              onChange={(v) =>
                profile({
                  restrictions: p.restrictions.map((r) => ({
                    ...r,
                    history: v ? "severe_or_trace_sensitive" : "unspecified",
                  })),
                })
              }
            />
            {c.sensitiveProcessing && (
              <div className="form-grid">
                <Choice
                  label="영양 기준 분류용 성별 · 선택"
                  value={p.sex}
                  onChange={(v) => profile({ sex: v as Profile["sex"] })}
                  options={[
                    { value: "unspecified", label: "입력하지 않음" },
                    { value: "female", label: "여성 기준" },
                    { value: "male", label: "남성 기준" },
                  ]}
                />
                <NumberField
                  label="키 · 선택"
                  value={p.heightCm}
                  onChange={(heightCm) => profile({ heightCm })}
                  unit="cm"
                  min={30}
                  max={250}
                />
                <NumberField
                  label="몸무게 · 선택"
                  value={p.weightKg}
                  onChange={(weightKg) => profile({ weightKg })}
                  unit="kg"
                  min={1}
                  max={400}
                />
              </div>
            )}
            <Toggle
              label="민감정보를 암호화하여 보관"
              checked={c.saveSensitive}
              disabled={!sensitiveStorageAvailable || !c.sensitiveProcessing}
              onChange={(v) =>
                setDraft({ ...draft, consents: { ...c, saveSensitive: v } })
              }
              hint={
                sensitiveStorageAvailable
                  ? "개인 프로필만 암호화 보관하며 언제든 삭제할 수 있어요."
                  : "서버 암호화 키 미설정 · 현재는 이번 페이지에서만 사용해요."
              }
            />
            <p className="caption">
              성인용 BMI 분류와 식생활평가지수를 청소년에게 적용하지 않습니다.
            </p>
            <div className="section-divider" />
            <h3>관리 관심 항목</h3>
            <div className="button-row">
              {["다양성", "채소", "나트륨 정보"].map((i) => (
                <Check
                  key={i}
                  label={i}
                  checked={s.interests.includes(i)}
                  onChange={(v) =>
                    settings({
                      interests: v
                        ? [...s.interests, i]
                        : s.interests.filter((x) => x !== i),
                    })
                  }
                />
              ))}
            </div>
            <Choice
              label="관리 안내 강도"
              value={s.guidance}
              onChange={(v) => settings({ guidance: v as typeof s.guidance })}
              options={[
                { value: "relaxed", label: "편안하게" },
                { value: "normal", label: "보통" },
                { value: "active", label: "적극적으로" },
              ]}
            />
            <p className="caption">
              이 설정은 공식 영양 기준이나 안전 정책을 변경하지 않아요.
            </p>
          </section>
        </TabsContent>
        <TabsContent value="learning">
          <div className="settings-grid">
            <section className="panel">
              <h2>피드백과 취향 반영</h2>
              <Choice
                label="피드백 모드"
                value={s.feedbackMode}
                onChange={(v) => settings({ feedbackMode: v as "B" | "C" })}
                options={[
                  { value: "C", label: "C · 만족도 + 선택적인 이유" },
                  { value: "B", label: "B · 만족도만" },
                ]}
              />
              <Toggle
                label="동의한 기록에서 취향 학습"
                checked={c.personalization}
                onChange={(v) =>
                  setDraft({ ...draft, consents: { ...c, personalization: v } })
                }
                hint="맛이라고 명시한 실제 식후 평가만 반영해요. 가격·거리 가중치는 바꾸지 않아요."
              />
              <p>반영할 수 있는 관찰: {state.learning.observations}회</p>
              <div className="criteria-list">
                {Object.entries(state.learning.taste).map(([k, v]) => (
                  <div key={k}>
                    <span>{k}</span>
                    <strong>
                      {v > 0 ? "+" : ""}
                      {v} / 취향 항목
                    </strong>
                  </div>
                ))}
              </div>
              <button className="outline-button" onClick={onReset}>
                학습된 취향 초기화
              </button>
              <p className="caption section-intro">
                큰 설정 변경 제안은 최소 10회 관찰·14일 간격, 거절 후 30일
                제한을 적용해요. 충분한 비교 근거가 없으면 제안하지 않아요.
              </p>
            </section>
            <section className="panel">
              <h2>내가 정하는 알림</h2>
              <Toggle
                label="점심 알림"
                checked={false}
                onChange={() => {}}
                disabled
                hint="현재 OFF · 앱 종료 후 푸시/서버 스케줄러 연결 필요"
              />
              <Field label="희망 알림 시각">
                <input
                  aria-label="희망 알림 시각"
                  type="time"
                  value={s.notifications.time}
                  onChange={(e) =>
                    settings({
                      notifications: {
                        ...s.notifications,
                        time: e.target.value,
                      },
                    })
                  }
                />
              </Field>
              <div className="week-options">
                {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
                  <Check
                    label={day}
                    key={i}
                    checked={s.notifications.days.includes(i)}
                    onChange={(v) =>
                      settings({
                        notifications: {
                          ...s.notifications,
                          days: v
                            ? [...s.notifications.days, i]
                            : s.notifications.days.filter((d) => d !== i),
                        },
                      })
                    }
                  />
                ))}
              </div>
              <Field label="알림 시간대">
                <input
                  aria-label="알림 시간대"
                  value={s.notifications.timezone}
                  onChange={(e) =>
                    settings({
                      notifications: {
                        ...s.notifications,
                        timezone: e.target.value,
                      },
                    })
                  }
                />
              </Field>
              <div className="notice-box">
                <p>
                  시간 설정은 보관할 수 있지만 알림 예약은 아닙니다. 선택한
                  식사는 앱 내부 확인 카드에서 확인할 수 있어요.
                </p>
              </div>
            </section>
          </div>
        </TabsContent>
      </Tabs>
      <div className="save-footer">
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => onSave(draft)}
        >
          <Save size={17} />
          변경사항 저장
        </button>
      </div>
    </>
  );
}
