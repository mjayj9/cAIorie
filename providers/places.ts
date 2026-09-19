import { z } from "zod";
import { straightLineMetres } from "../domain/distance.ts";
import type {
  Evidence,
  Location,
  Observation,
  Place,
} from "../domain/models.ts";
import type { ProviderConfig, ProviderResult } from "./contracts.ts";
import { isUsableKey } from "./contracts.ts";
import { providerFetch, ProviderError, safeSourceUrl } from "./http.ts";
export function unknown<T>(): Observation<T> {
  return { value: null, status: "unknown", evidenceIds: [], checkedAt: null };
}
function value<T>(v: T | null, id: string): Observation<T> {
  return v === null
    ? unknown<T>()
    : {
        value: v,
        status: "verified",
        evidenceIds: [id],
        checkedAt: new Date().toISOString(),
      };
}
function blank(id: string, name: string, provider: string, ev: string): Place {
  return {
    id,
    name,
    providerId: provider,
    address: "",
    latitude: null,
    longitude: null,
    administrativeStatus: "unknown",
    operatingStatus: unknown(),
    rating: unknown(),
    ratingScale: 5,
    reviewCount: unknown(),
    recentReview: unknown(),
    reviewConsistency: unknown(),
    distance: unknown(),
    distanceType: "unknown",
    travelMinutes: unknown(),
    waitMinutes: unknown(),
    mealMinutes: unknown(),
    takeout: unknown(),
    partyCapacity: unknown(),
    menus: [],
    url: null,
    directionsUrl: null,
    evidenceIds: [ev],
  };
}
function evidence(id: string, p: Place, url: string | null): Evidence {
  return {
    id,
    providerId: p.providerId,
    sourceUrl: url,
    retrievedAt: new Date().toISOString(),
    appliesToPlaceId: p.id,
    appliesToMenuId: null,
    attribution: p.providerId === "google" ? "Google Maps" : "Kakao",
    storageAllowed: false,
  };
}
const kakaoSchema = z.object({
  documents: z.array(
    z.object({
      id: z.string(),
      place_name: z.string(),
      address_name: z.string(),
      road_address_name: z.string(),
      x: z.string(),
      y: z.string(),
      place_url: z.string(),
      distance: z.string(),
      category_name: z.string().optional(),
      phone: z.string().optional(),
    }),
  ),
});
export function normalizeKakao(input: unknown): ProviderResult {
  const parsed = kakaoSchema.safeParse(input);
  if (!parsed.success) throw new ProviderError("invalid_response");
  const places = parsed.data.documents.flatMap((d) => {
    const lat = Number(d.y),
      lng = Number(d.x);
    if (
      !d.x ||
      !d.y ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < 33 ||
      lat > 39 ||
      lng < 124 ||
      lng > 132
    )
      return [];
    const id = "kakao:" + d.id,
      ev = "ev:" + id,
      p = blank(id, d.place_name, "kakao", ev);
    p.address = d.road_address_name || d.address_name;
    p.category = d.category_name;
    p.phone = d.phone;
    p.latitude = lat;
    p.longitude = lng;
    const distance = d.distance === "" ? null : Number(d.distance);
    p.distance = value(
      distance !== null && Number.isFinite(distance) && distance >= 0
        ? distance
        : null,
      ev,
    );
    p.distance.unit = "m";
    p.distanceType = p.distance.value === null ? "unknown" : "straight_line";
    p.url = safeSourceUrl(d.place_url);
    p.directionsUrl =
      "https://map.kakao.com/link/to/" + encodeURIComponent(d.id);
    return [p];
  });
  return {
    places,
    evidence: places.map((p) => evidence(p.evidenceIds[0], p, p.url)),
    notices: [
      "Kakao에서 확인한 식당을 비교해요. 메뉴·가격·영업시간은 식당 상세에서 확인해 주세요.",
    ],
  };
}
export async function searchKakao(
  c: ProviderConfig,
  location: Location,
  radius: number | null,
  signal?: AbortSignal,
  query = "",
) {
  if (!isUsableKey(c.kakaoKey)) throw new ProviderError("unconfigured");
  const keyword = query.trim();
  const url = new URL(
    "https://dapi.kakao.com/v2/local/search/" +
      (keyword ? "keyword" : "category") +
      ".json",
  );
  if (keyword) url.searchParams.set("query", keyword);
  url.searchParams.set("category_group_code", "FD6");
  url.searchParams.set("x", String(location.longitude));
  url.searchParams.set("y", String(location.latitude));
  url.searchParams.set(
    "radius",
    String(Math.ceil(Math.min(radius ?? 20000, 20000))),
  );
  url.searchParams.set("sort", "distance");
  url.searchParams.set("size", "15");
  const result = normalizeKakao(
    await providerFetch(url.href, {
      headers: { Authorization: "KakaoAK " + c.kakaoKey },
      signal,
    }),
  );
  if (keyword)
    result.places.forEach((p) => {
      p.matchedQuery = keyword;
    });
  if (radius === null || radius > 20000)
    result.notices.push(
      "국내 장소 검색 범위는 최대 반경 20km예요. 가까운 검색 결과 최대 15곳을 비교해요.",
    );
  return result;
}
const googleSchema = z.object({
  places: z
    .array(
      z.object({
        id: z.string(),
        displayName: z.object({ text: z.string() }),
        formattedAddress: z.string().optional(),
        location: z
          .object({ latitude: z.number(), longitude: z.number() })
          .optional(),
        rating: z.number().optional(),
        userRatingCount: z.number().optional(),
        googleMapsUri: z.string().optional(),
        currentOpeningHours: z
          .object({ openNow: z.boolean().optional() })
          .optional(),
      }),
    )
    .default([]),
});
export async function searchGoogle(
  c: ProviderConfig,
  location: Location,
  radius: number | null,
  signal?: AbortSignal,
): Promise<ProviderResult> {
  if (!isUsableKey(c.googleKey)) throw new ProviderError("unconfigured");
  const raw = await providerFetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": c.googleKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.currentOpeningHours",
      },
      body: JSON.stringify({
        includedTypes: ["restaurant"],
        maxResultCount: 15,
        rankPreference: "DISTANCE",
        locationRestriction: {
          circle: {
            center: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
            radius: Math.min(radius ?? 5000, 50000),
          },
        },
      }),
      signal,
    },
  );
  const parsed = googleSchema.safeParse(raw);
  if (!parsed.success) throw new ProviderError("invalid_response");
  const places = parsed.data.places.map((d) => {
    const id = "google:" + d.id,
      ev = "ev:" + id,
      p = blank(id, d.displayName.text, "google", ev);
    p.address = d.formattedAddress ?? "";
    p.latitude = d.location?.latitude ?? null;
    p.longitude = d.location?.longitude ?? null;
    if (d.location) {
      p.distance = {
        ...value(straightLineMetres(location, d.location), ev),
        status: "estimated",
        unit: "m",
        basis: "출발 위치와 식당 좌표로 계산한 직선거리",
      };
      p.distanceType = "straight_line";
    }
    p.rating = value(d.rating ?? null, ev);
    p.reviewCount = value(d.userRatingCount ?? null, ev);
    p.operatingStatus = value(
      d.currentOpeningHours?.openNow === undefined
        ? null
        : d.currentOpeningHours.openNow
          ? "open"
          : "closed",
      ev,
    );
    p.url = safeSourceUrl(d.googleMapsUri ?? null);
    p.directionsUrl = p.url;
    return p;
  });
  return {
    places,
    evidence: places.map((p) => evidence(p.evidenceIds[0], p, p.url)),
    notices: [
      "Google Maps 제공 장소 목록입니다. 메뉴별 가격과 성분은 확인되지 않았어요.",
    ],
  };
}
export async function geocodeKakao(
  c: ProviderConfig,
  query: string,
  signal?: AbortSignal,
) {
  if (!isUsableKey(c.kakaoKey)) throw new ProviderError("unconfigured");
  const search = async (kind: "address" | "keyword") => {
    const url = new URL(
      "https://dapi.kakao.com/v2/local/search/" + kind + ".json",
    );
    url.searchParams.set("query", query.trim());
    url.searchParams.set("size", "5");
    const raw = await providerFetch(url.href, {
      headers: { Authorization: "KakaoAK " + c.kakaoKey },
      signal,
    });
    const parsed = z
      .object({
        documents: z.array(
          z.object({
            address_name: z.string(),
            place_name: z.string().optional(),
            x: z.string(),
            y: z.string(),
          }),
        ),
      })
      .safeParse(raw);
    if (!parsed.success) throw new ProviderError("invalid_response");
    return parsed.data.documents.flatMap((d) => {
      const latitude = Number(d.y),
        longitude = Number(d.x);
      if (
        !d.x ||
        !d.y ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < 33 ||
        latitude > 39 ||
        longitude < 124 ||
        longitude > 132
      )
        return [];
      return [
        {
          name: d.place_name
            ? d.place_name + " · " + d.address_name
            : d.address_name,
          latitude,
          longitude,
        },
      ];
    });
  };
  const addresses = await search("address");
  return addresses.length ? addresses : search("keyword");
}
