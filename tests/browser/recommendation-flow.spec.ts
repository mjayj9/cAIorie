import { test, expect, type Page } from "@playwright/test";
async function onboard(page: Page) {
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
  await page
    .getByRole("button", { name: "설정하고 시작하기", exact: true })
    .click();
}
async function conditions(page: Page) {
  await page
    .getByRole("button", { name: "오늘만 조건 변경", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "1인 예산", exact: true })
    .fill("25000");
  await page
    .getByRole("spinbutton", { name: "이동 반경", exact: true })
    .fill("15");
  await expect(page.getByRole("dialog")).toContainText(
    "현재 15m는 매우 좁은 범위",
  );
  await page
    .getByRole("spinbutton", { name: "식사 가능 시간", exact: true })
    .fill("60");
}
test.afterEach(async ({ page, baseURL }) => {
  const snap = await (await page.request.get("/api/state")).json();
  await page.request.post("/api/privacy/delete", {
    headers: { Origin: baseURL!, "X-CSRF-Token": snap.csrf },
    data: {},
  });
});
test("screenshot recovery: 15m -> verified 700m proposal produces three candidates", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "이대로 추천받기", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("checkbox", { name: "실제 식당 찾기", exact: true })
    .uncheck();
  await conditions(page);
  await page
    .getByRole("button", { name: "조건 적용하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "이대로 추천받기", exact: true })
    .click();
  await onboard(page);
  await page.getByRole("button", { name: "그냥 추천", exact: true }).click();
  await expect(page.locator(".relaxation button")).toHaveCount(1);
  await expect(page.locator(".relaxation")).toContainText("반경 700m");
  await expect(page.locator(".relaxation")).not.toContainText("예산");
  await expect(page.locator(".demo-map")).toHaveCount(0);
  await page.locator(".relaxation button").click();
  await expect(page.locator(".candidate-card")).toHaveCount(3);
  await expect(page.locator(".empty-state")).toHaveCount(0);
  await expect(page.locator(".condition-grid")).toContainText("700m");
  await expect(page.locator(".condition-grid")).toContainText("25,000");
});
test("LIVE complete journey: explicit location, station search, food query, choice and confirmed meal", async ({
  page,
}) => {
  test.skip(
    process.env.RUN_LIVE_KAKAO_TESTS !== "1",
    "Uses the configured Kakao key and a public landmark.",
  );
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "이대로 추천받기", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("checkbox", { name: "실제 식당 찾기", exact: true }),
  ).toBeChecked();
  await expect(page.locator(".preview-food")).toHaveCount(0);
  await conditions(page);
  await page
    .getByRole("combobox", { name: "거리 단위", exact: true })
    .selectOption("km");
  await expect(
    page.getByRole("spinbutton", { name: "이동 반경", exact: true }),
  ).toHaveValue("0.015");
  await page.getByRole("button", { name: "1km", exact: true }).click();
  await expect(
    page.getByRole("spinbutton", { name: "이동 반경", exact: true }),
  ).toHaveValue("1");
  await page
    .getByRole("textbox", { name: "오늘 먹고 싶은 음식", exact: true })
    .fill("한식");
  await page
    .getByRole("button", { name: "조건 적용하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "이대로 추천받기", exact: true })
    .click();
  await onboard(page);
  await expect(
    page.getByRole("heading", { name: "점심을 먹을 위치", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "어제는 무엇을 드셨나요?", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "지역·주소 검색", exact: true })
    .fill("서울역");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(
    page.locator(".location-search-results .search-item").first(),
  ).toBeVisible({ timeout: 20000 });
  await page.locator(".location-search-results .search-item").first().click();
  await page.getByRole("button", { name: "그냥 추천", exact: true }).click();
  await expect(page.locator(".restaurant-card")).toHaveCount(3, {
    timeout: 20000,
  });
  await expect(
    page.getByRole("heading", { name: "오늘의 식당 후보", exact: false }),
  ).toBeVisible();
  await expect(page.locator(".empty-state")).toHaveCount(0);
  await page.getByRole("tab", { name: "간단히", exact: true }).click();
  await expect(page.locator(".restaurant-reasons")).toHaveCount(0);
  await expect(page.locator(".restaurant-checks")).toHaveCount(3);
  await page.getByRole("tab", { name: "자세히", exact: true }).click();
  await expect(page.locator(".restaurant-reasons")).toHaveCount(3);
  await expect(page.locator(".location-summary")).toContainText("서울역");
  const first = page.locator(".restaurant-card").first();
  await expect(first).toContainText("한식");
  await expect(
    first.getByRole("link", { name: "메뉴·가격 보기", exact: false }),
  ).toHaveAttribute("href", /place.map.kakao.com/);
  await expect(
    first.getByRole("link", { name: "길찾기", exact: false }),
  ).toHaveAttribute("href", /map.kakao.com/);
  await expect(first).toContainText("1인 예산 이내의 메뉴");
  await expect(page.locator(".relaxation")).toHaveCount(0);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 10000,
  });
  await page.screenshot({
    path: "test-results/live-restaurants-desktop.png",
    fullPage: true,
  });
  await first
    .getByRole("button", { name: "여기로 갈게요", exact: true })
    .click();
  await expect(page.locator(".chosen-restaurant")).toBeVisible();
  expect(
    (await (await page.request.get("/api/state")).json()).meals,
  ).toHaveLength(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0, {
    timeout: 10000,
  });
  await page.screenshot({
    path: "test-results/live-restaurants-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "먹은 음식 기록", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "먹은 음식", exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("textbox", { name: "먹은 음식", exact: true })
    .fill("비빔밥 반 공기");
  await page
    .getByRole("button", { name: "먹은 식사로 기록", exact: true })
    .click();
  await expect(page.locator(".chosen-restaurant")).toHaveCount(0);
  const saved = (await (await page.request.get("/api/state")).json()).meals;
  expect(saved).toHaveLength(1);
  expect(saved[0].dataMode).toBe("live");
  expect(saved[0].status).toBe("confirmed");
  expect(saved[0].raw).toBe("비빔밥 반 공기");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "이대로 추천받기", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("checkbox", { name: "실제 식당 찾기", exact: true }),
  ).toBeChecked();
  await expect(page.locator(".location-summary")).toContainText("위치 선택");
  await expect(page.locator(".preview-food")).toHaveCount(0);
  await page
    .getByRole("button", { name: "오늘만 조건 변경", exact: true })
    .click();
  expect(
    await page
      .locator(".distance-input-row input")
      .evaluate((el) => el.getBoundingClientRect().width),
  ).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});
