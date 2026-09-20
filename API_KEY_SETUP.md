# API 키 설정과 현재 연결 상태

확인일: 2026-09-19. 입력한 AI 키는 **OpenRouter 키**이며 OpenRouter로 연결했다. OpenAI 결제 설정은 이번 연결에 사용하지 않는다. NVIDIA NIM 전환은 필요하지 않았다.

## 현재 설정

로컬 `.env`의 실제 키는 유지하고 다음 제공자 설정을 적용했다.

```dotenv
AI_PROVIDER=openrouter
AI_BASE_URL=https://openrouter.ai/api/v1
AI_MODEL=openrouter/free
```

`AI_API_KEY`, `NUTRITION_API_KEY`, `PUBLIC_DATA_API_KEY`, `KAKAO_REST_API_KEY`는 서버에서만 읽는다. 대화·문서·클라이언트 자산에 키를 넣지 않는다. `.env`는 Git 추적 대상이 아니다.

| 연결             | 검증한 동작                                                   |
| ---------------- | ------------------------------------------------------------- |
| OpenRouter       | 키 인증, 무료 모델의 식사 문장 구분, 원문 검증, 동의 검사     |
| 식품의약품안전처 | 공식 식품 검색, 기준량·단위 매핑, g 중량 환산, 식사 저장·수정 |
| 행정안전부       | 음식점 조회, 이름·주소가 일치한 지점의 행정 상태              |
| Kakao            | 국내 주소·주변 음식점 검색                                    |
| Google Places    | 키 미입력. 해외 검색을 사용할 때만 별도 준비                  |

## 앱에서 사용하기

1. 최소 설정에서 연령 구간 등을 확인한다.
2. **개인정보 관리 → 외부 AI 전송 → 동의 변경 적용**으로 AI 사용 여부를 선택한다. 기본 OFF이며 현재 성인 사용자에게 제공한다.
3. **나의 식사 기록 → 식사 기록하기**에서 식약처 음식명을 검색하고 결과를 선택한다. 임의 이름과 AI 분석 결과를 직접 저장하지 않는다.
4. 선택한 식품의 식약처 기준량을 확인한다. **드신 중량(g)**을 입력한 경우에만 실제 섭취량의 추정값을 계산한다.
5. 국내 실제 조회의 **주변 식당 → 행정정보 확인**에서 인허가 자료를 확인한다. 행정상 정상은 현재 영업 중이라는 뜻이 아니다.

문장 분석 API를 별도로 요청하면 AI에는 현재 입력 문장만 전송한다. 음식 입력 화면은 식약처 검색만 사용한다. 저장된 프로필·과거 기록 목록·위치를 붙이지 않는다. 무료 모델의 호출 제한·장애·잘못된 응답이 발생하면 표시를 달리하고 규칙 기반 입력 결과를 제공한다. 유료 모델로 자동 전환하지 않는다.

## 키를 교체할 때

- OpenRouter: [키 관리](https://openrouter.ai/settings/keys)에서 발급한 키를 `AI_API_KEY`에 넣는다. [무료 라우터](https://openrouter.ai/openrouter/free)를 사용한다.
- 식약처: [식품영양성분DB](https://www.data.go.kr/data/15127578/openapi.do) 활용신청을 승인받고 **일반 인증키(Decoding)**를 `NUTRITION_API_KEY`에 넣는다.
- 행정안전부: [일반음식점](https://www.data.go.kr/data/15154916/openapi.do) 활용신청의 **일반 인증키(Decoding)**를 `PUBLIC_DATA_API_KEY`에 넣는다. 두 서비스의 키가 같아도 각 서비스 활용신청은 필요하다.
- 해외 Google: [Places API (New) 설정](https://developers.google.com/maps/documentation/places/web-service/get-api-key)을 완료한 경우 `GOOGLE_PLACES_API_KEY`를 넣는다. 국내 조회에는 필요하지 않다.

같은 이름의 항목을 중복 추가하지 말고 기존 값만 교체한다. 키를 바꾸면 서버를 재시작한다.

```powershell
# 값 유무만 검사. 외부 요청 없음.
npm run check:apis
# 해당 제공자에 인증 요청 1회. 비밀값·원문 응답 출력 없음.
npm run check:apis -- --live --only=ai
npm run check:apis -- --live --only=nutrition
npm run check:apis -- --live --only=registry
```

OpenRouter 인증 진단은 현재 키 정보만 확인하고 생성 요청을 하지 않는다. 실제 생성 검사는 별도의 통합 검사에 있다. `--only=google`은 Places 요청이므로 계정 사용량에 반영될 수 있다.

실제 식당의 메뉴·가격, 건강 점수 평가식, 경로시간·알림은 별도의 데이터·기능 연결이 필요하다. `NAVER_*`, `WEB_SEARCH_API_KEY`, `MAP_BROWSER_KEY`, `WEB_PUSH_*`, `DATABASE_URL`, `SESSION_SECRET`은 지금 필수 발급 대상이 아니다. `DATA_ENCRYPTION_KEY`는 민감 프로필 보관용 서버 암호화 설정이며 현재 비활성 상태를 유지한다.
