"use client";
import Image from "next/image";
import {
  MapPin,
  ArrowUpRight,
  ChevronRight,
  Check,
  Info,
  Star,
  Utensils,
  ShieldAlert,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useState } from "react";
import type {
  Evidence,
  Place,
  RankedCandidate,
  Recommendation,
} from "@/domain/models";
import { money } from "./controls";
import type { RegistryLookup } from "@/domain/foods";
import { RestaurantCards } from "./restaurant-cards";
import { formatDistance } from "@/domain/distance";
const labels = {
  health: "건강 적합도",
  taste: "취향",
  price: "가격",
  distance: "거리",
  rating: "평점",
};
export function CandidateCard({
  candidate,
  index,
  active,
  simple,
  onFocus,
  onSelect,
  onDetails,
}: {
  candidate: RankedCandidate;
  index: number;
  active: boolean;
  simple: boolean;
  onFocus: () => void;
  onSelect: () => void;
  onDetails: () => void;
}) {
  const c = candidate;
  return (
    <article
      className={"candidate-card " + (active ? "is-focused" : "")}
      id={"candidate-" + c.menu.id}
      aria-label={c.place.name + " " + c.menu.name}
    >
      <div className="candidate-main">
        <span className="rank-number">{index + 1}</span>
        <div className="candidate-copy">
          <div className="candidate-meta">
            <span>{c.menu.cuisine}</span>
            <span>·</span>
            <span>
              {c.place.operatingStatus.status === "demo"
                ? "데모"
                : c.place.providerId}
            </span>
            {c.place.rating.value !== null && (
              <span className="rating">
                <Star size={13} />
                {c.place.rating.value}{" "}
                <small>({c.place.reviewCount.value ?? "표본 미확인"})</small>
              </span>
            )}
          </div>
          <h3>{c.place.name}</h3>
          <p className="menu-name">{c.menu.name}</p>
          <div className="candidate-facts">
            <strong>
              {money(c.menu.price.value, c.menu.price.unit ?? "KRW")}
            </strong>
            <span>·</span>
            <button onClick={onFocus}>
              <MapPin size={13} />
              {c.place.distance.value === null
                ? "거리 미확인"
                : c.place.distance.value + "m · 직선"}
            </button>
          </div>
        </div>
        {c.menu.image ? (
          <Image
            unoptimized
            width={1536}
            height={1024}
            className="candidate-image"
            src={c.menu.image}
            alt="가상 비빔밥 예시"
          />
        ) : (
          <span className="menu-symbol">
            <Utensils size={24} />
          </span>
        )}
      </div>
      {c.candidateStatus === "conditional" && (
        <p className="warning">
          <Info size={16} />
          조건 확인 필요:{" "}
          {c.missingFields
            .filter((m) => m !== "검증된 건강 적합도")
            .join(", ") || "성분·조리 정보"}
        </p>
      )}
      {c.safety.mustShowWarnings.map((warning, i) => (
        <p className="safety-note" key={i}>
          <ShieldAlert size={15} />
          {warning}
        </p>
      ))}
      {!simple && (
        <>
          <p className="candidate-reason">
            <Check size={15} />
            {c.reasons[0]}
          </p>
          <div className="score-caption">
            <span>일부 정보 기준 · {Math.round(c.coverage * 100)}% 확인</span>
            <button onClick={onDetails}>
              추천 근거·출처 <ChevronRight size={14} />
            </button>
          </div>
        </>
      )}
      {c.groupMenus && (
        <div className="group-menus">
          {c.groupMenus.map((m, i) => (
            <span key={i}>
              {m.label}: {m.menuName} · {money(m.price)}
            </span>
          ))}
        </div>
      )}
      <div className="candidate-actions">
        <button className="text-button" onClick={onDetails}>
          자세히
        </button>
        <div>
          {c.place.directionsUrl && (
            <a
              className="outline-button"
              href={c.place.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              길찾기
              <ArrowUpRight size={14} />
            </a>
          )}
          <button
            className="outline-button choose-button"
            disabled={c.safety.status !== "reviewed"}
            onClick={onSelect}
          >
            이 메뉴 선택
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
export function DemoMap({
  candidates,
  active,
  onFocus,
}: {
  candidates: RankedCandidate[];
  active: string | null;
  onFocus: (id: string) => void;
}) {
  const selected =
    candidates.find((c) => c.menu.id === active) ?? candidates[0];
  return (
    <section className="panel map-panel">
      <div className="section-heading">
        <h2>추천 장소 한눈에</h2>
        <MapPin size={19} />
      </div>
      <div className="demo-map">
        <span className="map-label">시연용 좌표 평면 · 실제 지도 아님</span>
        <span className="you-pin">시연 시작점</span>
        {candidates.map((c, i) => {
          const x =
            c.place.longitude === null
              ? null
              : Math.max(
                  8,
                  Math.min(85, 50 + (c.place.longitude - 126.978) * 3500),
                );
          const y =
            c.place.latitude === null
              ? null
              : Math.max(
                  20,
                  Math.min(70, 50 - (c.place.latitude - 37.5665) * 4500),
                );
          return x === null || y === null ? null : (
            <button
              key={c.menu.id}
              style={{ left: x + "%", top: y + "%" }}
              className={
                "map-pin " +
                (selected?.menu.id === c.menu.id ? "active-pin" : "")
              }
              aria-label={"지도 핀 " + (i + 1) + " " + c.place.name}
              onClick={() => onFocus(c.menu.id)}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className="map-selection">
          <strong>{selected.place.name}</strong>
          <span>
            {selected.menu.name} · {money(selected.menu.price.value)}
          </span>
          <small>
            운영:{" "}
            {selected.place.operatingStatus.value === "open"
              ? "영업 중으로 설정된 데모"
              : "미확인"}{" "}
            · 실제 운영 여부 아님
          </small>
        </div>
      ) : (
        <p className="caption">추천받으면 최대 3개 번호 핀으로 보여드려요.</p>
      )}
      <p className="caption">데모 좌표는 실제 길찾기에 사용할 수 없어요.</p>
    </section>
  );
}
export function Results({
  result,
  displayMode,
  onDisplay,
  onSelect,
  onRelax,
  onRegistry,
  onChoosePlace,
  onConditions,
  onLocation,
  onRetry,
  busy,
}: {
  result: Recommendation;
  displayMode: "simple" | "normal";
  onDisplay: (mode: "simple" | "normal") => void;
  onSelect: (c: RankedCandidate) => void;
  onRelax: (id: string) => void;
  onRegistry: (place: Place) => Promise<RegistryLookup>;
  onChoosePlace: (place: Place) => void;
  onConditions: () => void;
  onLocation: () => void;
  onRetry: () => void;
  busy: boolean;
}) {
  const [active, setActive] = useState<string | null>(null),
    [detail, setDetail] = useState<RankedCandidate | null>(null),
    [showAllPlaces, setShowAllPlaces] = useState(false);
  const placeCandidates = result.placeCandidates ?? [];
  const count =
    result.recommendations.length +
    result.conditionalCandidates.length +
    placeCandidates.length;
  const candidates = result.recommendations.length
    ? result.recommendations
    : result.conditionalCandidates;
  return (
    <>
      <div className="results-layout" id="lunch-results">
        <section>
          <div className="section-heading">
            <div>
              <span className="eyebrow">LUNCH PICKS</span>
              <h2>
                {placeCandidates.length ? "오늘의 식당 후보" : "오늘의 추천"}{" "}
                <span className="count-badge">{count}</span>
              </h2>
            </div>
            <Tabs
              value={displayMode}
              onValueChange={(v) => onDisplay(v as "simple" | "normal")}
            >
              <TabsList>
                <TabsTrigger value="simple">간단히</TabsTrigger>
                <TabsTrigger value="normal">자세히</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {result.notices.map((n, i) => (
            <p className="result-notice" key={i}>
              {n}
            </p>
          ))}
          {result.status === "provider_unavailable" && (
            <div className="empty-state">
              <Info />
              <h3>연결을 확인해 주세요</h3>
              <p>잠시 후 다시 시도하거나 위치를 바꿔 주세요.</p>
              <button
                className="primary-button"
                onClick={onRetry}
                disabled={busy}
              >
                다시 찾기
              </button>
            </div>
          )}
          {!count && result.status !== "provider_unavailable" && (
            <div className="empty-state compact">
              <Utensils />
              <h3>
                {result.status === "needs_input"
                  ? "검색할 위치와 조건을 확인해 주세요"
                  : "현재 범위에서 후보를 찾지 못했어요"}
              </h3>
              <p>
                {result.proposals.length
                  ? "아래 변경안은 추가 후보가 있는지 확인한 범위예요."
                  : "위치나 음식 검색어를 바꾸고 다시 찾아보세요."}
              </p>
              <div className="button-row">
                <button className="outline-button" onClick={onLocation}>
                  위치 바꾸기
                </button>
                <button className="outline-button" onClick={onConditions}>
                  조건 바꾸기
                </button>
              </div>
            </div>
          )}
          {placeCandidates.length > 0 && (
            <>
              <p className="result-notice">
                {placeCandidates.length}곳을 찾았어요.{" "}
                {Math.min(3, placeCandidates.length)}곳부터 비교해 보세요.
                가격·식사 제한을 모두 확인한 메뉴 추천은 아니에요.
              </p>
              <RestaurantCards
                simple={displayMode === "simple"}
                candidates={
                  showAllPlaces ? placeCandidates : placeCandidates.slice(0, 3)
                }
                onChoose={onChoosePlace}
                onRegistry={onRegistry}
              />
              {placeCandidates.length > 3 && (
                <button
                  className="outline-button more-restaurants"
                  onClick={() => setShowAllPlaces(!showAllPlaces)}
                >
                  {showAllPlaces
                    ? "3곳만 보기"
                    : "나머지 " + (placeCandidates.length - 3) + "곳 더 보기"}
                </button>
              )}
            </>
          )}
          {result.recommendations.map((c, i) => (
            <CandidateCard
              key={c.menu.id}
              candidate={c}
              index={i}
              active={active === c.menu.id}
              simple={displayMode === "simple"}
              onFocus={() => setActive(c.menu.id)}
              onSelect={() => onSelect(c)}
              onDetails={() => setDetail(c)}
            />
          ))}
          {result.conditionalCandidates.length > 0 && (
            <div className="conditional-section">
              <div className="section-heading">
                <h3>추가 확인이 필요한 후보</h3>
                <span className="pill amber">일반 TOP 3와 구분</span>
              </div>
              {result.conditionalCandidates.map((c, i) => (
                <CandidateCard
                  key={c.menu.id}
                  candidate={c}
                  index={i}
                  active={active === c.menu.id}
                  simple={displayMode === "simple"}
                  onFocus={() => setActive(c.menu.id)}
                  onSelect={() => onSelect(c)}
                  onDetails={() => setDetail(c)}
                />
              ))}
            </div>
          )}
          {result.proposals.length > 0 && (
            <div className="panel relaxation">
              <h3>이 조건을 바꿔볼까요?</h3>
              <p>
                선택한 항목만 오늘의 조건에 적용해요. 알레르기·의료상 제한은
                유지됩니다.
              </p>
              <div className="button-row">
                {result.proposals.map((p) => (
                  <button
                    className="outline-button"
                    key={p.id}
                    disabled={busy}
                    onClick={() => onRelax(p.id)}
                  >
                    {p.field === "budget"
                      ? "예산 " + money(p.after)
                      : p.field === "maxDistance"
                        ? "반경 " + formatDistance(p.after)
                        : "평점 하한 " + p.after}
                    로 변경
                    {p.verifiedAdditionalCandidates !== null && (
                      <small>
                        {" · " +
                          p.verifiedAdditionalCandidates +
                          (p.candidateKind === "place" ? "곳" : "곳의 메뉴") +
                          " 추가 확인"}
                      </small>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
        <aside className="results-aside">
          {result.dataMode === "demo" && candidates.length > 0 ? (
            <DemoMap
              candidates={candidates}
              active={active}
              onFocus={setActive}
            />
          ) : (
            <section className="panel">
              <MapPin />
              <h3>방문 전에 확인해 주세요</h3>
              <p className="caption">
                메뉴·가격 보기에서 오늘 판매하는 메뉴와 가격을 확인한 다음,
                길찾기로 실제 이동 시간을 확인해 주세요.
              </p>
            </section>
          )}
          <div className="insight-card">
            <span className="eyebrow">YOUR CHOICE MATTERS</span>
            <h3>
              정답보다,
              <br />
              나에게 맞는 선택.
            </h3>
            <p>
              추천 중요도는 언제든 바꿀 수 있어요. 실제로 드신 식사만 기록에
              반영합니다.
            </p>
          </div>
        </aside>
      </div>
      {detail && (
        <CandidateDetails
          candidate={detail}
          evidence={result.evidence}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}
function CandidateDetails({
  candidate: c,
  evidence,
  onClose,
}: {
  candidate: RankedCandidate;
  evidence: Evidence[];
  onClose: () => void;
}) {
  return (
    <Sheet
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent className="detail-sheet">
        <SheetHeader>
          <SheetTitle>
            {c.place.name} · {c.menu.name}
          </SheetTitle>
          <SheetDescription>
            확인한 사실과 미확인 항목을 분리했어요.
          </SheetDescription>
        </SheetHeader>
        <div className="sheet-body">
          {c.safety.mustShowWarnings.map((w, i) => (
            <p className="warning" key={i}>
              {w}
            </p>
          ))}
          <h3>추천에 반영한 내용</h3>
          <ul>
            {c.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
          <div className="criteria-list">
            {Object.entries(c.criteria).map(([k, v]) => (
              <div key={k}>
                <span>{labels[k as keyof typeof labels]}</span>
                <strong>
                  {v === null ? "미확인" : Math.round(v) + " / 100"}
                </strong>
              </div>
            ))}
          </div>
          <p className="caption">
            추천 적합도이며 의학적 건강 점수가 아니에요. 확인 정보 비중{" "}
            {Math.round(c.coverage * 100)}%는 신뢰 확률이 아닙니다.
          </p>
          {c.comparisonRange && (
            <p>
              보수적 비교 범위: {Math.round(c.comparisonRange.lower)}–
              {Math.round(c.comparisonRange.upper)}
              <small className="block">
                미확인 적합도가 0~100일 때의 가능한 범위 · 통계적 신뢰구간 아님
              </small>
            </p>
          )}
          <h3>식당·메뉴 정보</h3>
          <p>{c.place.address}</p>
          <p>
            행정상 상태: {c.place.administrativeStatus} · 지금 운영 상태:{" "}
            {c.place.operatingStatus.value ?? "미확인"}
          </p>
          <p>영양성분: 검증된 음식·분량 자료가 없어 미제공</p>
          <p>미확인: {c.missingFields.join(", ")}</p>
          <h3>출처와 확인 범위</h3>
          {evidence
            .filter(
              (e) =>
                c.menu.evidenceIds.includes(e.id) ||
                c.place.evidenceIds.includes(e.id),
            )
            .map((e) => (
              <div className="source-row" key={e.id}>
                <strong>{e.attribution}</strong>
                <p>
                  {e.providerId} · {e.retrievedAt.slice(0, 10)}
                </p>
                {e.sourceUrl ? (
                  <a
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    원문 보기 ↗
                  </a>
                ) : (
                  <span className="caption">
                    가상 fixture · 실제 출처 URL 없음
                  </span>
                )}
              </div>
            ))}
          <div className="notice-box">
            <p>
              식당 확인 질문: 해당 원재료가 메뉴와 소스에 들어가나요? 같은
              조리도구·기름을 사용하나요? 제 제한사항에 맞게 조리 가능한가요?
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
