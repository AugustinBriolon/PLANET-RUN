import { expect, test } from "@playwright/test";

test.describe("sign-in", () => {
  test("presents the globe and Strava as the way in", async ({ page }) => {
    await page.goto("/login");

    await expect(page).toHaveTitle("Sign in · Planet Run");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("See every place you've ever run.");
    await expect(page.getByRole("region", { name: "Planet preview" }).locator("canvas")).toBeVisible();
    await expect(page.getByRole("button", { name: "Connect with Strava" })).toBeEnabled();
    await expect(page.getByRole("button", { name: /Connect with Garmin/ })).toBeDisabled();
  });

  test("explains a declined Strava authorization", async ({ page }) => {
    await page.goto("/login?error=AccessDenied");
    await expect(page.getByRole("alert").filter({ hasText: "Strava access was declined" })).toBeVisible();
  });

  test("keeps signed-out visitors away from the globe", async ({ page }) => {
    await page.goto("/globe");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("routes the home page to sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});
