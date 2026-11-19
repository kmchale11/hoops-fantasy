import { expect, test } from "@playwright/test";
import { withServiceWorker } from "./helpers";

test("shows the offline screen without a connection, and the page once back online", async ({ page, context }) => {
  await withServiceWorker(page);

  await context.setOffline(true);
  await page.goto("/scoring").catch(() => {});
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  // The address stays on the page the user wanted, so retrying loads it.
  expect(new URL(page.url()).pathname).toBe("/scoring");

  await context.setOffline(false);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "How scoring works" })).toBeVisible();
});

test("shows a banner while the connection is down", async ({ page, context }) => {
  await withServiceWorker(page);
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByRole("status")).toHaveText(/You're offline/);

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 15_000 });
});
