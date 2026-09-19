# 외부 연동과 실제 지원 범위

확인일: **2026-09-19**. Kakao·OpenRouter·식약처·행정안전부를 인증된 실제 요청으로 확인했다. Google은 키가 없어 실제 호출을 검증하지 않았다.

| 기능                  | 구현·현재 범위                                                      |
| --------------------- | ------------------------------------------------------------------- |
| 데모 식당·메뉴        | 가상 6곳. 실제 추천 결과와 혼합하지 않음                            |
| Kakao Local           | 국내 주소·역·건물·음식 키워드 검색, FD6 주변 식당 비교              |
| Google Places New     | 해외 장소 어댑터 구현. 서버 키·권한 설정 및 실제 검증 필요          |
| 행정안전부 일반음식점 | 이름으로 검색 후 이름·주소 모두 일치한 단일 지점의 행정 상태 표시   |
| 식약처 식품영양성분DB | 공식 식품 검색·기준 영양량, 입력한 g 중량별 추정 영양량             |
| OpenRouter            | 무료 모델로 현재 식사 문장 구분. 성인·별도 동의 검사 및 응답 재검증 |
| 실제 식당 메뉴·가격   | 동일 지점의 검증 가능한 메뉴 공급 경로 미연결                       |
| 건강 점수             | 평가식·대상·입력 요건 검증 전 미제공                                |
| 경로·지도 SDK         | 제공자 지도 링크. 도보시간·임베드 미구현                            |
| 알림·계정             | 비회원 세션·임시 그룹. 푸시·계정 동기화·보호자 확인 미연결          |

## 모듈 경계

- `providers/http.ts`: 고정 HTTPS 목적지, 수동 redirect, 응답 크기·시간·호출 제한.
- `providers/public-data.ts`: 공공데이터 공통 인증·envelope 파싱. HTTP 200 내부 오류도 거절.
- `providers/nutrition.ts`: 식약처 검색·필드 정규화·공개 식품의 한정된 메모리 캐시.
- `domain/foods.ts`: 순수한 g 중량 환산. 0과 미확인을 구분.
- `providers/registry.ts`: 좌표 변환과 보수적 이름·주소 지점 매칭.
- `providers/ai.ts`: OpenRouter 호출·JSON 스키마·원문 부분 문자열 검증.
- `server/api/catalog.ts`, `server/api/meals.ts`: 접근·동의·클라이언트 입력·저장 검증.
- `features/lunch/`: 공식 자료와 추정량 표시, 결과 검토·적용, 동의 UI.

## OpenRouter

`AI_PROVIDER=openrouter`, `AI_BASE_URL=https://openrouter.ai/api/v1`, `AI_MODEL=openrouter/free`.

현재 앱은 `openrouter/free` 또는 `:free` 모델만 허용한다. 유료 모델로 자동 전환하지 않는다. 서버는 고정 Chat Completions 주소에 Bearer 키를 전달한다. `response_format=json_schema`, `strict=true`, `provider.require_parameters=true`, `provider.data_collection=deny`를 요청한다. 제공자 정책에 관한 이 옵션은 앱 자체가 모든 외부 보관을 통제한다는 보장이 아니다.

성인 설정과 `externalAi` 동의가 모두 필요하다. 전송 내용은 현재 입력 문장과 고정된 구조화 지시뿐이며, 프로필·위치·과거 식사 목록은 포함하지 않는다. 기본 OFF, 미리 확인을 눌렀을 때만 호출한다. 반환 조각이 원문의 겹치지 않는 부분 문자열인지 순서까지 검사하고, 양·영양·알레르겐을 새로 만들지 않는다. 사용자가 결과를 적용해야 기록할 원문이 바뀐다. 실패 시 규칙 기반 결과와 실패 안내를 반환한다.

실제 인증과 공개 예문 생성, 앱 서버를 통한 동의 전후 처리까지 확인했다. [현재 키 조회](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key), [구조화 출력](https://openrouter.ai/docs/guides/features/structured-outputs), [무료 라우터](https://openrouter.ai/openrouter/free).

## 식약처

[식품영양성분DB 공식 자료](https://www.data.go.kr/data/15127578/openapi.do)의 `FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03`를 사용한다. Decoding 키를 한 번 인코딩하며 `FOOD_NM_KR`로 최대 20건을 검색한다.

`SERVING_SIZE`는 영양 기준량이다. `NUTRI_AMOUNT_SERVING`이나 사용자 실제 섭취량과 혼동하지 않는다. AMT_NUM1=열량 kcal, 3=단백질 g, 4=지방 g, 6=탄수화물 g, 7=당류 g, 13=나트륨 mg. AMT_NUM2는 수분이므로 단백질로 매핑하지 않는다.

DB 원자료는 verified, 입력한 g 중량으로 환산한 식사 영양량은 estimated다. 중량 또는 g 기준량을 모르면 null이며 공기·개·인분·ml를 임의로 g으로 바꾸지 않는다. 실제 음식점 메뉴의 영양·알레르기 성분으로 일반화하지 않는다.

서버가 조회한 식품 ID와 이름을 확인하고 출처·기준값을 식사에 함께 보관한다. 클라이언트가 영양 수치를 지정할 수 없다. 공개 카탈로그만 최대 500건·15분 메모리 캐시하며, 기존 기록 수정에는 소유자가 서버에 보관한 기준값을 재사용한다.

## 행정안전부

[일반음식점 공식 자료](https://www.data.go.kr/data/15154916/openapi.do)의 `general_restaurants/info`를 사용한다. `cond[BPLC_NM::LIKE]` 검색 후 최대 100건에서 이름과 도로명/지번 주소가 모두 일치하고 관리번호가 하나인 경우만 연결한다. 광역행정구역 표기·공백 정도만 정규화하며 층·지점 정보를 버리지 않는다.

검색 범위 내 동일 지점을 확인하지 못하면 미확인이다. 미등록·폐업으로 단정하지 않는다. 행정상 정상·휴업·폐업과 현재 영업시간은 분리한다. 사용자 위치나 건강 프로필은 전송하지 않고 선택한 식당의 공개 이름·주소를 사용한다. EPSG:5174 변환은 별도 함수이며 실제 지점 매칭에 거리를 근거로 사용하지 않는다.

## 장소 제공자

Kakao는 [공식 Local API](https://developers.kakao.com/docs/ko/local/dev-guide)의 주소·키워드·FD6 검색을 사용한다. 주소 결과가 없으면 역·건물 이름 검색으로 이어진다. 먹고 싶은 음식은 FD6 키워드 검색에 전달한다. 이름·주소·업종·전화·좌표·출처·직선거리를 매핑하며 메뉴·가격·평점·운영시간을 만들지 않는다. 조회 범위는 최대 20km, 가까운 결과 최대 15곳이다. 공개 서울역 검색에서 식당 비교·선택·실제 식사 기록까지 검증했다. 반경 때문에 결과가 없으면 한 번의 제한된 추가 조회로 유효한 확장 범위를 확인하며 조건은 사용자가 변경안을 눌러야 바뀐다.

Google은 [Nearby Search New](https://developers.google.com/maps/documentation/places/web-service/nearby-search)의 명시적 FieldMask를 사용한다. id, displayName, formattedAddress, location, rating, userRatingCount, googleMapsUri, currentOpeningHours.openNow를 요청한다. [표시·저장 정책](https://developers.google.com/maps/documentation/places/web-service/policies)에 따라 출처 링크를 표시하고 장소 자료를 DB 추천 캐시에 보관하지 않는다. 실제 Google 계정 호출·요금·지역별 응답은 미검증이다.

## 환경·외부 요청·API

서버 바인딩: `DEMO_MODE`, `KAKAO_REST_API_KEY`, `GOOGLE_PLACES_API_KEY`, `NUTRITION_API_KEY`, `PUBLIC_DATA_API_KEY`, `AI_API_KEY`, `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `DATA_ENCRYPTION_KEY`. 공공데이터 주소·작업명은 검증한 코드 상수이며 임의의 환경변수 주소로 비밀 키를 전달하지 않는다.

호스트별 동시 3개·분당 30회·연속 실패 3회 후 30초 차단. 시간 제한은 장소 6초·공공데이터 12초·AI 30초. 자동 재시도 없음. 원문 오류·키·건강 원문·정확한 사용자 위치를 로그에 출력하지 않는다. 분산 제한기는 아직 없다.

GET: `state`, `foods?q=...`, `locations?q=...`, `groups?id=...`, `privacy/export`.

POST: 기존 설정·추천·기록·그룹 API와 `places/registry`. 모든 POST는 동일 Origin·CSRF 및 Zod 검증을 거친다. `meals/parse`는 외부 AI 동의, `meals` 저장은 별도의 식사 보관 동의를 검사한다.

[키 설정 안내](API_KEY_SETUP.md) · [정확한 필드 계약](docs/API_CONTRACTS_2026-09-19.md) · [검증 결과](TEST_REPORT.md).
