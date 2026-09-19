import { test, expect, type Page } from "@playwright/test";
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
  await page.getByRole("tab", { name: "메뉴 검색", exact: true }).click();
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
test("AI consent is explicit and a reviewed preview can be applied before saving", async ({
  page,
}) => {
  await seed(page);
  await page
    .getByRole("button", { name: "개인정보 관리", exact: true })
    .click();
  const consent = page.getByRole("switch", { name: /^외부 AI 전송/ });
  await expect(consent).not.toBeChecked();
  await expect(consent).toBeEnabled();
  await consent.check();
  await page
    .getByRole("button", { name: "동의 변경 적용", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/state")).json()).state.consents
          .externalAi,
    )
    .toBe(true);
  // Generation is verified in the live HTTP suite; this UI test uses a deterministic preview.
  await page.route("**/api/meals/parse", (route) =>
    route.fulfill({
      json: {
        items: [
          { name: "쌀밥", amount: 100, unit: "g" },
          { name: "두부", amount: 50, unit: "g" },
        ],
        method: "openrouter",
        notice: "OpenRouter 무료 모델이 입력 문장을 구분했어요.",
        normalizedText: "쌀밥 100g, 두부 50g",
      },
    }),
  );
  await page
    .getByRole("button", { name: "나의 식사 기록", exact: true })
    .click();
  await page
    .getByRole("button", { name: "식사 기록하기", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "먹은 음식", exact: true })
    .fill("쌀밥 100g 그리고 두부 50g");
  await page
    .getByRole("button", { name: "입력 내용 미리 확인", exact: true })
    .click();
  await expect(page.locator(".parse-preview")).toContainText("OpenRouter");
  await page
    .getByRole("button", { name: "구분한 내용 적용", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "먹은 음식", exact: true }),
  ).toHaveValue("쌀밥 100g, 두부 50g");
  await page
    .getByRole("button", { name: "먹은 식사로 기록", exact: true })
    .click();
  await expect(page.locator(".meal-row")).toContainText("두부");
  const saved = await (await page.request.get("/api/state")).json();
  expect(saved.meals[0].items).toHaveLength(2);
});
