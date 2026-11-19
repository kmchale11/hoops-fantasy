import type { BrowserContext, Page, Worker } from "@playwright/test";

/** Loads a page and waits until the service worker is installed and controlling it. */
export async function withServiceWorker(page: Page, path = "/"): Promise<Worker> {
  await page.goto(path);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });
  return currentWorker(page.context());
}

export async function currentWorker(context: BrowserContext): Promise<Worker> {
  return context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
}
