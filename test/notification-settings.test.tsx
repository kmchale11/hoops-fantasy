// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import { dueDeadlineReminders } from "@/notifications/notify";
import { getNotificationSettings } from "@/notifications/settings";
import { auth, form, resetAuth } from "./helpers/auth";
import { createTestDb } from "./helpers/db";
import { addFixture, addManager, addRound, seedLeague, VALID_SQUAD } from "./helpers/league";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { default: NotificationsPage } = await import("@/app/account/notifications/page");
const { default: ReminderCard } = await import("@/app/account/notifications/reminder-card");
const { saveNotificationKinds } = await import("@/app/account/notifications/actions");
const { saveSquadAction } = await import("@/app/squad/actions");

const HOUR = 3600 * 1000;
const VAPID_KEY = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";
const BROWSER_SUBSCRIPTION = {
  endpoint: "https://fcm.googleapis.com/fcm/send/dJ8x-niamhs-phone",
  expirationTime: null,
  keys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
};

let db: Db;
let niamh: string;
let container: HTMLDivElement;
let root: Root;
let permission: NotificationPermission;
let subscribe: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  ({ db } = await createTestDb());
  resetAuth(db);
  await seedLeague(db);
  niamh = await addManager(db, "Niamh");
  auth.user = { id: niamh, email: "niamh@example.ie" };
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", VAPID_KEY);

  // A browser that supports Web Push, with the permission prompt answered by `permission`.
  permission = "granted";
  subscribe = vi.fn(async () => ({ ...BROWSER_SUBSCRIPTION, toJSON: () => BROWSER_SUBSCRIPTION }));
  const requestPermission = vi.fn(async () => permission);
  vi.stubGlobal("Notification", Object.assign(function Notification() {}, { permission: "default", requestPermission }));
  vi.stubGlobal("PushManager", function PushManager() {});
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => null, subscribe } }) },
  });

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const button = (name: string) =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === name) as HTMLButtonElement | undefined;
const click = (name: string) => act(async () => button(name)!.click());

describe("notification settings screen", () => {
  it("starts off, with both kinds ready to go on", async () => {
    const page = renderToStaticMarkup(await NotificationsPage());
    expect(page).toContain("Notifications are <strong>off</strong>");
    expect(page).toContain("Turn on notifications");
    expect(page).toMatch(/name="deadlineReminders" checked=""/);
    expect(page).toMatch(/name="roundResults" checked=""/);
  });

  it("keeps the switches as the user left them", async () => {
    await act(async () => {
      const { default: Settings } = await import("@/app/account/notifications/notification-settings");
      root.render(<Settings initial={await getNotificationSettings(db, niamh)} vapidPublicKey={VAPID_KEY} />);
    });
    await click("Turn on notifications");
    expect(container.textContent).toContain("Notifications are on");

    await saveNotificationKinds({ deadlineReminders: false, roundResults: true });
    expect(await getNotificationSettings(db, niamh)).toEqual({
      enabled: true,
      deadlineReminders: false,
      roundResults: true,
    });
    const page = renderToStaticMarkup(await NotificationsPage());
    expect(page).not.toMatch(/name="deadlineReminders" checked=""/);
    expect(page).toMatch(/name="roundResults" checked=""/);

    // Results only: no deadline reminder for a round locking in an hour.
    await addRound(db, 1, new Date(Date.now() - HOUR), new Date(Date.now() + 48 * HOUR));
    await addFixture(db, 1, 2, new Date(Date.now() + 65 * 60 * 1000));
    expect(await dueDeadlineReminders(db, new Date())).toEqual([]);
    await saveNotificationKinds({ deadlineReminders: true, roundResults: true });
    expect(await dueDeadlineReminders(db, new Date())).toHaveLength(1);
  });
});

describe("turning on Web Push", () => {
  it("stores the subscription this browser was given", async () => {
    act(() => root.render(<ReminderCard vapidPublicKey={VAPID_KEY} />));
    await click("Turn on reminders");
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) });
    expect(subscribe.mock.calls[0][0].applicationServerKey).toHaveLength(65);
    const rows = await db.query(`select user_id, kind, endpoint, web_keys, platform from push_subscriptions`);
    expect(rows).toEqual([
      { user_id: niamh, kind: "web", endpoint: BROWSER_SUBSCRIPTION.endpoint, web_keys: BROWSER_SUBSCRIPTION.keys, platform: "web" },
    ]);
    expect(container.textContent).toContain("Reminders are on");
  });
});

describe("reminder card", () => {
  it("is offered after the first squad save only", async () => {
    await addRound(db, 1, new Date(Date.now() + HOUR), new Date(Date.now() + 72 * HOUR));
    await addFixture(db, 1, 2, new Date(Date.now() + 26 * HOUR));
    const save = () =>
      saveSquadAction({ errors: [], savedAt: null }, form({ players: VALID_SQUAD.join(","), captain: "1" }));
    expect(await save()).toMatchObject({ errors: [], offerReminders: true });
    expect(await save()).toMatchObject({ errors: [], offerReminders: false });
  });

  it("only shows the system prompt when tapped, and stays off if it's declined", async () => {
    permission = "denied";
    act(() => root.render(<ReminderCard vapidPublicKey={VAPID_KEY} />));
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    await click("Turn on reminders");
    expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Notifications are blocked for Hoops Fantasy");
    expect(await getNotificationSettings(db, niamh)).toMatchObject({ enabled: false });
  });

  it("can be put off", async () => {
    act(() => root.render(<ReminderCard vapidPublicKey={VAPID_KEY} />));
    await click("Not now");
    expect(container.textContent).toBe("");
    expect(Notification.requestPermission).not.toHaveBeenCalled();
  });
});
