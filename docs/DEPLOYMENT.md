# 공개 배포

## 현재 구성

- 앱: https://caiorie.vercel.app
- GitHub Pages: https://mjayj9.github.io/cAIorie/
- 저장소: https://github.com/mjayj9/cAIorie

GitHub Pages는 Vercel 앱으로 이동하는 정적 진입 페이지입니다. Vercel은 Next.js의 Node.js 24 서버와 API를 실행하고, Neon Free Postgres가 세션·동의·식사 기록을 저장합니다. 함수와 DB는 싱가포르 지역을 사용합니다. 브라우저 요청은 앱과 같은 출처로 전달되며, 키는 서버에서만 읽습니다.

기존 Sites 공개 주소는 이전 시연 배포입니다. 새 배포 대상은 Vercel입니다. 로컬 D1 기록을 새 DB로 자동 복사하지 않습니다.

## 비밀 환경변수

Vercel 프로젝트의 Production 환경에 다음 네 키를 Secret으로 등록합니다.

| Vercel 변수                 | 로컬 값의 출처      | 용도                  |
| --------------------------- | ------------------- | --------------------- |
| KAKAO_REST_API_KEY          | 같은 이름           | 한국 식당·위치 검색   |
| NUTRITION_API_KEY           | 같은 이름           | 식약처 음식 영양 검색 |
| RESTAURANT_REGISTRY_API_KEY | PUBLIC_DATA_API_KEY | 행정안전부 식당 정보  |
| AI_API_KEY                  | 같은 이름           | OpenRouter 무료 AI    |

Vercel은 PUBLIC\_ 접두사를 공개 변수로 분류하므로 행정정보 키는 RESTAURANT_REGISTRY_API_KEY라는 서버 전용 이름을 사용합니다. 로컬 D1은 기존 이름도 지원합니다. 키를 CLI 인자·로그·공개 파일에 넣지 말고, Vercel 환경변수 화면이나 표준입력으로 등록합니다.

일반 설정은 APP_ENV=production, DEMO_MODE=false, AI_PROVIDER=openrouter, AI_BASE_URL=https://openrouter.ai/api/v1, AI_MODEL=openrouter/free입니다. DATABASE_URL은 Vercel의 Neon 연동으로 제공됩니다. Preview에는 Production DB와 키를 공유하지 않으며, 별도 DB를 연결하기 전에는 저장 기능을 검증할 수 없습니다.

AI는 성인 사용자의 별도 전송 동의 후 미리보기를 요청할 때만 호출됩니다. 무료 공급자가 요청을 처리하지 못하거나 응답 검증에 실패하면 명시적인 안내와 함께 규칙 분석을 제공합니다. 서버 로그에는 실패 코드만 남기며 키와 식사 원문은 기록하지 않습니다.

## 배포와 마이그레이션

Vercel 프로젝트는 GitHub 저장소의 main과 연결되어 있습니다. 루트 vercel.json의 build:vercel 명령으로 Next.js를 빌드합니다. API 라우트는 Node.js에서 실행되며 요청 제한 시간은 60초입니다.

최초 배포 또는 새 DB 마이그레이션이 있을 때, 배포 전에 해당 DB의 DATABASE_URL을 설정하고 실행합니다.

```powershell
npm run db:migrate:vercel
npm run build:vercel
```

scripts/migrate-postgres.mjs는 db/postgres의 SQL을 트랜잭션으로 적용하고 체크섬을 기록합니다. 이미 적용한 파일을 수정하면 중단하므로 후속 변경은 새 번호의 SQL 파일로 추가합니다. 적용한 마이그레이션은 재실행해도 중복 적용하지 않습니다.

실제 비밀 파일은 .gitignore와 .vercelignore로 모두 제외합니다. CLI가 내려받은 [SENSITIVE]는 실제 키가 아니며 로컬 실행에 사용하면 안 됩니다. 운영 키 변경 후에는 새 배포가 필요합니다.

## 로컬 개발

기존 `npm run dev`는 localhost:5173의 D1 개발 환경을 유지합니다. Vercel용 Next.js 개발은 별도 개발 DB의 DATABASE_URL을 설정한 뒤 `npm run dev:vercel`로 실행하며 기본 포트는 5175입니다. 보관 중인 .env를 환경변수 내려받기로 덮어쓰지 마세요.

런타임 선택은 #lunch-runtime 경계로 분리합니다. Next.js는 server/runtime.ts, Vinext는 server/runtime.cloudflare.ts를 사용하며, 도메인 로직과 Repository는 같은 Database 계약을 사용합니다.

## 확인

- 타입 검사와 정적 검사
- Next.js 프로덕션 빌드
- RUN_POSTGRES_TESTS=1: 실제 Postgres의 원자성·중복 저장·삭제 연쇄 검사
- RUN_API_TESTS=1: 세션·CSRF·추천·기록·그룹·삭제 통합 검사
- RUN_CONNECTED_API_TESTS=1, RUN_LIVE_KAKAO_TESTS=1: 실제 외부 서비스 검사
- TEST_BASE_URL로 대상 서버를 지정하는 Chromium 사용자 흐름 검사

일반 검증은 로컬 또는 격리된 테스트 환경을 사용합니다. 실제 공개 환경의 확인은 전용 익명 세션으로 수행하고 생성한 식사 기록을 삭제합니다. 최신 실행 결과는 TEST_REPORT.md를 참고하세요.
