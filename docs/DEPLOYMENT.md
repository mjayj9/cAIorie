# 공개 배포

## 구성

- GitHub 저장소: https://github.com/mjayj9/cAIorie
- GitHub Pages: https://mjayj9.github.io/cAIorie/
- 앱: https://mjayj9-caiorie.michaeljung1214.chatgpt.site

Pages는 `github-pages/`의 정적 진입 페이지를 배포하고 공개 앱으로 이동합니다. 브라우저의 추천·기록 요청은 앱과 같은 출처의 서버 API로 전송됩니다. 앱 서버는 Sites의 Cloudflare Worker, 데이터 저장소는 D1의 `DB` 바인딩입니다. `.openai/hosting.json`은 프로젝트 식별자와 바인딩만 포함합니다.

## 런타임 설정

초기 공개는 시연 모드입니다. 실제 조회를 활성화할 때 아래 값을 Sites의 런타임 환경변수로 설정한 뒤 저장된 버전을 다시 배포합니다. 로컬 `.env`는 업로드되지 않으며 GitHub Actions에도 외부 서비스 키를 넣지 않습니다.

| 변수                  | 설정                                       |
| --------------------- | ------------------------------------------ |
| `APP_ENV`             | `production`                               |
| `DEMO_MODE`           | 시연은 `true`, 실제 데이터 연결 후 `false` |
| `KAKAO_REST_API_KEY`  | 비밀값 · 한국 식당과 위치 검색             |
| `NUTRITION_API_KEY`   | 비밀값 · 식약처 음식 영양 검색             |
| `PUBLIC_DATA_API_KEY` | 비밀값 · 행정안전부 식당 정보              |
| `AI_API_KEY`          | 비밀값 · OpenRouter                        |
| `AI_PROVIDER`         | `openrouter`                               |
| `AI_BASE_URL`         | `https://openrouter.ai/api/v1`             |
| `AI_MODEL`            | `openrouter/free`                          |

AI 호출은 앱 안의 별도 동의와 사용자의 미리보기 요청이 있을 때만 실행합니다. API 키를 클라이언트 변수, 소스 파일, 배포 아카이브 또는 GitHub Pages HTML에 넣지 마세요. 실제 서버 연결 전에는 실제 데이터가 연결됐다고 표시하지 않습니다.

## 갱신

1. 앱을 검증하고 변경 소스를 GitHub와 해당 Sites 소스 저장소에 푸시합니다.
2. 같은 커밋에서 만든 Worker 빌드와 `drizzle/` 마이그레이션을 Sites로 배포합니다. 공개 접근 설정을 유지합니다.
3. Pages 진입 페이지는 `main`에서 `github-pages/` 또는 워크플로가 바뀌면 `.github/workflows/pages.yml`이 자동 배포합니다. GitHub Actions에서 수동 실행도 가능합니다.

GitHub의 전체 애플리케이션 소스는 Pages 아티팩트에 포함되지 않습니다. 공개 앱 주소를 변경하면 `github-pages/index.html`과 `404.html`의 이동 주소·링크·canonical을 함께 변경하세요. 키를 수정했다면 환경변수 변경 뒤 앱 재배포가 필요합니다.

## 저장 데이터

방문자는 각자 서버 세션을 사용합니다. 보관 동의 후 저장된 식사 기록은 공개 서버의 D1에 저장되며 로컬 개발 데이터는 전송하지 않습니다. 삭제와 내보내기는 앱의 개인정보 관리에서 제공합니다. 민감정보 암호화 키를 별도로 설정하지 않으면 민감정보 장기 저장 기능은 활성화되지 않습니다.
