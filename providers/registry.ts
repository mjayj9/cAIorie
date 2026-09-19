import proj4 from "proj4";
proj4.defs(
  "EPSG:5174",
  "+proj=tmerc +lat_0=38 +lon_0=127.002890277778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +towgs84=-145.907,505.034,685.756,-1.162,2.347,1.592,6.342 +units=m +no_defs",
);
// Contract and authenticated field mapping verified on 2026-09-19.
export const registryContract = {
  dataset: "15154916",
  source: "https://www.data.go.kr/data/15154916/openapi.do",
  sourceCrs: "EPSG:5174",
  targetCrs: "EPSG:4326",
  configured: true,
};
export function transformRegistryCoordinates(
  x: number | null,
  y: number | null,
  project: (
    from: string,
    to: string,
    xy: [number, number],
  ) => [number, number] = (from, to, xy) =>
    proj4(from, to, xy) as [number, number],
) {
  if (
    x === null ||
    y === null ||
    x === 0 ||
    y === 0 ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  )
    return null;
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return null;
  const [longitude, latitude] = project(
    registryContract.sourceCrs,
    registryContract.targetCrs,
    [x, y],
  );
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < 33 ||
    latitude > 39 ||
    longitude < 124 ||
    longitude > 132
  )
    return null;
  return { latitude, longitude };
}
export function matchBranch(
  a: { providerId: string; id: string; address: string },
  b: { providerId: string; id: string; address: string },
) {
  return (
    a.providerId === b.providerId && a.id === b.id && a.address === b.address
  );
}

import type { RegistryLookup } from "../domain/foods.ts";
import type { ProviderConfig } from "./contracts.ts";
import { isUsableKey } from "./contracts.ts";
import { fetchPublicData, publicText } from "./public-data.ts";
import { ProviderError } from "./http.ts";

export function normalizeRegistryAddress(value: string) {
  return value
    .normalize("NFKC")
    .replace(/^서울특별시/, "서울")
    .replace(/^부산광역시/, "부산")
    .replace(/^대구광역시/, "대구")
    .replace(/^인천광역시/, "인천")
    .replace(/^광주광역시/, "광주")
    .replace(/^대전광역시/, "대전")
    .replace(/^울산광역시/, "울산")
    .replace(/^세종특별자치시/, "세종")
    .replace(/^경기도/, "경기")
    .replace(/^강원특별자치도|^강원도/, "강원")
    .replace(/^충청북도/, "충북")
    .replace(/^충청남도/, "충남")
    .replace(/^전북특별자치도|^전라북도/, "전북")
    .replace(/^전라남도/, "전남")
    .replace(/^경상북도/, "경북")
    .replace(/^경상남도/, "경남")
    .replace(/^제주특별자치도/, "제주")
    .replace(/[\s,()]/g, "")
    .toLowerCase();
}
const normalizedName = (value: string) =>
  value.normalize("NFKC").replace(/\s/g, "").toLowerCase();
export function matchRegistryRecord(
  place: { name: string; address: string },
  rows: Record<string, unknown>[],
): RegistryLookup {
  const matches = rows.filter(
    (row) =>
      normalizedName(publicText(row.BPLC_NM) ?? "") ===
        normalizedName(place.name) &&
      [row.ROAD_NM_ADDR, row.LOTNO_ADDR].some((raw) => {
        const address = publicText(raw);
        return (
          address &&
          normalizeRegistryAddress(address) ===
            normalizeRegistryAddress(place.address)
        );
      }),
  );
  // Even duplicate names at one street address are not automatically the same branch.
  const unique = new Map(matches.map((row) => [publicText(row.MNG_NO), row]));
  const row =
    unique.size === 1 && !unique.has(null) ? [...unique.values()][0] : null;
  const rawStatus = row ? (publicText(row.SALS_STTS_NM) ?? "") : "";
  const administrativeStatus = /폐업/.test(rawStatus)
    ? "closed"
    : /휴업/.test(rawStatus)
      ? "suspended"
      : /^(영업\/정상|정상|영업)$/.test(rawStatus)
        ? "active"
        : "unknown";
  return {
    matched: !!row,
    administrativeStatus,
    label: row ? rawStatus || "상태 미확인" : "동일 지점 미확인",
    sourceUrl: registryContract.source,
    checkedAt: new Date().toISOString(),
    updatedAt: row ? publicText(row.LAST_MDFCN_PNT) : null,
    notice: row
      ? "이름과 주소가 일치하는 행정 기록입니다. 현재 영업시간·휴무 여부는 식당에서 확인해 주세요."
      : "이름·주소가 모두 일치하는 단일 기록을 확인하지 못했어요. 미등록이나 폐업을 뜻하지 않습니다.",
  };
}
export async function lookupRegistry(
  c: ProviderConfig,
  place: { name: string; address: string },
  signal?: AbortSignal,
) {
  if (!isUsableKey(c.registryKey ?? ""))
    throw new ProviderError("unconfigured");
  const rows = await fetchPublicData(
    "registry",
    c.registryKey!,
    {
      "cond[BPLC_NM::LIKE]": place.name,
      numOfRows: "100",
    },
    signal,
  );
  return matchRegistryRecord(place, rows);
}
