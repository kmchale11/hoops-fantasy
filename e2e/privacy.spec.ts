import { expect, test } from "@playwright/test";

// The app stores link to this page, so it must load for anyone, signed in or not.
test("the privacy notice loads signed out", async ({ page }) => {
  const response = await page.goto("/privacy");
  expect(response?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
  await expect(page.getByText("Firebase Cloud Messaging token")).toBeVisible();
});
