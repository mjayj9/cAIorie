import { parseEnv } from "node:util";

export const providers = [
  {
    id: "ai",
    label: "외부 AI",
    key: "AI_API_KEY",
    readiness: "OpenRouter 식사 입력 구분 연결 · 별도 전송 동의 필요",
  },
  {
    id: "nutrition",
    label: "식약처 식품영양성분DB",
    key: "NUTRITION_API_KEY",
    readiness: "공식 식품 검색·중량별 추정 영양량 연결",
  },
  {
    id: "registry",
    label: "행정안전부 일반음식점",
    key: "PUBLIC_DATA_API_KEY",
    readiness: "이름·주소 일치 지점의 행정정보 조회 연결",
  },
  {
    id: "google",
    label: "Google Places (해외 선택)",
    key: "GOOGLE_PLACES_API_KEY",
    readiness: "기존 앱 어댑터 연결 가능",
  },
  {
    id: "kakao",
    label: "Kakao Local",
    key: "KAKAO_REST_API_KEY",
    readiness: "기존 앱 어댑터 연결 가능",
  },
];

export function readConfiguration(source) {
  const values = parseEnv(source);
  const counts = new Map();
  for (const line of source.split(/\r?\n/)) {
    const name = line.match(
      /^\s*(?:export\s+)?([A-Za-z_][A-Za-z_0-9]*)\s*=/,
    )?.[1];
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return {
    values,
    duplicates: new Set(
      [...counts].filter(([, count]) => count > 1).map(([name]) => name),
    ),
  };
}

export function hasKey(value) {
  return (
    Boolean(value?.trim()) &&
    !/^(?:sk-000000|YOUR_|placeholder|여기에|입력)/i.test(value.trim())
  );
}

function requestFor(provider, values) {
  const key = values[provider.key].trim();
  const headers = { Accept: "application/json" };
  let url;
  let body;
  if (provider.id === "ai") {
    const target = {
      openai: { base: "https://api.openai.com/v1", path: "/models" },
      openrouter: { base: "https://openrouter.ai/api/v1", path: "/key" },
    }[values.AI_PROVIDER];
    if (
      !target ||
      (values.AI_BASE_URL &&
        values.AI_BASE_URL.replace(/\/$/, "") !== target.base)
    )
      return null;
    if (key.startsWith("sk-or-") && values.AI_PROVIDER !== "openrouter")
      return null;
    url = new URL(target.base + target.path);
    headers.Authorization = "Bearer " + key;
  } else if (provider.id === "nutrition" || provider.id === "registry") {
    // Fixed official destinations: environment values never choose a secret recipient.
    url = new URL(
      provider.id === "nutrition"
        ? "https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03"
        : "https://apis.data.go.kr/1741000/general_restaurants/info",
    );
    // URLSearchParams performs the one required encoding step.
    url.searchParams.set("serviceKey", key);
    url.searchParams.set("pageNo", "1");
    url.searchParams.set("numOfRows", "1");
    url.searchParams.set(
      provider.id === "nutrition" ? "type" : "returnType",
      "json",
    );
    if (provider.id === "nutrition") url.searchParams.set("FOOD_NM_KR", "쌀밥");
  } else if (provider.id === "kakao") {
    url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
    url.searchParams.set("query", "서울특별시 중구 세종대로 110");
    headers.Authorization = "KakaoAK " + key;
  } else {
    url = new URL("https://places.googleapis.com/v1/places:searchNearby");
    headers["X-Goog-Api-Key"] = key;
    headers["X-Goog-FieldMask"] = "places.id";
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({
      includedTypes: ["restaurant"],
      maxResultCount: 1,
      locationRestriction: {
        circle: {
          center: { latitude: 35.6812, longitude: 139.7671 },
          radius: 1000,
        },
      },
    });
  }
  return {
    url,
    init: { method: body ? "POST" : "GET", headers, body, redirect: "manual" },
  };
}

function countItems(items) {
  if (Array.isArray(items)) return items.length;
  if (items?.item) return Array.isArray(items.item) ? items.item.length : 1;
  return 0;
}

function evaluateResponse(id, raw, aiProvider) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // Public gateways sometimes send XML errors with HTTP 200.
    const match = raw.match(
      /<(?:returnReasonCode|resultCode)>\s*(\d{1,4})\s*<\//,
    );
    return {
      status: "invalid_response",
      ...(match ? { providerCode: match[1] } : {}),
      message:
        "JSON 응답이 아닙니다. 활용신청 승인·인증키·API 상태를 확인하세요.",
    };
  }
  if (id === "nutrition" || id === "registry") {
    const envelope = data?.response ?? data;
    const code = String(envelope?.header?.resultCode ?? "");
    if (!/^0+$/.test(code))
      return {
        status: "provider_error",
        ...(/^\d{1,4}$/.test(code) ? { providerCode: code } : {}),
        message:
          "제공기관이 오류를 반환했습니다. 해당 서비스 활용신청 승인 여부를 확인하세요.",
      };
    if (!envelope.body || typeof envelope.body !== "object")
      return {
        status: "invalid_response",
        message: "정상 결과 본문을 확인할 수 없습니다.",
      };
    return {
      status: "authenticated",
      items: countItems(envelope.body.items),
      message: "인증 호출 성공. 앱 기능 연결·데이터 매핑 검증은 별도입니다.",
    };
  }
  if (id === "ai" && aiProvider === "openrouter") {
    return data?.data && typeof data.data.is_free_tier === "boolean"
      ? {
          status: "authenticated",
          message: "OpenRouter 키 인증 성공. 모델 생성은 별도 확인입니다.",
        }
      : {
          status: "invalid_response",
          message: "정상 인증 응답을 확인할 수 없습니다.",
        };
  }
  const items =
    id === "ai"
      ? data?.data
      : id === "kakao"
        ? data?.documents
        : (data?.places ?? []);
  if (
    !Array.isArray(items) ||
    (id === "google" &&
      (!data || typeof data !== "object" || Array.isArray(data) || data.error))
  )
    return {
      status: "invalid_response",
      message: "정상 응답 형식을 확인할 수 없습니다.",
    };
  return {
    status: "authenticated",
    items: items.length,
    message:
      id === "ai"
        ? "모델 목록 조회 성공. 생성 권한·잔액·앱 AI 연결은 별도 확인이 필요합니다."
        : "장소 API 인증 호출 성공.",
  };
}

export async function inspectProvider(provider, configuration, options = {}) {
  const { values, duplicates } = configuration;
  const base = {
    id: provider.id,
    provider:
      provider.id === "ai"
        ? (values.AI_PROVIDER ?? provider.label)
        : provider.label,
    field: provider.key,
    appStatus: provider.readiness,
  };
  if (duplicates.has(provider.key))
    return {
      ...base,
      status: "duplicate",
      message: "같은 이름의 키 항목이 두 번 이상 있습니다.",
    };
  if (!hasKey(values[provider.key]))
    return { ...base, status: "missing", message: "키 입력 대기" };
  if (
    ["nutrition", "registry"].includes(provider.id) &&
    /%[0-9a-f]{2}/i.test(values[provider.key])
  )
    return {
      ...base,
      status: "encoding_error",
      message: "일반 인증키(Decoding)를 입력하세요.",
    };
  if (!options.live)
    return {
      ...base,
      status: "configured",
      message: "입력됨 · 인증 요청 미실행",
    };
  const request = requestFor(provider, values);
  if (!request)
    return {
      ...base,
      status: "configuration_error",
      message: "AI 키의 제공자와 공식 API 주소 설정을 확인하세요.",
    };
  try {
    const response = await (options.fetchImpl ?? fetch)(request.url, {
      ...request.init,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const code = response.status;
      return {
        ...base,
        status: "http_error",
        httpStatus: code,
        message:
          code >= 300 && code < 400
            ? "리디렉션을 차단했습니다. 키는 다른 주소로 전달하지 않았습니다."
            : code === 401
              ? "키 인증에 실패했습니다."
              : code === 403
                ? "API 사용 권한·활성화·키 제한을 확인하세요."
                : code === 429
                  ? "사용량 또는 호출 한도에 도달했습니다."
                  : "외부 API 요청에 실패했습니다.",
      };
    }
    const raw = await response.text();
    if (raw.length > 1500000)
      return {
        ...base,
        status: "invalid_response",
        message: "응답 크기 제한을 초과했습니다.",
      };
    return {
      ...base,
      httpStatus: response.status,
      ...evaluateResponse(provider.id, raw, values.AI_PROVIDER),
    };
  } catch {
    // Never return request URLs, headers, response bodies, or original exceptions.
    return {
      ...base,
      status: "network_error",
      message: "연결 또는 응답 처리에 실패했습니다.",
    };
  }
}
