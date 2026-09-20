"use client";
import { useState, useSyncExternalStore } from "react";
import { BookOpen, CircleHelp, MapPin, Pencil, Utensils } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
export const GUIDE_STORAGE_KEY = "hankki.guide.v1";
const guideEvent = "hankki-guide-seen";
let seenInMemory = false;
function unseen() {
  try {
    return !seenInMemory && localStorage.getItem(GUIDE_STORAGE_KEY) !== "seen";
  } catch {
    return !seenInMemory;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(guideEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(guideEvent, callback);
  };
}
const steps = [
  {
    icon: MapPin,
    title: "위치와 거리 범위부터 정해요",
    text: "‘위치 선택’에서 현재 위치를 사용하거나 역·주소를 검색해 선택하세요. ‘오늘만 조건 변경’에서 예산과 최소~최대 거리를 정할 수 있어요.",
    tip: "예: 0.5km ~ 2km. 거리는 직선거리 기준이에요.",
  },
  {
    icon: Utensils,
    title: "식당을 비교하고 방문해요",
    text: "‘이대로 추천받기’를 누르고 처음에는 연령·알레르기와 원하는 보관 동의를 선택하세요. 후보의 메뉴·가격을 확인한 뒤 ‘여기로 갈게요’를 누르세요.",
    tip: "‘길찾기’는 선택한 출발 위치와 식당을 카카오맵으로 연결해요. 전화가 안 열리면 카카오맵 식당 상세를 이용하세요.",
  },
  {
    icon: BookOpen,
    title: "먹은 음식은 식약처 DB에서 골라요",
    text: "‘먹은 음식 기록’ 또는 ‘식사 기록하기’를 누르고 음식 이름을 검색하세요. 검색 결과에서 항목을 선택하고 중량(g)을 입력한 뒤 저장하세요.",
    tip: "DB에 없는 이름은 저장할 수 없어요. 중량을 모르면 비워 두고, 아직 먹지 않았다면 계획으로 저장해요.",
  },
  {
    icon: Pencil,
    title: "날짜별 일지에서 언제든 수정해요",
    text: "‘나의 식사 기록’에서 날짜를 고르고 각 기록의 ‘기록 수정’을 누르세요. 음식, 중량, 날짜, 식사 시점을 고친 뒤 ‘수정 저장’을 누르면 반영돼요.",
    tip: "이 안내는 화면 위쪽 ‘사용 방법’에서 다시 볼 수 있어요.",
  },
];
export function UsageGuide() {
  const firstVisit = useSyncExternalStore(subscribe, unseen, () => false);
  const [manual, setManual] = useState(false);
  const [step, setStep] = useState(0);
  const current = steps[step],
    Icon = current.icon;
  function close() {
    seenInMemory = true;
    try {
      localStorage.setItem(GUIDE_STORAGE_KEY, "seen");
    } catch {}
    window.dispatchEvent(new Event(guideEvent));
    setManual(false);
  }
  return (
    <>
      <button
        className="text-button guide-launch"
        onClick={() => {
          setStep(0);
          setManual(true);
        }}
      >
        <CircleHelp size={17} />
        사용 방법
      </button>
      <Dialog
        open={firstVisit || manual}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <DialogContent className="flow-dialog usage-guide">
          <DialogHeader>
            <DialogTitle>cAlorie, 이렇게 사용해요</DialogTitle>
            <DialogDescription>
              추천부터 식사 일지까지, 네 단계로 시작해 보세요.
            </DialogDescription>
          </DialogHeader>
          <nav className="guide-progress" aria-label="사용 안내 단계">
            {steps.map((item, index) => (
              <button
                key={item.title}
                aria-label={index + 1 + "단계: " + item.title}
                aria-current={index === step ? "step" : undefined}
                onClick={() => setStep(index)}
              >
                {index + 1}
              </button>
            ))}
          </nav>
          <section className="guide-step" aria-live="polite">
            <span className="mini-icon mint">
              <Icon />
            </span>
            <p className="eyebrow">
              {step + 1} / {steps.length}
            </p>
            <h2>{current.title}</h2>
            <p>{current.text}</p>
            <p className="notice-box">{current.tip}</p>
          </section>
          <div className="button-row">
            <button className="text-button" onClick={close}>
              안내 닫기
            </button>
            {step > 0 && (
              <button
                className="outline-button"
                onClick={() => setStep(step - 1)}
              >
                이전
              </button>
            )}
            <button
              className="primary-button"
              onClick={() =>
                step === steps.length - 1 ? close() : setStep(step + 1)
              }
            >
              {step === steps.length - 1 ? "시작하기" : "다음 단계"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
