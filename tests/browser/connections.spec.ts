import { test, expect, type Page } from "@playwright/test";
import { skipGuide, pickOfficialFood } from "./helpers";
test.beforeEach(async ({ page }) => skipGuide(page));
test.skip(
  process.env.RUN_CONNECTED_API_TESTS !== "1",
  "Enable live public food lookup explicitly.",
);
async function seed(page: Page) {
  const snap = await (await page.request.get("/api/state")).json();
  const state = snap.state;
  state.profile.ageBand = "adult";
  state.profile.allergyStatus = "none";
  state.consents.saveMeals = true;
  state.consents.savePreferences = true;
  const saved = await page.request.post("/api/settings", {
    headers: {
      Origin: new URL(process.env.TEST_BASE_URL ?? "http://localhost:5173")
        .origin,
      "X-CSRF-Token": snap.csrf,
    },
    data: {
      profile: state.profile,
      settings: state.settings,
      consents: state.consents,
    },
  });
  expect(saved.status()).toBe(200);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "이대로 추천받기", exact: true }),
  ).toBeEnabled();
}
test.afterEach(async ({ page, baseURL }) => {
  const snap = await (await page.request.get("/api/state")).json();
  await page.request.post("/api/privacy/delete", {
    headers: { Origin: baseURL!, "X-CSRF-Token": snap.csrf },
    data: {},
  });
});
test("official food reference, explicit grams, saved nutrition and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  await page
    .getByRole("button", { name: "나의 식사 기록", exact: true })
    .click();
  await page
    .getByRole("button", { name: "식사 기록하기", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "음식 검색", exact: true })
    .fill("쌀밥");
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(page.locator(".search-item").first()).toBeVisible({
    timeout: 20000,
  });
  await page.locator(".search-item").first().click();
  await expect(page.locator(".food-reference")).toContainText("DB 기준 100g");
  await expect(page.locator(".food-reference")).toContainText("미확인");
  await page
    .getByRole("spinbutton", { name: "드신 중량 (g)", exact: true })
    .fill("150");
  await expect(page.locator(".food-reference")).toContainText("249 kcal");
  await page.screenshot({
    path: "test-results/official-food-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/official-food-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "먹은 식사로 기록", exact: true })
    .click();
  await expect(page.locator(".meal-row")).toContainText("249 kcal");
  await page.locator(".meal-row button").first().click();
  await expect(
    page.getByRole("spinbutton", { name: "드신 중량 (g)", exact: true }),
  ).toHaveValue("150");
  await page
    .getByRole("spinbutton", { name: "드신 중량 (g)", exact: true })
    .fill("");
  await page.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(page.locator(".meal-row")).toContainText("열량 미확인");
  expect(errors).toEqual([]);
});
test("non-food text cannot be saved and date-specific records remain editable", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "나의 식사 기록", exact: true })
    .click();
  await page
    .getByRole("button", { name: "식사 기록하기", exact: true })
    .click();
  const save = page.getByRole("button", {
    name: "먹은 식사로 기록",
    exact: true,
  });
  await expect(save).toBeDisabled();
  for (const name of ["우라늄", "마약"]) {
    await page
      .getByRole("textbox", { name: "음식 검색", exact: true })
      .fill(name);
    const lookup = page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/api/foods",
    );
    await page.getByRole("button", { name: "검색", exact: true }).click();
    expect((await lookup).status()).toBe(200);
    await expect(
      page.getByRole("button", { name: "검색", exact: true }),
    ).toBeEnabled();
    // MFDS may contain products such as 마약옥수수. A query alone never selects a food.
    await expect(page.locator(".selected-food")).toHaveCount(0);
    await expect(save).toBeDisabled();
  }
  await pickOfficialFood(page);
  await page
    .getByRole("spinbutton", { name: "드신 중량 (g)", exact: true })
    .fill("100");
  await save.click();
  await expect(page.locator(".meal-row")).toHaveCount(1);
  await page
    .getByRole("button", { name: "쌀밥 기록 수정", exact: true })
    .click();
  await page
    .getByRole("spinbutton", { name: "드신 중량 (g)", exact: true })
    .fill("200");
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(
    "en-CA",
    { timeZone: "Asia/Seoul" },
  );
  await page.getByLabel("식사 날짜", { exact: true }).fill(yesterday);
  await page.getByRole("combobox", { name: "식사 시점", exact: true }).click();
  await page.getByRole("option", { name: "저녁", exact: true }).click();
  await page.getByRole("button", { name: "수정 저장", exact: true }).click();
  await expect(page.locator(".meal-row")).toContainText("200 g");
  await expect(page.locator(".meal-row")).toContainText("저녁");
  await page.getByLabel("기록 날짜 필터", { exact: true }).fill(yesterday);
  await expect(page.locator(".meal-row")).toHaveCount(1);
  await page.reload();
  await page
    .getByRole("button", { name: "나의 식사 기록", exact: true })
    .click();
  await expect(page.locator(".meal-row")).toContainText("200 g");
  await expect(page.locator(".meal-row")).toContainText(yesterday);
});
