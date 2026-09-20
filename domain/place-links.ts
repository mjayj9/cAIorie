import type { Location, Place } from "./models.ts";
function point(name: string, latitude: number, longitude: number) {
  return encodeURIComponent(name) + "," + latitude + "," + longitude;
}
export function kakaoDirections(place: Place, origin?: Location) {
  if (place.latitude === null || place.longitude === null) return place.url;
  const end = point(place.name, place.latitude, place.longitude);
  if (!origin || origin.origin === "demo")
    return "https://map.kakao.com/link/to/" + end;
  return (
    "https://map.kakao.com/link/from/" +
    point(
      origin.label || "선택한 출발 위치",
      origin.latitude,
      origin.longitude,
    ) +
    "/to/" +
    end
  );
}
export function telephoneHref(phone?: string) {
  if (!phone || !/^[+0-9() -]+$/.test(phone)) return null;
  const number = phone.replace(/[^+0-9]/g, "");
  return /^\+?\d{8,15}$/.test(number) ? "tel:" + number : null;
}
