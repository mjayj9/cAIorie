# 인증된 API 계약

확인일 2026-09-19. 공식 공개 명세와 실제 인증 응답을 함께 확인했다. 비밀 키·사용자의 실제 식사 원문은 이 문서에 없다.

| 대상       | 인증 점검 요청                                                                | 성공 판정                                              |
| ---------- | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| OpenRouter | GET https://openrouter.ai/api/v1/key                                          | HTTP 성공 및 data.is_free_tier boolean                 |
| 식약처     | GET https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03 | header.resultCode=00, body.items 배열                  |
| 행정안전부 | GET https://apis.data.go.kr/1741000/general_restaurants/info                  | response.header.resultCode=0, response.body.items.item |

공공 응답은 루트 또는 response envelope를 허용하고 items 배열·items.item 단일 객체/배열·빈 값을 구분한다. 실패 코드를 HTTP 200 성공으로 오해하지 않는다. Decoding 키를 URLSearchParams에서 한 번 인코딩하고 redirect를 따라가지 않는다.

## 식약처 필드

[공식 원문과 공개 Swagger](https://www.data.go.kr/data/15127578/openapi.do). serviceKey, pageNo, numOfRows, type=json, FOOD_NM_KR 사용.

| 필드                       | 의미           | 처리                                   |
| -------------------------- | -------------- | -------------------------------------- |
| FOOD_CD / FOOD_NM_KR       | 식품 코드·이름 | 식별자·정확한 이름 검증                |
| SERVING_SIZE               | 영양 기준량    | 100g 같은 명시적 g 값만 중량 환산 허용 |
| AMT_NUM1                   | 에너지         | kcal                                   |
| AMT_NUM2                   | 수분           | 단백질에 매핑하지 않음                 |
| AMT_NUM3                   | 단백질         | g                                      |
| AMT_NUM4                   | 지방           | g                                      |
| AMT_NUM6                   | 탄수화물       | g                                      |
| AMT_NUM7                   | 당류           | g                                      |
| AMT_NUM13                  | 나트륨         | mg                                     |
| FOOD_CAT1_NM / UPDATE_DATE | 대분류·갱신일  | 출처 정보                              |

공개 예제 쌀밥의 100g 기준 열량 166kcal·단백질 3.36g·나트륨 0mg을 실제 응답으로 확인했다. 150g 환산은 249kcal의 추정값이며, 특정 식당 음식의 측정값이 아니다. 영값·미상·소수·ml 기준 미환산을 검사했다.

## 일반음식점 필드

[공식 원문과 공개 Swagger](https://www.data.go.kr/data/15154916/openapi.do). serviceKey, pageNo, numOfRows, returnType=json, cond[BPLC_NM::LIKE] 사용.

MNG_NO=관리번호, BPLC_NM=사업장명, ROAD_NM_ADDR/LOTNO_ADDR=주소, SALS_STTS_CD/SALS_STTS_NM=행정 상태, LAST_MDFCN_PNT=수정 시각, CRD_INFO_X/Y=EPSG:5174 좌표. 현재 매칭은 이름·주소에 한정한다. 실제 공개 지점의 정확한 이름·주소 조회와 행정상 정상 응답을 확인했다.

## OpenRouter 계약

[현재 키 정보](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key)는 Bearer 인증 GET이다. 진단 결과에는 label·키·usage 같은 원본 메타데이터를 내보내지 않는다.

[Chat Completions 구조화 출력](https://openrouter.ai/docs/guides/features/structured-outputs)은 고정 /api/v1/chat/completions에 요청한다. strict JSON Schema의 fragments 배열을 받으며 모델이 반환한 문자열을 서버가 다시 검증한다. [무료 라우터](https://openrouter.ai/openrouter/free)는 필요한 기능을 지원하는 무료 모델을 선택한다. [Provider Routing](https://openrouter.ai/docs/guides/routing/provider-selection)의 require_parameters와 data_collection 옵션을 사용한다.

공개 예문 “쌀밥 100g 그리고 두부 50g”의 실제 생성과 앱 동의 흐름을 검증했다. 식품 영양값과 안전 판정은 모델 출력으로 채우지 않는다.
