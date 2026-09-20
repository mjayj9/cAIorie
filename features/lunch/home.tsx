"use client";
import Image from "next/image";
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  MapPin,
  SlidersHorizontal,
  Sparkles,
  Utensils,
  Plus,
  Loader2,
} from "lucide-react";
import type { Conditions, HistoryAnalysis, Location } from "@/domain/models";
import { money } from "./controls";
import { formatDistance, formatDistanceRange } from "@/domain/distance";
export function HomeHeader({
  analysis,
  conditions,
  location,
  busy,
  mode,
  onMode,
  onConditions,
  onLocation,
  onRecommend,
  onRecord,
}: {
  analysis: HistoryAnalysis;
  conditions: Conditions;
  location: Location | null;
  busy: boolean;
  mode: "demo" | "live";
  onMode: (m: "demo" | "live") => void;
  onConditions: () => void;
  onLocation: () => void;
  onRecommend: () => void;
  onRecord: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A LITTLE BETTER, EVERY LUNCH</p>
          <h1>오늘 점심, 무엇이 좋을까요?</h1>
          <p>나의 취향과 오늘의 조건으로, 한 끼를 골라보세요.</p>
        </div>
        <button className="outline-button" onClick={onRecord}>
          <Plus size={16} />
          식사 기록
        </button>
      </div>
      <div className="summary-grid">
        <button className="summary-card" onClick={onRecord}>
          <span className="mini-icon mint">
            <BookOpen />
          </span>
          <div>
            <p>최근 7일 식사</p>
            <strong>
              {analysis.mealCount}{" "}
              <small>끼 · {analysis.validDays}일 기록</small>
            </strong>
          </div>
          <ChevronRight size={16} className="summary-arrow" />
        </button>
        <div className="summary-card">
          <span className="mini-icon lemon">
            <Utensils />
          </span>
          <div>
            <p>오늘의 확인된 식사</p>
            <strong>
              {analysis.todayCount
                ? analysis.todayCount + "끼 기록"
                : "아직 기록 전"}
            </strong>
          </div>
        </div>
        <div className="summary-card">
          <span className="mini-icon lilac">
            <SlidersHorizontal />
          </span>
          <div>
            <p>식습관 균형 지표</p>
            <strong>평가 기준 확인 중</strong>
          </div>
        </div>
      </div>
      <section className="condition-panel">
        <div className="section-heading">
          <h2>오늘의 점심 조건</h2>
          <button className="text-button" onClick={onConditions}>
            <SlidersHorizontal size={15} />
            오늘만 조건 변경
          </button>
        </div>
        <div className="condition-grid">
          {[
            {
              label: "1인 예산",
              value:
                conditions.budget === null
                  ? "아직 설정 안 됨"
                  : money(conditions.budget, conditions.currency),
            },
            {
              label: "이동 거리 범위 · 직선",
              value: formatDistanceRange(
                conditions.minDistance ?? 0,
                conditions.maxDistance,
              ),
            },
            {
              label: "식사 가능 시간",
              value:
                conditions.availableMinutes === null
                  ? "아직 설정 안 됨"
                  : conditions.availableMinutes +
                    "분" +
                    (conditions.returnTrip ? " · 복귀 포함" : ""),
            },
            {
              label: "동행 · 식사 방식",
              value:
                (conditions.partySize === 1
                  ? "혼자"
                  : conditions.partySize + "명") +
                " · " +
                (conditions.serviceMode === "takeout" ? "포장" : "매장"),
            },
          ].map((x) => (
            <button className="condition" key={x.label} onClick={onConditions}>
              <span>{x.label}</span>
              <strong>{x.value}</strong>
            </button>
          ))}
        </div>
        {conditions.craving && (
          <p className="craving-line">
            오늘 먹고 싶은 음식: <strong>{conditions.craving}</strong>
          </p>
        )}
        {conditions.maxDistance !== null && conditions.maxDistance < 100 && (
          <p className="warning">
            반경 {formatDistance(conditions.maxDistance)}는 매우 좁아요. 거리
            단위를 확인하거나 500m 이상으로 조정해 보세요.
          </p>
        )}
        {mode === "demo" && (
          <p className="demo-mode-notice">
            시연 모드 · 실제 식당을 찾으려면 아래 ‘실제 식당 찾기’를 켜 주세요.
          </p>
        )}
        <div className="condition-bottom">
          <div className="location-summary">
            <button className="text-button" onClick={onLocation}>
              <MapPin size={16} />
              {mode === "demo"
                ? "가상의 한끼동 · 시연 위치"
                : location?.origin === "device"
                  ? "기기에서 확인한 위치"
                  : location && location.origin !== "demo"
                    ? (location.label ?? "직접 선택한 위치")
                    : "위치 선택"}
              <ChevronRight size={15} />
            </button>
            <label className="mode-switch-label">
              <input
                type="checkbox"
                checked={mode === "live"}
                onChange={(e) => onMode(e.target.checked ? "live" : "demo")}
              />
              실제 식당 찾기
            </label>
          </div>
          <button
            className="primary-button recommend-button"
            disabled={busy}
            onClick={onRecommend}
          >
            {busy ? (
              <Loader2 size={17} className="spin" />
            ) : (
              <Sparkles size={17} />
            )}
            이대로 추천받기
            <ArrowUpRight size={18} />
          </button>
        </div>
      </section>
    </>
  );
}
export function WelcomePreview({
  onRecommend,
  onRecord,
  mode,
  hasLocation,
}: {
  onRecommend: () => void;
  onRecord: () => void;
  mode: "demo" | "live";
  hasLocation: boolean;
}) {
  if (mode === "live")
    return (
      <section className="panel live-intro">
        <span className="mini-icon mint">
          <MapPin />
        </span>
        <div>
          <span className="eyebrow">YOUR NEXT LUNCH</span>
          <h2>
            {hasLocation
              ? "이 위치 주변의 점심을 찾아볼까요?"
              : "어디에서 점심을 드실 건가요?"}
          </h2>
          <p>
            실제 식당을 음식 종류와 거리로 비교해요. 메뉴와 가격은 식당 상세에서
            확인할 수 있어요.
          </p>
          <button className="text-button" onClick={onRecommend}>
            {hasLocation ? "주변 식당 찾기" : "위치 선택하고 식당 찾기"}
            <ChevronRight size={17} />
          </button>
        </div>
      </section>
    );
  return (
    <div className="results-layout">
      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">LUNCH PICKS</span>
            <h2>이런 점심을 만날 수 있어요</h2>
          </div>
          <span className="pill">시연용 예시</span>
        </div>
        <div className="preview-food">
          <Image
            unoptimized
            priority
            width={1536}
            height={1024}
            src="/images/lunch-bibimbap.png"
            alt="시연용으로 생성한 비빔밥 이미지"
          />
          <div>
            <span className="pill">나를 위한 점심</span>
            <h2>
              오늘은, 든든한
              <br />
              비빔밥 한 그릇
            </h2>
            <p>
              식당과 메뉴를 함께 비교하고
              <br />
              나에게 맞는 한 끼를 찾아보세요.
            </p>
            <button className="text-button" onClick={onRecommend}>
              나의 점심 찾아보기
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <div className="empty-intro">
          <BookOpen />
          <div>
            <strong>첫 식사를 기록해 볼까요?</strong>
            <p>어제 먹은 메뉴 한 가지로도 시작할 수 있어요.</p>
          </div>
          <button className="outline-button" onClick={onRecord}>
            식사 기록
          </button>
        </div>
      </section>
      <aside className="panel welcome-aside">
        <span className="eyebrow">A LUNCH THAT FITS YOU</span>
        <span className="welcome-number">
          01 <span>/ 나의 기준</span>
        </span>
        <h2>
          취향은 존중하고,
          <br />
          정보는 솔직하게.
        </h2>
        <p>
          가격을 모르면 미확인으로,
          <br />
          먹었는지 모르면 기록 대기로.
        </p>
        <div className="section-divider" />
        <div className="welcome-point">
          <SlidersHorizontal size={18} />
          <span>중요도는 내가 정해요</span>
        </div>
        <div className="welcome-point">
          <MapPin size={18} />
          <span>추천과 장소를 함께 비교해요</span>
        </div>
        <div className="welcome-point">
          <Utensils size={18} />
          <span>먹은 식사만 반영해요</span>
        </div>
      </aside>
    </div>
  );
}
