"use client";
import { Check, MapPin, ShieldAlert, Utensils } from "lucide-react";
import type { Place, PlaceCandidate } from "@/domain/models";
import type { RegistryLookup } from "@/domain/foods";
import { formatDistance } from "@/domain/distance";
import { NearbyPlaceRow } from "./registry";
import { RestaurantLinks } from "./restaurant-links";
export function RestaurantCards({
  candidates,
  simple,
  onChoose,
  onRegistry,
}: {
  candidates: PlaceCandidate[];
  simple: boolean;
  onChoose: (place: Place) => void;
  onRegistry: (place: Place) => Promise<RegistryLookup>;
}) {
  return (
    <div className="restaurant-list">
      {candidates.map((c, i) => (
        <article
          className="restaurant-card"
          key={c.place.id}
          aria-label={c.place.name}
        >
          <div className="restaurant-heading">
            <span className="rank-number">{i + 1}</span>
            <div>
              <span className="candidate-meta">
                {c.place.category?.split(" > ").slice(1).join(" · ") ||
                  "음식점"}
              </span>
              <h3>{c.place.name}</h3>
              <p>{c.place.address}</p>
            </div>
            <span className="restaurant-distance">
              <MapPin size={14} />
              {c.place.distance.value === null
                ? "거리 미확인"
                : formatDistance(c.place.distance.value)}
              <small>직선거리</small>
            </span>
          </div>
          {!simple && (
            <div className="restaurant-reasons">
              {c.reasons.map((reason) => (
                <p key={reason}>
                  <Check size={14} />
                  {reason}
                </p>
              ))}
            </div>
          )}
          {c.inquiryOnly && (
            <p className="safety-note">
              <ShieldAlert size={16} />
              식사 제한 확인용 장소예요. 안전한 메뉴가 확인된 추천이 아닙니다.
            </p>
          )}
          {c.warnings.map((warning) => (
            <p className="safety-note" key={warning}>
              {warning}
            </p>
          ))}
          <p className="restaurant-checks">
            <strong>방문 전 확인</strong>
            {c.checks.join(" · ")}
          </p>
          <div className="restaurant-actions">
            <RestaurantLinks place={c.place} />
            {!c.inquiryOnly && (
              <button
                className="primary-button"
                onClick={() => onChoose(c.place)}
              >
                여기로 갈게요
              </button>
            )}
          </div>
          <details className="restaurant-source">
            <summary>
              {c.place.providerId === "kakao" ? "Kakao" : "Google Maps"}{" "}
              출처·행정정보
            </summary>
            <NearbyPlaceRow place={c.place} onLookup={onRegistry} />
          </details>
        </article>
      ))}
    </div>
  );
}
export function ChosenRestaurant({
  place,
  onRecord,
  onCancel,
}: {
  place: Place;
  onRecord: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="panel chosen-restaurant" aria-label="방문할 식당">
      <span className="mini-icon mint">
        <Utensils />
      </span>
      <div>
        <span className="eyebrow">방문할 식당</span>
        <h3>{place.name}</h3>
        <p>
          방문 전 메뉴·가격과 영업 여부를 확인하세요. 실제로 드신 뒤 음식을
          기록해 주세요.
        </p>
        <small>선택한 식당은 이 화면에서만 유지돼요.</small>
      </div>
      <div className="button-row">
        <RestaurantLinks place={place} />
        <button className="primary-button" onClick={onRecord}>
          먹은 음식 기록
        </button>
        <button className="text-button" onClick={onCancel}>
          선택 취소
        </button>
      </div>
    </section>
  );
}
