import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth, redirectOf, resetAuth } from "./helpers/auth";
import { createTestDb } from "./helpers/db";
import { addManager } from "./helpers/league";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);

const { default: manifest } = await import("@/app/manifest");
const { GET: start } = await import("@/app/start/route");
const { GET: offline } = await import("@/app/offline/route");

describe("web app manifest", () => {
  it("makes the site installable as Hoops Fantasy", () => {
    const m = manifest();
    expect(m).toMatchObject({ name: "Hoops Fantasy", display: "standalone", start_url: "/start", scope: "/" });
    expect(m.icons!.map((i) => [i.sizes, i.purpose])).toEqual([
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ]);
    for (const icon of m.icons!) expect(existsSync(`public${icon.src}`)).toBe(true);
    expect(existsSync("public/icons/apple-touch-icon.png")).toBe(true);
  });

  it("opens the installed app on the squad when signed in, otherwise the home page", async () => {
    const { db } = await createTestDb();
    resetAuth(db);
    expect(await redirectOf(() => start())).toBe("/");
    const id = await addManager(db, "Aoife");
    auth.user = { id, email: "aoife@example.ie" };
    expect(await redirectOf(() => start())).toBe("/squad");
  });
});

describe("offline screen", () => {
  it("is a self-contained page with a retry button", async () => {
    const response = offline();
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain("You're offline");
    expect(html).toContain('onclick="location.reload()"');
    // Nothing it needs comes from the network.
    expect(html).not.toMatch(/<(link|script)[^>]+(href|src)=/);
  });
});

/** Runs public/sw.js in a stand-in service worker scope and returns its event handlers. */
function loadWorker(network: (request: { url: string }) => Promise<Response>) {
  const windows: { url: string; focus: () => Promise<unknown>; navigate: (url: string) => Promise<unknown> }[] = [];
  const handlers: Record<string, (event: unknown) => void> = {};
  const cache = new Map<string, Response>();
  const scope = {
    addEventListener: (type: string, fn: (event: unknown) => void) => (handlers[type] = fn),
    skipWaiting: async () => {},
    location: { origin: "https://hoops.test" },
    registration: { showNotification: vi.fn(async () => {}) },
    clients: {
      claim: async () => {},
      matchAll: vi.fn(async () => windows),
      openWindow: vi.fn(async () => null),
    },
    caches: {
      open: async () => ({
        add: async (request: Request) => cache.set(new URL(request.url).pathname, new Response("offline screen")),
      }),
      keys: async () => [],
      delete: async () => true,
      match: async (url: string) => cache.get(url)?.clone(),
    },
    fetch: vi.fn(network),
    Request: class {
      url: string;
      constructor(url: string) {
        this.url = new URL(url, "https://hoops.test").href;
      }
    },
    Response,
    URL,
  };
  (scope as Record<string, unknown>).self = scope;
  runInNewContext(readFileSync("public/sw.js", "utf8"), scope);

  /** Sends a request through the worker; null means the worker let the browser handle it. */
  async function request(url: string, mode: "navigate" | "cors" = "navigate"): Promise<string | null> {
    let responded: Promise<Response> | undefined;
    handlers.fetch({ request: { url, mode }, respondWith: (r: Promise<Response>) => (responded = r) });
    return responded ? (await responded).text() : null;
  }
  async function install() {
    let done: Promise<unknown> = Promise.resolve();
    handlers.install({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  }
  /** Fires an event at the worker and waits for the work it hands to waitUntil. */
  async function fire(type: string, event: object) {
    let done: Promise<unknown> = Promise.resolve();
    handlers[type]({ ...event, waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  }
  return { request, install, fire, scope, windows };
}

describe("service worker", () => {
  let score: number;
  let online: boolean;
  let worker: ReturnType<typeof loadWorker>;

  beforeEach(async () => {
    score = 200.5;
    online = true;
    worker = loadWorker(async () => {
      if (!online) throw new TypeError("Failed to fetch");
      return new Response(`Round 6: ${score.toFixed(1)}`);
    });
    await worker.install();
  });

  it("always gets game pages from the network, never a cache", async () => {
    expect(await worker.request("https://hoops.test/results")).toBe("Round 6: 200.5");
    score = 202.9; // a stat correction
    expect(await worker.request("https://hoops.test/results")).toBe("Round 6: 202.9");
  });

  it("leaves data and API requests alone", async () => {
    expect(await worker.request("https://hoops.test/results?_rsc=1", "cors")).toBeNull();
    expect(await worker.request("https://hoops.test/api/cron/ingest", "cors")).toBeNull();
  });

  it("shows the offline screen when a page can't load, and the page once back online", async () => {
    online = false;
    expect(await worker.request("https://hoops.test/squad")).toBe("offline screen");
    online = true;
    expect(await worker.request("https://hoops.test/squad")).toBe("Round 6: 200.5");
  });
});

describe("push notifications in the service worker", () => {
  const worker = () => loadWorker(async () => new Response(""));
  const push = (payload: unknown) => ({ data: { json: () => payload } });
  const tap = (url: unknown) => ({ notification: { close: vi.fn(), data: { url } } });

  it("shows the notification the server sent", async () => {
    const w = worker();
    await w.fire("push", push({ title: "Round 7 locks at 19:30", body: "That's in an hour.", url: "/squad", tag: "deadline-7" }));
    expect(w.scope.registration.showNotification).toHaveBeenCalledWith("Round 7 locks at 19:30", {
      body: "That's in an hour.",
      tag: "deadline-7",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: "/squad" },
    });
    await w.fire("push", { data: { json: () => JSON.parse("not json") } });
    expect(w.scope.registration.showNotification).toHaveBeenCalledTimes(1);
  });

  it("opens the squad builder for a reminder and results for a results notification", async () => {
    const w = worker();
    await w.fire("notificationclick", tap("/squad"));
    await w.fire("notificationclick", tap("/results"));
    expect(w.scope.clients.openWindow.mock.calls).toEqual([["https://hoops.test/squad"], ["https://hoops.test/results"]]);
  });

  it("reuses an open window of the app", async () => {
    const w = worker();
    const open = { url: "https://hoops.test/leagues", focus: vi.fn(async () => open), navigate: vi.fn(async () => open) };
    w.windows.push(open);
    await w.fire("notificationclick", tap("/results"));
    expect(open.focus).toHaveBeenCalled();
    expect(open.navigate).toHaveBeenCalledWith("https://hoops.test/results");
    expect(w.scope.clients.openWindow).not.toHaveBeenCalled();
  });

  it("only opens pages on this site", async () => {
    const w = worker();
    await w.fire("notificationclick", tap("https://evil.example/phish"));
    await w.fire("notificationclick", tap("//evil.example"));
    expect(w.scope.clients.openWindow.mock.calls).toEqual([["https://hoops.test/"], ["https://hoops.test/"]]);
  });
});
