import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

/**
 * Browser tests for what only a real browser can show: the service worker's offline screen
 * and push notifications. They run against a production build, where the worker behaves as
 * it does for users. Run with `npm run test:e2e`.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Full Chromium in headless mode: the lighter headless shell refuses notification permission.
        channel: "chromium",
        // Chrome's own notification display rather than the operating system's, which a
        // headless browser can't rely on.
        launchOptions: { args: ["--disable-features=NativeNotifications,SystemNotifications"] },
      },
    },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/offline`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
