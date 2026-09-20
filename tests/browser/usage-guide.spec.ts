import { test, expect } from "@playwright/test";
test("first-use guide is accessible, dismissible, persistent and can be reopened", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  const guide = page.getByRole("dialog", { name: "cAlorie, 이렇게 사용해요" });
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("위치와 거리 범위부터 정해요");
  for (const title of [
    "식당을 비교하고 방문해요",
    "먹은 음식은 식약처 DB에서 골라요",
    "날짜별 일지에서 언제든 수정해요",
  ]) {
    await guide.getByRole("button", { name: "다음 단계", exact: true }).click();
    await expect(guide).toContainText(title);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/usage-guide-mobile.png",
    fullPage: true,
  });
  await guide.getByRole("button", { name: "시작하기", exact: true }).click();
  await expect(guide).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "이대로 추천받기", exact: true }),
  ).toBeEnabled();
  await expect(guide).toHaveCount(0);
  await page.getByRole("button", { name: "사용 방법", exact: true }).click();
  await expect(guide).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(guide).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("distance range validates and retains metres across unit changes", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("hankki.guide.v1", "seen"),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "오늘만 조건 변경", exact: true })
    .click();
  const min = page.getByRole("spinbutton", {
    name: "최소 이동 거리",
    exact: true,
  });
  const max = page.getByRole("spinbutton", {
    name: "최대 이동 거리",
    exact: true,
  });
  await page
    .getByRole("combobox", { name: "거리 단위", exact: true })
    .selectOption("km");
  await min.fill("2");
  await max.fill("1");
  await page
    .getByRole("button", { name: "조건 적용하기", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(
    "최소 거리는 최대 거리보다 클 수 없어요",
  );
  await min.fill("0.5");
  await max.fill("2");
  await page
    .getByRole("combobox", { name: "거리 단위", exact: true })
    .selectOption("m");
  await expect(min).toHaveValue("500");
  await expect(max).toHaveValue("2000");
  await page
    .getByRole("button", { name: "조건 적용하기", exact: true })
    .click();
  await expect(page.locator(".condition-grid")).toContainText("500m ~ 2km");
  await page
    .getByRole("button", { name: "오늘만 조건 변경", exact: true })
    .click();
  await expect(min).toHaveValue("0.5");
  await expect(max).toHaveValue("2");
});
