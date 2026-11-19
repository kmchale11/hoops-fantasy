import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import { createProfile } from "@/accounts/profile";
import { auth, redirectOf, resetAuth } from "./helpers/auth";
import { registerDevice, saveNotificationSettings } from "@/notifications/settings";
import { count, createAuthUser, createTestDb } from "./helpers/db";
import { addFixture, addManager, addRound } from "./helpers/league";

const DAY = 24 * 3600 * 1000;

let testDb: Db;
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);
const webPush = vi.hoisted(() => ({ sendNotification: vi.fn() }));
vi.mock("web-push", async (original) => ({ ...(await original()), sendNotification: webPush.sendNotification }));

const { POST: cron } = await import("@/app/api/cron/ingest/route");
const { POST: importCsv } = await import("@/app/api/admin/import/route");
const { GET: listFixtures } = await import("@/app/api/admin/fixtures/route");
const { hasBearerSecret } = await import("@/lib/auth");
const { default: ImportPage } = await import("@/app/admin/import/page");

const req = (url: string, init: RequestInit & { token?: string } = {}) =>
  new Request(`http://localhost${url}`, {
    ...init,
    headers: { ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}), "Content-Type": "application/json" },
  });

beforeEach(async () => {
  ({ db: testDb } = await createTestDb());
  resetAuth(testDb);
  vi.stubEnv("CRON_SECRET", "cron-secret");
  vi.stubEnv("FEED_SOURCE", "mock");
  vi.stubEnv("MOCK_STAGE", "1");
});

describe("hasBearerSecret", () => {
  it("never matches when the secret is unset", () => {
    expect(hasBearerSecret(req("/", { token: "anything" }), undefined)).toBe(false);
  });
  it("rejects a wrong token of the same length", () => {
    expect(hasBearerSecret(req("/", { token: "cron-secreX" }), "cron-secret")).toBe(false);
  });
});

describe("POST /api/cron/ingest", () => {
  it("rejects requests without the cron secret", async () => {
    const res = await cron(req("/api/cron/ingest", { method: "POST", token: "wrong" }));
    expect(res.status).toBe(401);
    expect(await count(testDb, "ingestion_runs")).toBe(0);
  });

  it("runs ingestion when due, then skips until the next interval", async () => {
    const first = await cron(req("/api/cron/ingest", { method: "POST", token: "cron-secret" }));
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ran: true, status: "succeeded" });
    expect(await count(testDb, "teams")).toBe(10);

    const second = await cron(req("/api/cron/ingest", { method: "POST", token: "cron-secret" }));
    const body = await second.json();
    expect(body.ran).toBe(false);
    expect(body.reason).toMatch(/next run in about/);
  });

  it("sends due notifications on every tick, even in a quiet period", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public-key");
    vi.stubEnv("VAPID_PRIVATE_KEY", "private-key");
    vi.stubEnv("VAPID_SUBJECT", "mailto:hello@hoopsfantasy.ie");
    webPush.sendNotification.mockReset().mockResolvedValue({ statusCode: 201 });
    await cron(req("/api/cron/ingest", { method: "POST", token: "cron-secret" }));

    // Niamh wants reminders, and the next round locks in just over an hour.
    const niamh = await addManager(testDb, "Niamh");
    await saveNotificationSettings(testDb, niamh, { enabled: true, deadlineReminders: true, roundResults: true }, new Date());
    await registerDevice(testDb, niamh, {
      kind: "web",
      endpoint: "https://push.example/niamh",
      webKeys: { p256dh: "key", auth: "auth" },
      platform: "web",
    });
    const now = Date.now();
    await addRound(testDb, 9, new Date(now - DAY), new Date(now + 2 * DAY));
    await addFixture(testDb, 1, 2, new Date(now + 65 * 60 * 1000));

    const res = await cron(req("/api/cron/ingest", { method: "POST", token: "cron-secret" }));
    const body = await res.json();
    expect(body).toMatchObject({ ran: false, notifications: { sent: 1, failed: 0, removed: 0 } });
    expect(body.reason).toMatch(/quiet period/);
    expect(webPush.sendNotification).toHaveBeenCalledTimes(1);
    expect(JSON.parse(webPush.sendNotification.mock.calls[0][1])).toMatchObject({ url: "/squad" });
  });

  it("runs regardless of schedule with ?force=1", async () => {
    await cron(req("/api/cron/ingest", { method: "POST", token: "cron-secret" }));
    const forced = await cron(req("/api/cron/ingest?force=1", { method: "POST", token: "cron-secret" }));
    expect((await forced.json()).ran).toBe(true);
    expect(await count(testDb, "ingestion_runs")).toBe(2);
  });
});

/** Signs in a new user; with a profile unless `profile` is false, and an admin if `admin`. */
async function signIn({ admin = false, profile = true } = {}) {
  const id = await createAuthUser(testDb, `${admin ? "admin" : "player"}@example.ie`);
  if (profile) {
    await createProfile(
      testDb,
      id,
      { managerName: "Someone", teamName: admin ? "Admin Team" : "Player Team", ageConfirmed: true, termsAccepted: true },
      new Date(),
    );
    if (admin) await testDb.query(`update profiles set is_admin = true where user_id = $1`, [id]);
  }
  auth.user = { id, email: "someone@example.ie" };
}

const BAD_UPLOAD = JSON.stringify({
  fixtureExternalId: "mock-f-r3-g1",
  csv: "player_name,team,minutes,pts,reb,ast,stl,blk,tov,fgm,fga,ftm,fta\nNobody,Ballina Braves,1,0,0,0,0,0,0,0,0,0,0",
});

describe("admin endpoints", () => {
  const callBoth = async () => [
    (await listFixtures()).status,
    (await importCsv(req("/api/admin/import", { method: "POST", body: BAD_UPLOAD }))).status,
  ];

  it("reject signed-out visitors with 401", async () => {
    expect(await callBoth()).toEqual([401, 401]);
  });

  it("reject signed-in users who aren't admins with 403", async () => {
    await signIn();
    expect(await callBoth()).toEqual([403, 403]);
  });

  it("reject users who haven't finished signing up with 403", async () => {
    await signIn({ profile: false });
    expect(await callBoth()).toEqual([403, 403]);
  });

  it("let an admin list fixtures", async () => {
    await cron(req("/api/cron/ingest", { method: "POST", token: "cron-secret" }));
    await signIn({ admin: true });
    const res = await listFixtures();
    expect(res.status).toBe(200);
    expect((await res.json()).fixtures.length).toBeGreaterThan(0);
  });

  it("let an admin import, returning 422 with row errors for a bad upload", async () => {
    await cron(req("/api/cron/ingest", { method: "POST", token: "cron-secret" }));
    await signIn({ admin: true });
    const res = await importCsv(req("/api/admin/import", { method: "POST", body: BAD_UPLOAD }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.errors[0].row).toBe(2);
  });

  it("reject a body that isn't the expected JSON", async () => {
    await signIn({ admin: true });
    const res = await importCsv(req("/api/admin/import", { method: "POST", body: "nope" }));
    expect(res.status).toBe(400);
  });
});

describe("admin import page", () => {
  it("is a 404 for anyone but an admin", async () => {
    expect(await redirectOf(() => ImportPage())).toBe("404");
    await signIn();
    expect(await redirectOf(() => ImportPage())).toBe("404");
  });

  it("renders for an admin", async () => {
    await signIn({ admin: true });
    expect(await redirectOf(() => ImportPage())).toBeUndefined();
  });
});
