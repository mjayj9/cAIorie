import { test, expect, type Page } from "@playwright/test";
async function setup(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "이대로 추천받기" }),
  ).toBeEnabled();
  await page
    .getByRole("checkbox", { name: "실제 식당 찾기", exact: true })
    .uncheck();
  await page.getByRole("button", { name: "이대로 추천받기" }).click();
  await page
    .getByRole("checkbox", { name: "식사 기록 보관", exact: true })
    .check();
  await page
    .getByRole("checkbox", { name: "취향과 기본 조건 보관", exact: true })
    .check();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("combobox", { name: "연령 구간", exact: true }).click();
  await page.getByRole("option", { name: "만 19세 이상", exact: true }).click();
  await page
    .getByRole("combobox", { name: "음식 알레르기", exact: true })
    .click();
  await page.getByRole("option", { name: "없어요", exact: true }).click();
  await page.getByRole("button", { name: "설정하고 시작하기" }).click();
  await page.getByRole("button", { name: "그냥 추천", exact: true }).click();
  await expect(page.locator(".candidate-card")).toHaveCount(4);
}
test("initial desktop render and generated image load", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "이대로 추천받기" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("heading", { name: "오늘 점심, 무엇이 좋을까요?" }),
  ).toBeVisible();
  await expect(page.locator(".error-panel")).toHaveCount(0);
  await expect(page.locator(".live-intro")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "실제 식당 찾기", exact: true }),
  ).toBeChecked();
  await page
    .getByRole("checkbox", { name: "실제 식당 찾기", exact: true })
    .uncheck();
  await expect(page.locator(".preview-food img")).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".preview-food img")
        .evaluate(
          (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("complete user journey: configure, recommend, map, select, confirm, rate, edit, delete", async ({
  page,
}) => {
  await setup(page);
  await expect(
    page.getByRole("heading", { name: "오늘의 추천", exact: false }),
  ).toBeVisible();
  const firstName = await page
    .locator(".candidate-card h3")
    .first()
    .textContent();
  await page.getByRole("button", { name: "지도 핀 1 " + firstName }).click();
  await expect(page.locator(".candidate-card").first()).toHaveClass(
    /is-focused/,
  );
  const names = await page.locator(".candidate-card h3").allTextContents();
  await page.getByRole("tab", { name: "간단히", exact: true }).click();
  expect(await page.locator(".candidate-card h3").allTextContents()).toEqual(
    names,
  );
  await page.getByRole("tab", { name: "자세히", exact: true }).click();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({
    path: "test-results/recommendations-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "이 메뉴 선택", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "이 메뉴 선택하기", exact: true })
    .click();
  await expect(page.locator(".pending-meal")).toBeVisible();
  expect(
    (await (await page.request.get("/api/state")).json()).meals,
  ).toHaveLength(0);
  await page.getByRole("button", { name: "먹었어요", exact: true }).click();
  await page.getByRole("button", { name: "5점", exact: true }).click();
  await page.getByRole("button", { name: "평가 마치기", exact: true }).click();
  await expect(page.locator(".pending-meal")).toHaveCount(0);
  await page
    .getByRole("button", { name: "나의 식사 기록", exact: true })
    .click();
  await expect(page.locator(".meal-row")).toHaveCount(1);
  await page.locator(".meal-row button").first().click();
  await page
    .getByRole("textbox", { name: "먹은 음식", exact: true })
    .fill("밥 반 공기, 계란 2개");
  await page.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(page.locator(".meal-row")).toContainText("계란");
  await page.locator(".meal-row button").last().click();
  await page.getByRole("button", { name: "삭제하기", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "첫 한 끼를 남겨보세요" }),
  ).toBeVisible();
});
test("mobile no horizontal overflow, visible primary action and responsive dialogs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "이대로 추천받기" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "이대로 추천받기" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "이대로 추천받기", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "오늘만 조건 변경", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("spinbutton", { name: "1인 예산", exact: true })
    .fill("10000");
  await page
    .getByRole("button", { name: "조건 적용하기", exact: true })
    .click();
  await expect(page.locator(".condition-grid")).toContainText("10,000");
});
test("location denial remains usable with manual coordinates", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "이대로 추천받기" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "위치 선택", exact: true }).click();
  await page
    .getByRole("button", { name: "현재 위치 사용", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("직접 입력");
  await page.getByText("국가·좌표 직접 입력", { exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "위도", exact: true })
    .fill("37.5665");
  await page
    .getByRole("spinbutton", { name: "경도", exact: true })
    .fill("126.978");
  await page.getByRole("button", { name: "직접 선택한 위치 적용" }).click();
  await expect(
    page.getByRole("heading", { name: "점심을 먹을 위치", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "다음", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".mode-switch-label input")).toBeChecked();
});
test("under-14 stays in a non-personal demo", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "이대로 추천받기" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "이대로 추천받기" }).click();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("combobox", { name: "연령 구간", exact: true }).click();
  await page.getByRole("option", { name: "만 14세 미만", exact: true }).click();
  await page.getByRole("button", { name: "개인정보 없이 둘러보기" }).click();
  await expect(
    page.getByText(
      "개인정보 없는 둘러보기 모드 · 식당과 사진은 가상 예시입니다.",
    ),
  ).toBeVisible();
  const state = (await (await page.request.get("/api/state")).json()).state;
  expect(state.onboarded).toBe(false);
  expect(state.profile.restrictions).toHaveLength(0);
});

test("group quick participant addition and removal", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "함께 먹기", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "그룹 공유 범위를 확인했고 동의해요",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "그룹 공유 켜기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "임시 그룹 만들기", exact: true })
    .click();
  await expect(page.locator(".group-person")).toHaveCount(1);
  await page
    .getByText("동행인의 동의를 받아 간단히 입력", { exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "동행인 연령 구간", exact: true })
    .click();
  await page.getByRole("option", { name: "만 19세 이상", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "당사자가 이 조건의 임시 공유에 동의했어요",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "동행인 조건 추가", exact: true })
    .click();
  await expect(page.locator(".group-person")).toHaveCount(2);
  await page
    .locator(".group-person")
    .last()
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  await expect(page.locator(".group-person")).toHaveCount(1);
  await page
    .getByRole("button", { name: "그룹 해산하기", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "임시 그룹 만들기", exact: true }),
  ).toBeVisible();
});
test("mobile navigation closes the menu panel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "이대로 추천받기" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await page.getByRole("button", { name: "추천 설정", exact: true }).click();
  await expect(page.locator('[data-mobile="true"]')).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "내 기준으로 고르는 점심", exact: true }),
  ).toBeVisible();
});
