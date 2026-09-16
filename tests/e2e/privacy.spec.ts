import { expect, test } from "@playwright/test";

test.describe("privacy and data deletion", () => {
  test("publishes the privacy policy, linked from sign-in", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Privacy" }).click();

    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Privacy");
    await expect(page.getByRole("heading", { name: "Deleting your data" })).toBeVisible();
  });

  test("confirms a completed deletion on the sign-in page", async ({ page }) => {
    await page.goto("/login?deleted=1");
    await expect(page.getByRole("status").filter({ hasText: "data has been deleted" })).toBeVisible();
  });
});
