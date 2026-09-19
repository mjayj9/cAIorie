# 자료 출처와 확인 범위

확인일 **2026-09-19**. 아래는 개발 시 확인한 문서이며, 사용자의 실제 식사나 식당 데이터를 조회했다는 의미가 아니다.

| 자료                                                                                                                       | 확인한 범위                                         | 앱에서의 처리                                               |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| [보건복지부 2025 영양소 섭취기준 개정](https://www.mohw.go.kr/board.es?act=view&bid=0027&list_no=1488441&mid=a10503010100) | 2025-12-31 게시, 2025 기준 개정 발표                | 기준 버전 메타데이터만 등록. 실제 연령별 수치·계산식 미입력 |
| [K-FIND 식품영양성분 자료](https://various.foodsafetykorea.go.kr/nutrient/general/down/info.do)                            | 공식 내려받기 안내                                  | 식약처 공식 API 기준값·명시적 g 중량 환산 연결, 실제 인증 검증          |
| [국민건강영양조사](https://knhanes.kdca.go.kr/knhanes/)                                                                    | 성인 평가법 적용 검토를 위한 출처                   | 원 평가식·대상·입력 검증 전 비활성                          |
| [행정안전부 일반음식점](https://www.data.go.kr/data/15154916/openapi.do)                                                   | 데이터셋·좌표계·행정 정보 범위                      | 실제 조회·동일 이름/주소 매칭 확인, 현재 영업시간과 분리                  |
| [Kakao Local](https://developers.kakao.com/docs/ko/local/dev-guide)                                                        | 장소·주소 검색 요청과 반환 필드                     | 국내 주소·주변 식당 인증 호출 완료                               |
| [Google Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search)                  | Nearby 요청·필드마스크                              | 어댑터 구현, 인증 호출 미실행                               |
| [Google Places 정책](https://developers.google.com/maps/documentation/places/web-service/policies)                         | 표시·출처·저장 제한 문서                            | 원문 링크·출처 표시, 타 지도 혼합 없음                      |
| [FDA Food Allergies](https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies)                   | 알레르기·성분·교차접촉을 보수적으로 다룰 근거       | 안전 보장을 하지 않는 별도 정책                             |
| [CDC 청소년 BMI](https://www.cdc.gov/bmi/child-teen-calculator/bmi-categories.html)                                        | 청소년에게 성인 기준을 그대로 적용할 수 없다는 구분 | BMI 분류·체중감량 처방 제공하지 않음                        |
| [Proj4js](https://proj4js.org/)                                                                                            | 좌표 변환 라이브러리                                | EPSG:5174 정의와 지역 범위 검증                             |

`domain/guidelines.ts`는 기관·버전·URL·게시일·대상·필수입력·기간·단위·라이선스·검증 상태를 보관한다. 현재 모든 영양 평가 방법은 **pending**이다. 성인/청소년 모두 숫자 점수를 제공하지 않고, 실제 기록 수·유효일·음식명 반복만 표시한다. 이는 영양 섭취 적정성 평가나 진단이 아니다.

## 데모 자료

`fixtures/demo.ts`의 6개 장소와 메뉴·가격·리뷰·운영 상태·거리·시간은 시연용으로 만든 가상 값이다. 출처 상태는 demo이며 실제 API 검증값으로 표시하지 않는다. 영양 수치는 비워 두었다. 기본 지도 좌표는 시연 배치이며 실제 식당 위치를 나타내지 않는다.

`demoFoodCatalog`는 음식 이름 검색 흐름만 보여주는 작은 가상 카탈로그다. 그 결과로 실제 메뉴 성분이나 칼로리를 확정하지 않는다. 음식명으로부터 제한적으로 붙인 식품군·조리법에는 추정 근거를 남긴다.

## 이미지

`public/images/lunch-bibimbap.png`는 이 프로젝트를 위해 생성한 예시 이미지다. 특정 음식점의 실제 사진이 아니며, 고기·달걀이 보이는 비빔밥이므로 채식 또는 알레르기 안전 이미지로 표현하지 않는다. 다른 사람의 식당 사진을 수집하거나 출처를 꾸미지 않았다.
