import { expect, test } from "@playwright/test";
import { withServiceWorker } from "./helpers";

/** The parts of a service worker's global scope these tests use (the DOM types don't include them). */
type WorkerScope = {
  registration: { getNotifications(): Promise<Notification[]> };
  dispatchEvent(event: Event): boolean;
};
type NotificationEventClass = new (type: string, init: { notification: Notification }) => Event;
type PushEventClass = new (type: string, init: { data: string }) => Event;

// Granted when each browser context is created, before the service worker starts.
test.use({ permissions: ["notifications"] });

const NOTIFICATIONS = [
  { name: "deadline reminder", title: "Round 7 locks at 19:30", url: "/squad" },
  { name: "round results", title: "Round 7 results", url: "/results" },
];

for (const n of NOTIFICATIONS) {
  test(`a ${n.name} shows, and tapping it opens ${n.url}`, async ({ page, baseURL }) => {
    const worker = await withServiceWorker(page, "/scoring");

    // A push message arrives, as a push service would deliver it.
    const payload = JSON.stringify({ title: n.title, body: "Test", url: n.url, tag: `test-${n.url}` });
    await worker.evaluate((data) => {
      const PushEventClass = (self as unknown as { PushEvent: PushEventClass }).PushEvent;
      (self as unknown as WorkerScope).dispatchEvent(new PushEventClass("push", { data }));
    }, payload);

    await expect
      .poll(() =>
        worker.evaluate(async () => {
          const scope = self as unknown as WorkerScope;
          return (await scope.registration.getNotifications()).map((x) => ({ title: x.title, url: x.data?.url }));
        }),
      )
      .toEqual([{ title: n.title, url: n.url }]);

    // Tap it: the worker gets the same event a tap on the phone or desktop sends.
    await worker.evaluate(async () => {
      const scope = self as unknown as WorkerScope;
      const NotificationEventClass = (self as unknown as { NotificationEvent: NotificationEventClass }).NotificationEvent;
      const [notification] = await scope.registration.getNotifications();
      scope.dispatchEvent(new NotificationEventClass("notificationclick", { notification }));
    });
    // Signed out, the game screens ask the visitor to sign in first, keeping where they were going.
    await expect(page).toHaveURL(`${baseURL}/sign-in?next=${encodeURIComponent(n.url)}`);
  });
}
