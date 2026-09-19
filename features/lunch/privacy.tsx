"use client";
import { useState } from "react";
import { Download, ShieldCheck, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { SessionState } from "@/domain/models";
import { Choice, Field, Toggle } from "./controls";
export function PrivacyView({
  state,
  busy,
  sensitiveStorageAvailable,
  aiAvailable,
  onSave,
  onExport,
  onDelete,
  onDeletePeriod,
  onReset,
}: {
  state: SessionState;
  busy: boolean;
  sensitiveStorageAvailable: boolean;
  aiAvailable: boolean;
  onSave: (s: SessionState) => Promise<void>;
  onExport: () => void;
  onDelete: () => void;
  onDeletePeriod: (before: string) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState(() => structuredClone(state)),
    [confirm, setConfirm] = useState<"all" | "period" | null>(null),
    [before, setBefore] = useState("");
  const c = draft.consents;
  const toggle = (key: keyof typeof c, value: boolean) => {
    const updated = { ...draft, consents: { ...c, [key]: value } };
    if (key === "sensitiveProcessing" && !value) {
      updated.consents.saveSensitive = false;
      updated.profile = {
        ...draft.profile,
        restrictions: [],
        allergyStatus: "declined",
        heightCm: null,
        weightKg: null,
        sex: "unspecified",
      };
    }
    setDraft(updated);
  };
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR DATA, YOUR CONTROL</p>
          <h1>개인정보 관리</h1>
          <p>무엇을 남길지, 언제 지울지 직접 선택하세요.</p>
        </div>
        <ShieldCheck size={32} />
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>항목별 처리·보관 동의</h2>
          <Toggle
            label="식사 기록 보관"
            checked={c.saveMeals}
            onChange={(v) => toggle("saveMeals", v)}
            hint="철회하면 식사·식후 평가와 관련 파생 데이터가 삭제됩니다."
          />
          <Toggle
            label="기본 조건·음식 취향 보관"
            checked={c.savePreferences}
            onChange={(v) => toggle("savePreferences", v)}
            hint="보관하지 않으면 페이지를 새로 열 때 기본 상태가 됩니다."
          />
          <Toggle
            label="민감정보 일시적 처리"
            checked={c.sensitiveProcessing}
            onChange={(v) => toggle("sensitiveProcessing", v)}
            hint="알레르기·건강 제한을 이번 추천에 사용합니다. 철회하면 관련 그룹 조건도 제거됩니다."
          />
          <Toggle
            label="민감정보 암호화 보관"
            checked={c.saveSensitive}
            disabled={!sensitiveStorageAvailable || !c.sensitiveProcessing}
            onChange={(v) => toggle("saveSensitive", v)}
            hint={
              sensitiveStorageAvailable
                ? "암호화된 프로필 보관. 보관 동의를 끄면 삭제합니다."
                : "암호화 키 미설정 · 보관 기능 비활성화"
            }
          />
          <Toggle
            label="음식점 방문 이력 보관"
            checked={c.saveVisits}
            onChange={(v) => toggle("saveVisits", v)}
            hint="음식 기록과 별도로 식당·메뉴 ID를 연결합니다. 정확한 사용자 위치는 남기지 않습니다."
          />
          <Toggle
            label="식후 평가로 취향 반영"
            checked={c.personalization}
            onChange={(v) => toggle("personalization", v)}
            hint="철회하면 학습 상태를 초기화합니다."
          />
          <Toggle
            label="그룹에 최소 조건 공유"
            checked={c.groupSharing}
            onChange={(v) => toggle("groupSharing", v)}
            hint="철회하면 그룹 참여를 종료합니다. 다른 사람에게 건강정보를 공개하지 않습니다."
          />
          <Toggle
            label="외부 AI 전송"
            checked={c.externalAi}
            disabled={
              (!aiAvailable || draft.profile.ageBand !== "adult") &&
              !c.externalAi
            }
            onChange={(v) => toggle("externalAi", v)}
            hint={
              aiAvailable && draft.profile.ageBand === "adult"
                ? "미리 확인을 누르면 입력 문장을 OpenRouter와 선택된 모델 제공자에게 전송해 구분합니다. 프로필·과거 식사 목록·위치는 포함하지 않습니다. 기본 OFF."
                : "AI 연결과 성인 연령 설정이 필요합니다."
            }
          />
          <p className="caption">
            <a
              href="https://openrouter.ai/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenRouter 개인정보 처리 안내 ↗
            </a>
          </p>
          <button
            className="primary-button full"
            disabled={busy}
            onClick={() => onSave(draft)}
          >
            동의 변경 적용
          </button>
        </section>
        <div className="stack">
          <section className="panel">
            <h2>보관기간과 내보내기</h2>
            <Choice
              label="식사 기록 보관기간"
              value={String(draft.settings.retentionDays)}
              onChange={(v) =>
                setDraft({
                  ...draft,
                  settings: {
                    ...draft.settings,
                    retentionDays: Number(v) as 7 | 30 | 90,
                  },
                })
              }
              options={[
                { value: "7", label: "7일" },
                { value: "30", label: "30일" },
                { value: "90", label: "90일" },
              ]}
            />
            <p className="caption section-intro">
              비회원 세션은 비활동 30일 후 만료됩니다. 만료 자료는 다음 서버
              요청 시 정리되며, 공개 운영에는 정기 삭제 작업을 연결해야 합니다.
            </p>
            <button className="outline-button" onClick={onExport}>
              <Download size={17} />내 데이터 내보내기
            </button>
          </section>
          <section className="panel">
            <h2>기록 정리</h2>
            <Field label="이 날짜까지의 식사 삭제">
              <input
                aria-label="이 날짜까지의 식사 삭제"
                type="date"
                value={before}
                onChange={(e) => setBefore(e.target.value)}
              />
            </Field>
            <button
              className="outline-button"
              disabled={!before || busy}
              onClick={() => setConfirm("period")}
            >
              기간별 기록 삭제
            </button>
            <div className="section-divider" />
            <button className="outline-button" onClick={onReset}>
              학습된 취향만 초기화
            </button>
          </section>
          <section className="panel danger-panel">
            <h2>이 세션의 모든 정보 삭제</h2>
            <p>
              프로필·식사·평가·그룹·학습·임시 추천을 함께 삭제해요. 계정 연동은
              없어 별도 외부 계정 데이터는 없습니다.
            </p>
            <button
              className="outline-button danger-button"
              disabled={busy}
              onClick={() => setConfirm("all")}
            >
              <Trash2 size={16} />
              모든 정보 삭제
            </button>
          </section>
        </div>
      </div>
      <AlertDialog
        open={confirm !== null}
        onOpenChange={(o) => {
          if (!o) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm === "all"
                ? "모든 정보를 삭제할까요?"
                : "선택한 기간의 기록을 삭제할까요?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없어요. 관련 식후 평가와 파생 학습도
              정리됩니다. 필요하면 먼저 내보내 주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirm === "all") onDelete();
                else onDeletePeriod(before);
                setConfirm(null);
              }}
            >
              삭제하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
