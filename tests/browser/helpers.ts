import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
export async function skipGuide(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem("hankki.guide.v1", "seen"),
  );
}
export async function pickOfficialFood(page: Page, query = "쌀밥") {
  await page
    .getByRole("textbox", { name: "음식 검색", exact: true })
    .fill(query);
  await page.getByRole("button", { name: "검색", exact: true }).click();
  await expect(
    page.locator(".food-search-results .search-item").first(),
  ).toBeVisible({ timeout: 20000 });
  await page.locator(".food-search-results .search-item").first().click();
}
