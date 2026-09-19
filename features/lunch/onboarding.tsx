"use client";
import { useState } from "react";
import { ArrowRight, Leaf, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SessionState } from "@/domain/models";
import { Check, Choice, ListInput } from "./controls";
export function Onboarding({
  open,
  state,
  busy,
  onClose,
  onSave,
  onBrowse,
}: {
  open: boolean;
  state: SessionState;
  busy: boolean;
  onClose: () => void;
  onSave: (s: SessionState) => Promise<void>;
  onBrowse: () => void;
}) {
  const [step, setStep] = useState(0),
    [draft, setDraft] = useState(() => structuredClone(state));
  const p = draft.profile,
    c = draft.consents;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="flow-dialog">
        <DialogHeader>
          <span className="dialog-symbol">
            <Leaf />
          </span>
          <DialogTitle>
            {step === 0
              ? "나를 위한 한 끼, 가볍게 시작해요"
              : "추천에 필요한 것만 알려주세요"}
          </DialogTitle>
          <DialogDescription>
            {step === 0
              ? "필요한 항목만 선택하세요. 모든 보관 동의는 선택이며 설정에서 언제든 철회할 수 있어요."
              : "키·몸무게 없이도 사용할 수 있어요. 알레르기 미입력은 ‘없음’으로 저장하지 않아요."}
          </DialogDescription>
        </DialogHeader>
        {step === 0 ? (
          <>
            <div className="notice-box">
              <ShieldCheck size={20} />
              <p>
                선택한 조건은 추천에 사용됩니다. 현재 위치는 요청할 때만
                사용하고 이력을 저장하지 않아요. 데모의 식당·사진·가격은
                가상입니다.
              </p>
            </div>
            <Check
              label="식사 기록 보관"
              checked={c.saveMeals}
              onChange={(v) =>
                setDraft({ ...draft, consents: { ...c, saveMeals: v } })
              }
              hint="이 서버에서 최대 30일 보관. 끄면 기존 기록과 식후 평가가 삭제돼요."
            />
            <Check
              label="취향과 기본 조건 보관"
              checked={c.savePreferences}
              onChange={(v) =>
                setDraft({ ...draft, consents: { ...c, savePreferences: v } })
              }
              hint="이 브라우저 세션에서 다음 방문에도 설정을 불러와요."
            />
            <Check
              label="식후 평가로 취향 반영"
              checked={c.personalization}
              onChange={(v) =>
                setDraft({ ...draft, consents: { ...c, personalization: v } })
              }
              hint="동의한 식사 기록의 ‘맛’ 평가만 작은 취향 보정에 사용해요."
            />
            <p className="caption">
              비회원 세션은 최대 24시간, 기록·설정을 보관하면 비활동 30일 후
              만료돼요. 외부 AI 전송은 기본 OFF이며 개인정보 관리에서 별도로
              동의할 수 있어요.
            </p>
            <button className="primary-button full" onClick={() => setStep(1)}>
              다음
              <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <>
            <Choice
              label="연령 구간"
              value={p.ageBand}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  profile: { ...p, ageBand: v as typeof p.ageBand },
                })
              }
              options={[
                { value: "not_provided", label: "선택해 주세요" },
                { value: "under14", label: "만 14세 미만" },
                { value: "teen", label: "만 14~18세" },
                { value: "adult", label: "만 19세 이상" },
              ]}
            />
            {p.ageBand === "under14" ? (
              <div className="notice-box">
                <p>
                  보호자 확인 기능이 아직 준비되지 않았어요. 개인정보를 입력하지
                  않는 데모 둘러보기를 이용할 수 있어요.
                </p>
              </div>
            ) : (
              <>
                <Choice
                  label="음식 알레르기"
                  value={p.allergyStatus}
                  onChange={(v) =>
                    setDraft({
                      ...draft,
                      profile: {
                        ...p,
                        allergyStatus: v as typeof p.allergyStatus,
                        restrictions: v === "provided" ? p.restrictions : [],
                      },
                    })
                  }
                  options={[
                    { value: "unknown", label: "잘 모르겠어요" },
                    { value: "none", label: "없어요" },
                    { value: "provided", label: "있어요" },
                    { value: "declined", label: "지금 입력하지 않을게요" },
                  ]}
                />
                {p.allergyStatus === "provided" && (
                  <>
                    <Check
                      label="알레르기 정보를 이번 추천에 사용하는 데 동의해요"
                      checked={c.sensitiveProcessing}
                      onChange={(v) =>
                        setDraft({
                          ...draft,
                          consents: { ...c, sensitiveProcessing: v },
                        })
                      }
                      hint="알레르기 원재료·반응 이력을 안전 검사에 사용해요. 장기 보관은 별도이며 현재 기본 OFF예요."
                    />
                    <ListInput
                      label="알레르기 유발 식품"
                      hint="쉼표로 구분해 주세요. 예: 땅콩, 달걀"
                      disabled={!c.sensitiveProcessing}
                      values={p.restrictions.map((r) => r.value)}
                      onChange={(values) =>
                        setDraft({
                          ...draft,
                          profile: {
                            ...p,
                            restrictions: values.map((value) => ({
                              kind: "food_allergy",
                              value,
                              history:
                                p.restrictions[0]?.history ?? "unspecified",
                            })),
                          },
                        })
                      }
                    />
                    <Check
                      label="심한 반응 또는 미량 반응 이력이 있어요"
                      checked={p.restrictions.some(
                        (r) => r.history === "severe_or_trace_sensitive",
                      )}
                      onChange={(v) =>
                        setDraft({
                          ...draft,
                          profile: {
                            ...p,
                            restrictions: p.restrictions.map((r) => ({
                              ...r,
                              history: v
                                ? "severe_or_trace_sensitive"
                                : "unspecified",
                            })),
                          },
                        })
                      }
                    />
                  </>
                )}
                <ListInput
                  label="절대 제외할 음식"
                  values={p.excluded}
                  onChange={(excluded) =>
                    setDraft({ ...draft, profile: { ...p, excluded } })
                  }
                  placeholder="예: 오이, 고수"
                  hint="선택 항목 · 쉼표로 구분해 주세요."
                />
              </>
            )}
            <div className="button-row">
              <button className="outline-button" onClick={() => setStep(0)}>
                이전
              </button>
              {p.ageBand === "under14" ? (
                <button className="primary-button" onClick={onBrowse}>
                  개인정보 없이 둘러보기
                </button>
              ) : (
                <button
                  className="primary-button"
                  disabled={
                    busy ||
                    p.ageBand === "not_provided" ||
                    (p.allergyStatus === "provided" &&
                      (!c.sensitiveProcessing || !p.restrictions.length))
                  }
                  onClick={() => onSave(draft)}
                >
                  설정하고 시작하기
                  <ArrowRight size={17} />
                </button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
