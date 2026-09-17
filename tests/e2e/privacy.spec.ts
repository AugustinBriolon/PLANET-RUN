import { expect, test } from "@playwright/test";

test.describe("privacy and data deletion", () => {
  test("opens the privacy policy from sign-in without leaving the globe", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Privacy" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("dialog", { name: "Privacy" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Deleting your data" })).toBeVisible();
    await expect(page.getByRole("link", { name: "augustin.briolon@gmail.com" })).toHaveAttribute(
      "href",
      "mailto:augustin.briolon@gmail.com",
    );
  });

  test("publishes the privacy policy as a standalone, crawlable page", async ({ page }) => {
    await page.goto("/privacy");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
    await expect(page.getByRole("heading", { name: "Deleting your data" })).toBeVisible();
  });

  test("confirms a completed deletion on the sign-in page", async ({ page }) => {
    await page.goto("/login?deleted=1");
    await expect(page.getByRole("status").filter({ hasText: "data has been deleted" })).toBeVisible();
  });
});
