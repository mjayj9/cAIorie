"use client";
import { useState } from "react";
import { ArrowUpRight, Phone } from "lucide-react";
import type { Place } from "@/domain/models";
import { telephoneHref } from "@/domain/place-links";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
export function RestaurantLinks({ place }: { place: Place }) {
  const [phoneOpen, setPhoneOpen] = useState(false);
  const phone = telephoneHref(place.phone);
  const mapName = place.providerId === "kakao" ? "카카오맵" : "지도";
  return (
    <>
      {place.url && (
        <a
          className="outline-button"
          href={place.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          메뉴·가격 보기
          <ArrowUpRight size={14} />
        </a>
      )}
      {place.directionsUrl && (
        <a
          className="outline-button"
          href={place.directionsUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          길찾기
          <ArrowUpRight size={14} />
        </a>
      )}
      <button className="outline-button" onClick={() => setPhoneOpen(true)}>
        <Phone size={14} />
        전화
      </button>
      <details className="map-link-help">
        <summary>전화·길찾기가 안 열리나요?</summary>
        <p>
          길찾기 출발지는 추천받을 때 선택한 위치예요. 카카오맵에서 이동수단과
          출발·도착 위치를 확인해 주세요.
        </p>
        <p>
          전화 앱이 없는 PC에서는 통화가 시작되지 않을 수 있어요. 아래 식당
          상세에서 전화번호나 길찾기를 확인해 주세요.
        </p>
        {place.url && (
          <a href={place.url} target="_blank" rel="noopener noreferrer">
            {mapName}에서 {place.name} 열기 ↗
          </a>
        )}
      </details>
      <Dialog open={phoneOpen} onOpenChange={setPhoneOpen}>
        <DialogContent className="flow-dialog">
          <DialogHeader>
            <DialogTitle>{place.name} 전화 안내</DialogTitle>
            <DialogDescription>
              {phone
                ? "이 기기의 전화 앱을 열어 연결해요. 통화 지원 여부는 기기에 따라 달라요."
                : "제공된 전화번호가 없어요. 지도에서 식당의 최신 연락처를 확인해 주세요."}
            </DialogDescription>
          </DialogHeader>
          {phone && (
            <>
              <p className="restaurant-phone">{place.phone}</p>
              <a className="primary-button" href={phone}>
                <Phone size={16} />
                전화 앱 열기
              </a>
            </>
          )}
          <p className="caption">
            연결이 안 되면 {mapName}의 식당 상세에서 ‘전화’ 버튼을 이용해
            주세요.
          </p>
          {place.url && (
            <a
              className="outline-button"
              href={place.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {mapName}에서 전화 확인 ↗
            </a>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
